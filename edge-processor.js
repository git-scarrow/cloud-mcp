const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('Processing edge data:', JSON.stringify(event, null, 2));
    
    try {
        // Parse S3 event
        const record = event.Records[0];
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        
        // Extract device ID from key path
        const pathParts = key.split('/');
        const deviceId = pathParts[1] || 'unknown';
        
        // Process only if it's important data
        if (key.includes('essential') || key.includes('errors') || key.includes('alerts')) {
            // Store in DynamoDB
            const command = new PutCommand({
                TableName: 'edge-device-state',
                Item: {
                    deviceId: deviceId,
                    timestamp: Date.now(),
                    eventType: record.eventName,
                    bucket: bucket,
                    key: key,
                    size: record.s3.object.size,
                    lastSeen: new Date().toISOString()
                }
            });
            
            await dynamodb.send(command);
            
            console.log(`Stored edge data for device: ${deviceId}`);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Success' })
        };
    } catch (error) {
        console.error('Error processing edge data:', error);
        throw error;
    }
};