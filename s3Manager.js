const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Logger } = require('./logger');
const { CONFIG } = require('./config');
const { streamToString } = require('./utils');

const s3 = new S3Client({ region: CONFIG.AWS_REGION });

const S3Manager = {
    saveToS3: async (bucket, key, data) => {
        try {
            await s3.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: JSON.stringify(data),
                    ContentType: 'application/json',
                })
            );
        } catch (error) {
            Logger.log(`Failed to save to S3: ${error.message}`, 'error');
            throw error;
        }
    },

    getFromS3: async (bucket, key) => {
        try {
            const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const bodyString = await streamToString(response.Body);
            return JSON.parse(bodyString);
        } catch (error) {
            if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
            Logger.log(`Error getting from S3: ${error.message}`, 'error');
            throw error;
        }
    },
};

module.exports = { S3Manager };