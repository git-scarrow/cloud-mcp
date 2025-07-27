exports.handler = async (event) => {
    console.log('Processing edge data:', JSON.stringify(event, null, 2));
    
    try {
        // For now, just log the event
        const record = event.Records[0];
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        
        console.log(`Received upload: ${bucket}/${key}`);
        
        // Extract device ID from key path
        const pathParts = key.split('/');
        const deviceId = pathParts[1] || 'unknown';
        
        console.log(`Device: ${deviceId}, Key: ${key}, Size: ${record.s3.object.size}`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Success',
                device: deviceId,
                key: key
            })
        };
    } catch (error) {
        console.error('Error processing edge data:', error);
        throw error;
    }
};