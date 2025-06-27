import { Logger } from './utils/logger.js';
import { CONFIG } from './config.js';
import { handleMessage, handleBotAddedToChat } from './src/commandHandlers.js';
import { isMessageProcessed, markMessageAsProcessed } from './services/messageService.js';

export const handler = async (event) => {
  try {
    Logger.log(`Received event: ${JSON.stringify(event)}`);

    const body = parseRequestBody(event);
    Logger.log(`Parsed body: ${JSON.stringify(body)}`);

    if (!body.message) {
      Logger.log('No message found in the incoming event.', 'error');
      return createResponse(200, { status: 'No action taken' });
    }

    // Check if bot was added to a new chat
    if (body.message.new_chat_members) {
      const botUser = body.message.new_chat_members.find(member => member.is_bot && member.username);
      if (botUser) {
        Logger.log(`Bot added to new chat: ${body.message.chat.id}`);
        await handleBotAddedToChat(body.message.chat.id, body.message.chat);
        return createResponse(200, { status: 'Bot introduction sent' });
      }
    }

    const chatId = body.message.chat.id;
    const text = body.message.text || '';
    const messageId = body.message.message_id;
    
    Logger.log(`Received message from chat ID ${chatId}: ${text} (message_id: ${messageId})`);

    // Check for duplicate message processing using persistent storage
    if (await isMessageProcessed(chatId, messageId)) {
      Logger.log(`Duplicate message detected: ${chatId}:${messageId}, skipping processing`);
      return createResponse(200, { status: 'Duplicate message ignored' });
    }
    
    // Mark message as being processed persistently
    await markMessageAsProcessed(chatId, messageId);

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
  const trimmed = {
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
    text: message.text,
    caption: message.caption
  };

  // Preserve file attachments
  if (message.photo) trimmed.photo = message.photo;
  if (message.document) trimmed.document = message.document;
  if (message.audio) trimmed.audio = message.audio;
  if (message.voice) trimmed.voice = message.voice;
  if (message.video) trimmed.video = message.video;
  if (message.video_note) trimmed.video_note = message.video_note;
  if (message.sticker) trimmed.sticker = message.sticker;
  if (message.animation) trimmed.animation = message.animation;

  return trimmed;
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