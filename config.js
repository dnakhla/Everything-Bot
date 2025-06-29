import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application-wide configuration
 */
export const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  MAX_TOKENS: 350,
  GPT_MODEL: process.env.GPT_MODEL || 'gpt-4.1',
  MESSAGE_LIMIT: 1000,
  DEFAULT_SENSITIVITY: 75,
  SERPER_API_KEY: process.env.SERPER_API_KEY,
  BRAVE_API_KEY: process.env.BRAVE_API_KEY,
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '1716676964', // Default to your chat ID
  GA_API_SECRET: process.env.GA_API_SECRET || '8vyVGizNTr2EvXWqlMQHUg',
  
  // Feature flags
  ENABLE_BROWSER_TOOL: process.env.ENABLE_BROWSER_TOOL === 'true',
};