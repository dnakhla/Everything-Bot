import { Logger } from './utils/logger.js';
import { CONFIG } from './config.js';
import { saveUserMessage } from './services/messageService.js';
import { handleClearCommand, handleRobotQuery } from './src/commandHandlers.js';

/**
 * AWS Lambda handler function for processing Telegram bot webhook events
 * 
 * @param {object} event - The Lambda event object
 * @returns {object} - The Lambda response object
 */
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
    Logger.log(`Received message from chat ID ${chatId}: ${text}`);

    await handleMessage(chatId, text, body.message);

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

/**
 * Main function to handle incoming messages
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string} text - The message text
 * @param {object} message - The full message object
 * @returns {Promise<void>}
 */
async function handleMessage(chatId, text, message) {
  if (text.startsWith('/clearmessages')) {
    await handleClearCommand(chatId, message.message_id);
  } else if (text.toLowerCase().startsWith('robot,') || text.toLowerCase().startsWith('robot ')) {
    const query = text.slice(text.indexOf(' ')).trim();
    await handleRobotQuery(chatId, query, message.message_id);
  } else {
    await saveUserMessage(chatId, message);
  }
}

// Run the application directly if not imported as a module
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting Telegram Fact Checker Bot...');
  // Add startup logic here if needed
}