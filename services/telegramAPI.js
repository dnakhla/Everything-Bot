import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * TelegramAPI service for interacting with the Telegram Bot API
 */
export const TelegramAPI = {
  /**
     * Delete a message from a chat
     * 
     * @param {string|number} chatId - The chat ID 
     * @param {string|number} messageId - The message ID to delete
     * @returns {Promise<void>} - Promise that resolves when the message is deleted
     */
  deleteMessage: async (chatId, messageId) => {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/deleteMessage`;
    try {
      await axios.post(url, {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (error) {
      Logger.log(`Failed to delete message: ${error.message}`, 'error');
      throw error;
    }
  },
    
  /**
     * Send a message to a chat
     * 
     * @param {string|number} chatId - The chat ID
     * @param {string} text - The message text
     * @param {object} options - Additional options (reply_to_message_id, etc)
     * @returns {Promise<object>} - Promise that resolves with the sent message data
     */
  sendMessage: async (chatId, text, options = {}) => {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
      const response = await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        ...options
      });
      Logger.log(`Message sent to chat ID ${chatId}`);
      return response.data.result; // Return the message data
    } catch (error) {
      Logger.log(`Failed to send message: ${error.message}`, 'error');
      throw error;
    }
  },
  
  /**
     * Edit the text of an existing message
     * 
     * @param {string|number} chatId - The chat ID
     * @param {string|number} messageId - The message ID to edit
     * @param {string} text - The new text for the message
     * @param {object} options - Additional options
     * @returns {Promise<object>} - Promise that resolves with the edited message data
     */
  editMessageText: async (chatId, messageId, text, options = {}) => {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/editMessageText`;
    try {
      const response = await axios.post(url, {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        ...options
      });
      Logger.log(`Message ${messageId} edited in chat ID ${chatId}`);
      return response.data.result; // Return the edited message data
    } catch (error) {
      Logger.log(`Failed to edit message: ${error.message}`, 'error');
      // Fail silently as requested
      return null;
    }
  },
};