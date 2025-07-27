/**
 * PhotoSight Enhanced MCP Tools
 * 
 * Extends the existing AWS unified MCP server with Oracle PhotoSight intelligence
 */

class PhotoSightIntelligenceQuery {
    constructor(dynamoClient, tableName) {
        this.dynamo = dynamoClient;
        this.tableName = tableName;
    }

    /**
     * Get photo quality insights from cached analysis
     */
    async getQualityInsights() {
        try {
            const response = await this.dynamo.send(new GetItemCommand({
                TableName: this.tableName,
                Key: {
                    cacheKey: { S: 'quality_analysis' }
                }
            }));

            if (response.Item && response.Item.analysisData) {
                const data = JSON.parse(response.Item.analysisData.S);
                
                return this.formatQualityReport(data.data);
            }

            return "No quality analysis data available. Run the PhotoSight Lambda function first.";
            
        } catch (error) {
            console.error('Failed to get quality insights:', error);
            return `Error retrieving quality insights: ${error.message}`;
        }
    }

    /**
     * Get equipment performance analysis
     */
    async getEquipmentPerformance() {
        try {
            const response = await this.dynamo.send(new GetItemCommand({
                TableName: this.tableName,
                Key: {
                    cacheKey: { S: 'equipment_performance' }
                }
            }));

            if (response.Item && response.Item.analysisData) {
                const data = JSON.parse(response.Item.analysisData.S);
                
                return this.formatEquipmentReport(data.data);
            }

            return "No equipment performance data available.";
            
        } catch (error) {
            console.error('Failed to get equipment performance:', error);
            return `Error retrieving equipment performance: ${error.message}`;
        }
    }

    /**
     * Get processing optimization recommendations
     */
    async getProcessingOptimizations() {
        try {
            const response = await this.dynamo.send(new GetItemCommand({
                TableName: this.tableName,
                Key: {
                    cacheKey: { S: 'processing_optimization' }
                }
            }));

            if (response.Item && response.Item.analysisData) {
                const data = JSON.parse(response.Item.analysisData.S);
                
                return this.formatOptimizationReport(data.data, data.recommendations);
            }

            return "No processing optimization data available.";
            
        } catch (error) {
            console.error('Failed to get processing optimizations:', error);
            return `Error retrieving processing optimizations: ${error.message}`;
        }
    }

    /**
     * Get comprehensive PhotoSight dashboard
     */
    async getPhotosightDashboard() {
        try {
            const [qualityData, equipmentData, optimizationData] = await Promise.all([
                this.getQualityInsights(),
                this.getEquipmentPerformance(), 
                this.getProcessingOptimizations()
            ]);

            return `# PhotoSight Intelligence Dashboard

## 📊 Photo Quality Analysis
${qualityData}

## 📷 Equipment Performance  
${equipmentData}

## ⚡ Processing Optimizations
${optimizationData}

---
*Data refreshed automatically every 15 minutes*
*Powered by AWS Cognitive Load Reducer + Oracle Analytics*`;

        } catch (error) {
            console.error('Failed to generate dashboard:', error);
            return `Error generating dashboard: ${error.message}`;
        }
    }

    /**
     * Format quality analysis report
     */
    formatQualityReport(data) {
        let report = "## Photo Quality Summary (Last 30 Days)\n\n";
        
        // Camera performance
        if (data.qualityByCamera && data.qualityByCamera.length > 0) {
            report += "### 📷 Quality by Camera\n";
            data.qualityByCamera.slice(0, 5).forEach(camera => {
                report += `- **${camera.CAMERA_MAKE} ${camera.CAMERA_MODEL}**: ${camera.AVG_QUALITY}/10 quality (${camera.PHOTO_COUNT} photos)\n`;
                report += `  - Sharpness: ${camera.AVG_SHARPNESS}/10\n`;
                report += `  - Composition: ${camera.AVG_COMPOSITION}/10\n\n`;
            });
        }
        
        // Quality issues
        if (data.qualityIssues && data.qualityIssues.length > 0) {
            report += "### ⚠️ Common Quality Issues\n";
            data.qualityIssues.forEach(issue => {
                if (issue.QUALITY_ISSUE !== 'Good Quality') {
                    report += `- **${issue.QUALITY_ISSUE}**: ${issue.ISSUE_COUNT} photos (${issue.PERCENTAGE}%)\n`;
                }
            });
            report += "\n";
        }

        // Daily trends
        if (data.qualityTrends && data.qualityTrends.length > 0) {
            report += "### 📈 Recent Quality Trends\n";
            data.qualityTrends.slice(0, 7).forEach(trend => {
                const date = new Date(trend.CAPTURE_DAY).toLocaleDateString();
                report += `- **${date}**: ${trend.DAILY_AVG_QUALITY}/10 average (${trend.PHOTOS_ANALYZED} photos, ${trend.AVG_PROCESSING_TIME}ms avg processing)\n`;
            });
        }

        return report;
    }

    /**
     * Format equipment performance report
     */
    formatEquipmentReport(data) {
        let report = "## Equipment Performance Analysis\n\n";

        // Lens performance
        if (data.lensPerformance && data.lensPerformance.length > 0) {
            report += "### 🔍 Top Performing Lenses\n";
            data.lensPerformance.slice(0, 5).forEach(lens => {
                report += `- **${lens.LENS_MODEL}** @ ${lens.FOCAL_LENGTH}mm f/${lens.APERTURE}\n`;
                report += `  - Sharpness: ${lens.AVG_SHARPNESS}/10\n`;
                report += `  - Overall Quality: ${lens.AVG_QUALITY}/10\n`;
                report += `  - Usage: ${lens.USAGE_COUNT} photos\n\n`;
            });
        }

        // ISO performance
        if (data.isoPerformance && data.isoPerformance.length > 0) {
            report += "### 📶 ISO Performance Analysis\n";
            data.isoPerformance.forEach(iso => {
                report += `- **ISO ${iso.ISO_RANGE}**: ${iso.AVG_QUALITY}/10 quality, ${iso.AVG_NOISE} noise level (${iso.PHOTO_COUNT} photos)\n`;
            });
        }

        return report;
    }

    /**
     * Format processing optimization report
     */
    formatOptimizationReport(data, recommendations) {
        let report = "## Processing Performance & Optimization\n\n";

        // Processing times
        if (data.processingTimes && data.processingTimes.length > 0) {
            report += "### ⏱️ Processing Performance\n";
            data.processingTimes.forEach(proc => {
                report += `- **${proc.ANALYSIS_TYPE}**: ${proc.AVG_PROCESSING_TIME}ms average (${proc.ANALYSIS_COUNT} analyses)\n`;
                report += `  - Range: ${proc.MIN_PROCESSING_TIME}ms - ${proc.MAX_PROCESSING_TIME}ms\n`;
            });
            report += "\n";
        }

        // Processing status
        if (data.processingStatus && data.processingStatus.length > 0) {
            report += "### 📊 Processing Status Distribution\n";
            data.processingStatus.forEach(status => {
                const emoji = status.PROCESSING_STATUS === 'COMPLETED' ? '✅' : 
                             status.PROCESSING_STATUS === 'FAILED' ? '❌' : '⏳';
                report += `- ${emoji} **${status.PROCESSING_STATUS}**: ${status.STATUS_COUNT} photos (${status.PERCENTAGE}%)\n`;
            });
            report += "\n";
        }

        // Recommendations
        if (recommendations && recommendations.length > 0) {
            report += "### 💡 Optimization Recommendations\n";
            recommendations.forEach(rec => {
                const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
                report += `${priorityEmoji} **${rec.type.toUpperCase()}** - ${rec.issue}\n`;
                report += `   *Recommendation*: ${rec.recommendation}\n`;
                report += `   *Expected Improvement*: ${rec.expectedImprovement}\n\n`;
            });
        }

        return report;
    }
}

// Export the enhanced PhotoSight tools
module.exports = {
    PhotoSightIntelligenceQuery
};