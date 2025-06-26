import { Logger } from './utils/logger.js';
import { CONFIG } from './config.js';
import { handleMessage } from './src/commandHandlers.js';

/**
 * AWS Lambda handler function for processing Telegram bot webhook events
 * 
 * @param {object} event - The Lambda event object
 * @returns {object} - The Lambda response object
 */
// Simple in-memory cache for processed messages (resets on cold start)
const processedMessages = new Set();

export const handler = async (event) => {
  try {
    Logger.log(`Received event: ${JSON.stringify(event)}`);

    const body = parseRequestBody(event);
    Logger.log(`Parsed body: ${JSON.stringify(body)}`);

    if (!body.message) {
      Logger.log('No message found in the incoming event.', 'error');
      return createResponse(200, { status: 'No action taken' });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text || '';
    const messageId = body.message.message_id;
    
    Logger.log(`Received message from chat ID ${chatId}: ${text} (message_id: ${messageId})`);

    // Check for duplicate message processing
    const messageKey = `${chatId}:${messageId}`;
    if (processedMessages.has(messageKey)) {
      Logger.log(`Duplicate message detected: ${messageKey}, skipping processing`);
      return createResponse(200, { status: 'Duplicate message ignored' });
    }
    
    // Mark message as being processed
    processedMessages.add(messageKey);
    
    // Clean up old entries (keep only last 100 to prevent memory leaks)
    if (processedMessages.size > 100) {
      const entries = Array.from(processedMessages);
      entries.slice(0, 50).forEach(entry => processedMessages.delete(entry));
    }

    // Trim message object to only essential fields
    const trimmedMessage = trimMessageObject(body.message);

    await handleMessage(chatId, text, trimmedMessage);

    return createResponse(200, { status: 'Success' });
  } catch (error) {
    Logger.log(`Lambda handler error: ${error.message}`, 'error');
    return createResponse(500, { status: 'Error', message: error.message });
  }
};

/**
 * Helper function to parse the request body from a Lambda event
 * 
 * @param {object} event - The Lambda event object
 * @returns {object} - The parsed request body
 */
function parseRequestBody(event) {
  if (event.body) {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  }
  return event;
}

/**
 * Helper function to trim message object to only essential fields
 * 
 * @param {object} message - The full message object from Telegram
 * @returns {object} - The trimmed message object
 */
function trimMessageObject(message) {
  return {
    message_id: message.message_id,
    from: {
      id: message.from?.id,
      first_name: message.from?.first_name,
      username: message.from?.username
    },
    chat: {
      id: message.chat?.id,
      title: message.chat?.title,
      type: message.chat?.type
    },
    date: message.date,
    text: message.text
  };
}

/**
 * Helper function to create an HTTP response for Lambda
 * 
 * @param {number} statusCode - The HTTP status code
 * @param {object} body - The response body
 * @returns {object} - The formatted response object
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}


// Run the application directly if not imported as a module
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting Telegram Fact Checker Bot...');
  // Add startup logic here if needed
}