/**
 * PhotoSight Enhanced Lambda - Oracle + Cognitive Load Reducer
 * 
 * Monitors Oracle PhotoSight database and caches intelligent insights
 * Runs every 15 minutes to provide real-time photo analysis intelligence
 */

const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const oracledb = require('oracledb');

// Environment configuration  
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const TABLE_PREFIX = process.env.MCP_TABLE_PREFIX || 'mcp-cognitive-load';

// DynamoDB setup
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Oracle connection (using thin client)
oracledb.initOracleClient();

// PhotoSight intelligence cache table
const PHOTOSIGHT_CACHE_TABLE = `${TABLE_PREFIX}-photosight-intelligence`;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    console.log('Starting PhotoSight intelligence processing...', JSON.stringify(event, null, 2));
    
    const results = {
        analysisInsights: 0,
        qualityTrends: 0,
        equipmentPerformance: 0,
        processingOptimizations: 0,
        errors: [],
        executionTime: 0
    };
    
    const startTime = Date.now();
    
    try {
        // Connect to Oracle
        const connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONNECT_STRING
        });
        
        // Determine processing type
        const processingType = event.processingType || 'full';
        
        switch (processingType) {
            case 'quality_analysis':
                results.analysisInsights = await analyzePhotoQuality(connection);
                break;
            case 'equipment_performance':
                results.equipmentPerformance = await analyzeEquipmentPerformance(connection);
                break;
            case 'processing_optimization':
                results.processingOptimizations = await analyzeProcessingPatterns(connection);
                break;
            case 'full':
            default:
                results.analysisInsights = await analyzePhotoQuality(connection);
                results.equipmentPerformance = await analyzeEquipmentPerformance(connection);
                results.processingOptimizations = await analyzeProcessingPatterns(connection);
                results.qualityTrends = await analyzeQualityTrends(connection);
                break;
        }
        
        await connection.close();
        
        results.executionTime = Date.now() - startTime;
        console.log('PhotoSight intelligence processing completed:', results);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'PhotoSight intelligence processing completed successfully',
                results
            })
        };
        
    } catch (error) {
        console.error('PhotoSight intelligence processing failed:', error);
        results.errors.push(error.message);
        results.executionTime = Date.now() - startTime;
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'PhotoSight intelligence processing failed',
                error: error.message,
                results
            })
        };
    }
};

/**
 * Analyze photo quality patterns and cache insights
 */
async function analyzePhotoQuality(connection) {
    console.log('Analyzing photo quality patterns...');
    
    try {
        // Quality by camera analysis
        const qualityByCamera = await connection.execute(`
            SELECT 
                p.camera_make,
                p.camera_model,
                ROUND(AVG(ar.overall_score), 2) as avg_quality,
                ROUND(AVG(ar.sharpness_score), 2) as avg_sharpness,
                ROUND(AVG(ar.composition_score), 2) as avg_composition,
                COUNT(*) as photo_count
            FROM photosight.photos p
            JOIN photosight.analysis_results ar ON p.id = ar.photo_id
            WHERE p.capture_date > SYSDATE - 30
                AND ar.overall_score IS NOT NULL
            GROUP BY p.camera_make, p.camera_model
            ORDER BY avg_quality DESC
        `);
        
        // Quality trends over time
        const qualityTrends = await connection.execute(`
            SELECT 
                TRUNC(p.capture_date) as capture_day,
                ROUND(AVG(ar.overall_score), 2) as daily_avg_quality,
                COUNT(*) as photos_analyzed,
                ROUND(AVG(ar.processing_time_ms), 0) as avg_processing_time
            FROM photosight.photos p
            JOIN photosight.analysis_results ar ON p.id = ar.photo_id
            WHERE p.capture_date > SYSDATE - 7
                AND ar.overall_score IS NOT NULL
            GROUP BY TRUNC(p.capture_date)
            ORDER BY capture_day DESC
        `);
        
        // Common quality issues
        const qualityIssues = await connection.execute(`
            SELECT 
                CASE 
                    WHEN ar.is_blurry = 1 THEN 'Blurry'
                    WHEN ar.is_overexposed = 1 THEN 'Overexposed'
                    WHEN ar.is_underexposed = 1 THEN 'Underexposed'
                    WHEN ar.has_blown_highlights = 1 THEN 'Blown Highlights'
                    WHEN ar.has_blocked_shadows = 1 THEN 'Blocked Shadows'
                    ELSE 'Good Quality'
                END as quality_issue,
                COUNT(*) as issue_count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
            FROM photosight.analysis_results ar
            WHERE ar.created_at > SYSDATE - 7
            GROUP BY 
                CASE 
                    WHEN ar.is_blurry = 1 THEN 'Blurry'
                    WHEN ar.is_overexposed = 1 THEN 'Overexposed'
                    WHEN ar.is_underexposed = 1 THEN 'Underexposed'
                    WHEN ar.has_blown_highlights = 1 THEN 'Blown Highlights'
                    WHEN ar.has_blocked_shadows = 1 THEN 'Blocked Shadows'
                    ELSE 'Good Quality'
                END
            ORDER BY issue_count DESC
        `);
        
        // Cache the analysis results
        const analysisData = {
            type: 'quality_analysis',
            timestamp: new Date().toISOString(),
            data: {
                qualityByCamera: qualityByCamera.rows,
                qualityTrends: qualityTrends.rows,
                qualityIssues: qualityIssues.rows
            },
            ttl: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes TTL
        };
        
        await docClient.send(new PutCommand({
            TableName: PHOTOSIGHT_CACHE_TABLE,
            Item: {
                cacheKey: 'quality_analysis',
                analysisData: JSON.stringify(analysisData),
                lastUpdated: new Date().toISOString(),
                ttl: analysisData.ttl
            }
        }));
        
        console.log('Quality analysis cached successfully');
        return 1;
        
    } catch (error) {
        console.error('Failed to analyze photo quality:', error);
        throw error;
    }
}

/**
 * Analyze equipment performance patterns
 */
async function analyzeEquipmentPerformance(connection) {
    console.log('Analyzing equipment performance...');
    
    try {
        // Lens performance analysis
        const lensPerformance = await connection.execute(`
            SELECT 
                p.lens_model,
                p.focal_length,
                p.aperture,
                ROUND(AVG(ar.sharpness_score), 2) as avg_sharpness,
                ROUND(AVG(ar.overall_score), 2) as avg_quality,
                COUNT(*) as usage_count
            FROM photosight.photos p
            JOIN photosight.analysis_results ar ON p.id = ar.photo_id
            WHERE p.capture_date > SYSDATE - 30
                AND p.lens_model IS NOT NULL
                AND ar.sharpness_score IS NOT NULL
            GROUP BY p.lens_model, p.focal_length, p.aperture
            HAVING COUNT(*) >= 5
            ORDER BY avg_sharpness DESC
        `);
        
        // ISO performance analysis
        const isoPerformance = await connection.execute(`
            SELECT 
                CASE 
                    WHEN p.iso <= 400 THEN '100-400'
                    WHEN p.iso <= 800 THEN '401-800'
                    WHEN p.iso <= 1600 THEN '801-1600'
                    WHEN p.iso <= 3200 THEN '1601-3200'
                    ELSE '3200+'
                END as iso_range,
                ROUND(AVG(ar.overall_score), 2) as avg_quality,
                ROUND(AVG(ar.noise_level), 3) as avg_noise,
                COUNT(*) as photo_count
            FROM photosight.photos p
            JOIN photosight.analysis_results ar ON p.id = ar.photo_id
            WHERE p.capture_date > SYSDATE - 30
                AND p.iso IS NOT NULL
                AND ar.overall_score IS NOT NULL
            GROUP BY 
                CASE 
                    WHEN p.iso <= 400 THEN '100-400'
                    WHEN p.iso <= 800 THEN '401-800'
                    WHEN p.iso <= 1600 THEN '801-1600'
                    WHEN p.iso <= 3200 THEN '1601-3200'
                    ELSE '3200+'
                END
            ORDER BY avg_quality DESC
        `);
        
        // Cache equipment performance data
        const performanceData = {
            type: 'equipment_performance',
            timestamp: new Date().toISOString(),
            data: {
                lensPerformance: lensPerformance.rows,
                isoPerformance: isoPerformance.rows
            },
            ttl: Math.floor(Date.now() / 1000) + (15 * 60)
        };
        
        await docClient.send(new PutCommand({
            TableName: PHOTOSIGHT_CACHE_TABLE,
            Item: {
                cacheKey: 'equipment_performance',
                analysisData: JSON.stringify(performanceData),
                lastUpdated: new Date().toISOString(),
                ttl: performanceData.ttl
            }
        }));
        
        console.log('Equipment performance analysis cached successfully');
        return 1;
        
    } catch (error) {
        console.error('Failed to analyze equipment performance:', error);
        throw error;
    }
}

/**
 * Analyze processing patterns and optimization opportunities
 */
async function analyzeProcessingPatterns(connection) {
    console.log('Analyzing processing patterns...');
    
    try {
        // Processing time analysis
        const processingTimes = await connection.execute(`
            SELECT 
                ar.analysis_type,
                ROUND(AVG(ar.processing_time_ms), 0) as avg_processing_time,
                ROUND(MIN(ar.processing_time_ms), 0) as min_processing_time,
                ROUND(MAX(ar.processing_time_ms), 0) as max_processing_time,
                COUNT(*) as analysis_count
            FROM photosight.analysis_results ar
            WHERE ar.created_at > SYSDATE - 7
                AND ar.processing_time_ms IS NOT NULL
            GROUP BY ar.analysis_type
            ORDER BY avg_processing_time DESC
        `);
        
        // Processing status distribution  
        const processingStatus = await connection.execute(`
            SELECT 
                p.processing_status,
                COUNT(*) as status_count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
            FROM photosight.photos p
            WHERE p.created_at > SYSDATE - 7
            GROUP BY p.processing_status
            ORDER BY status_count DESC
        `);
        
        // Cache processing optimization data
        const optimizationData = {
            type: 'processing_optimization',
            timestamp: new Date().toISOString(),
            data: {
                processingTimes: processingTimes.rows,
                processingStatus: processingStatus.rows
            },
            recommendations: generateProcessingRecommendations(processingTimes.rows, processingStatus.rows),
            ttl: Math.floor(Date.now() / 1000) + (15 * 60)
        };
        
        await docClient.send(new PutCommand({
            TableName: PHOTOSIGHT_CACHE_TABLE,
            Item: {
                cacheKey: 'processing_optimization',
                analysisData: JSON.stringify(optimizationData),
                lastUpdated: new Date().toISOString(),
                ttl: optimizationData.ttl
            }
        }));
        
        console.log('Processing optimization analysis cached successfully');
        return 1;
        
    } catch (error) {
        console.error('Failed to analyze processing patterns:', error);
        throw error;
    }
}

/**
 * Analyze quality trends for predictive insights
 */
async function analyzeQualityTrends(connection) {
    console.log('Analyzing quality trends...');
    
    try {
        // Weekly quality trends
        const weeklyTrends = await connection.execute(`
            SELECT 
                TO_CHAR(p.capture_date, 'YYYY-IW') as week_year,
                ROUND(AVG(ar.overall_score), 2) as avg_quality,
                ROUND(AVG(ar.sharpness_score), 2) as avg_sharpness,
                COUNT(*) as photos_analyzed
            FROM photosight.photos p
            JOIN photosight.analysis_results ar ON p.id = ar.photo_id
            WHERE p.capture_date > SYSDATE - 56  -- 8 weeks
                AND ar.overall_score IS NOT NULL
            GROUP BY TO_CHAR(p.capture_date, 'YYYY-IW')
            ORDER BY week_year DESC
        `);
        
        // Cache trend analysis
        const trendData = {
            type: 'quality_trends',
            timestamp: new Date().toISOString(),
            data: {
                weeklyTrends: weeklyTrends.rows
            },
            ttl: Math.floor(Date.now() / 1000) + (15 * 60)
        };
        
        await docClient.send(new PutCommand({
            TableName: PHOTOSIGHT_CACHE_TABLE,
            Item: {
                cacheKey: 'quality_trends',
                analysisData: JSON.stringify(trendData),
                lastUpdated: new Date().toISOString(),
                ttl: trendData.ttl
            }
        }));
        
        console.log('Quality trends analysis cached successfully');
        return 1;
        
    } catch (error) {
        console.error('Failed to analyze quality trends:', error);
        throw error;
    }
}

/**
 * Generate processing recommendations based on analysis
 */
function generateProcessingRecommendations(processingTimes, processingStatus) {
    const recommendations = [];
    
    // Processing time recommendations
    const slowAnalysis = processingTimes.filter(pt => pt.AVG_PROCESSING_TIME > 5000);
    if (slowAnalysis.length > 0) {
        recommendations.push({
            type: 'performance',
            priority: 'high',
            issue: `Slow processing detected: ${slowAnalysis.map(sa => sa.ANALYSIS_TYPE).join(', ')}`,
            recommendation: 'Consider optimizing algorithms or increasing compute resources',
            expectedImprovement: '40-60% processing time reduction'
        });
    }
    
    // Status distribution recommendations
    const failedProcessing = processingStatus.find(ps => ps.PROCESSING_STATUS === 'FAILED');
    if (failedProcessing && failedProcessing.PERCENTAGE > 5) {
        recommendations.push({
            type: 'reliability',
            priority: 'medium',
            issue: `High failure rate: ${failedProcessing.PERCENTAGE}% of photos failing processing`,
            recommendation: 'Review error logs and implement retry mechanisms',
            expectedImprovement: 'Reduce failure rate below 2%'
        });
    }
    
    return recommendations;
}