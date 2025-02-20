require('dotenv').config();

const CONFIG = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    AWS_REGION: process.env.AWS_REGION,
    MAX_TOKENS: 350,
    GPT_MODEL: 'gpt-4o',
    MESSAGE_LIMIT: 1000,
    DEFAULT_SENSITIVITY: 75,
};

// Validate Environment Variables
function validateConfig() {
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY', 'S3_BUCKET_NAME', 'AWS_REGION'];
    requiredVars.forEach((key) => {
        if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
    });
}

validateConfig();

module.exports = { CONFIG };