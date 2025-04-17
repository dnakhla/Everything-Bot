import { OpenAI } from 'openai';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from '../services/s3Manager.js';
import { TelegramAPI } from '../services/telegramAPI.js';
import { 
  saveBotMessage,
  getMessagesFromLast24Hours, 
  getMessagesFromLastNhours,
  performGoogleSearch,
  performBraveSearch
} from '../services/messageService.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
});

/**
 * Handle the /clearmessages command
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string|number} request_message_id - The message ID of the command
 * @returns {Promise<void>}
 */
export async function handleClearCommand(chatId, request_message_id) {
  if (!chatId) {
    Logger.log('Invalid chat ID provided to handleClearCommand', 'error');
    return;
  }

  const key = `fact_checker_bot/groups/${chatId}.json`;

  try {
    // Get existing messages
    const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };

    // Filter bot messages and delete them
    const botMessages = existingData.messages.filter((msg) => msg.isBot && msg.messageId);
    const deletePromises = botMessages.map(msg =>
      TelegramAPI.deleteMessage(chatId, msg.messageId)
        .catch(error => Logger.log(`Failed to delete message ${msg.messageId}: ${error.message}`, 'error'))
    );

    await Promise.allSettled(deletePromises);

    // Clear stored messages
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, { messages: [] });

    // Send confirmation message and delete it immediately
    const confirmMessageData = await TelegramAPI.sendMessage(chatId, 'Chat history cleared and bot messages deleted.');
    await TelegramAPI.deleteMessage(chatId, confirmMessageData.message_id);
    Logger.log(`Cleared chat history for chat ID ${chatId}`);
  } catch (error) {
    Logger.log(`Error in handleClearCommand: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get recent messages based on count
 * 
 * @param {string|number} chatId - The chat ID
 * @param {number} numberOfMessages - Number of recent messages to retrieve
 * @returns {Promise<Array>} - Promise that resolves with the messages
 */
async function getRecentMessages(chatId, numberOfMessages = 10) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
        
    Logger.log(`Fetching ${numberOfMessages} recent messages for chat ${chatId}`);
        
    const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
        
    // Get the most recent messages based on count
    const recentMessages = (data?.messages ?? []).slice(-numberOfMessages);
        
    Logger.log(`Found ${recentMessages.length} messages`);
    return recentMessages;
        
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      Logger.log(`No message history found for chat ${chatId}`, 'info');
    } else {
      Logger.log(`Error getting messages: ${error.message}`, 'error');
    }
    return [];
  }
}

/**
 * Handle a query to the Robot
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string} query - The user's query text
 * @param {string|number} request_message_id - The message ID of the request
 * @returns {Promise<void>}
 */
export async function handleRobotQuery(chatId, query, request_message_id) {
  if (!chatId || !query) {
    Logger.log('Invalid input parameters for handleRobotQuery', 'error');
    return;
  }

  let fetchingMessage;
  try {
    fetchingMessage = await TelegramAPI.sendMessage(
      chatId,
      'Processing your question...',
      { reply_to_message_id: request_message_id }
    );

    const messages = await getMessagesFromLast24Hours(chatId);
    const seven_day_conversation = JSON.stringify(await getMessagesFromLastNhours(chatId, 24 * 7));
    const conversation = JSON.stringify(messages);
        
    let webSearchResults;
    let braveSearchResults;
    try {
      webSearchResults = await performGoogleSearch(query);
      braveSearchResults = await performBraveSearch(query);
    } catch (error) {
      Logger.log(`Search failed, continuing without web results: ${error.message}`, 'warn');
      webSearchResults = 'No web search results available.';
      braveSearchResults = 'No Brave search results available.';
    }

    const response = await openai.chat.completions.create({
      model: CONFIG.GPT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a direct messaging assistant in a group chat for guy friends. Keep responses short and mobile-friendly:
                        • Answer in 2-6 short sentences max
                        • Use plain language
                        • Include only essential facts
                        • No formatting - just plain text
                        • If listing items, use simple dashes
                         add brief source links at the end if appropriate. if they ask for a link or if one is needed.
                         add a little sass to the responses if appropriate
                        Remember: Think "text message" length and style.`
        },
        {
          role: 'user', content: `Question: "${query}"

past 24 hours of messages in the groupchat:
${conversation}

Web Search Results:
${webSearchResults}

Brave Search API Results:
${braveSearchResults}

########
past 7 days of messages in the groupchat sent for reference:
${seven_day_conversation}
` }
      ],
      temperature: 0.85,
      max_tokens: CONFIG.MAX_TOKENS
    });

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    const answer = response.choices[0].message.content;
    if (fetchingMessage?.message_id) {
      await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id);
    }

    const sentMessage = await TelegramAPI.sendMessage(chatId, answer);
    await saveBotMessage(chatId, sentMessage);
  } catch (error) {
    Logger.log(`Robot query processing failed: ${error.message}`, 'error');
    if (fetchingMessage?.message_id) {
      await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id).catch(err =>
        Logger.log(`Failed to delete fetching message: ${err.message}`, 'error')
      );
    }
    const errorMessage = 'Sorry, I was unable to process your question at this time. Please try again later.';
    const sentMessage = await TelegramAPI.sendMessage(chatId, errorMessage);
    await saveBotMessage(chatId, sentMessage);
  }
}