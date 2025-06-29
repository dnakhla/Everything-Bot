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

  /**
   * Get file information from Telegram
   * 
   * @param {string} fileId - The file ID from Telegram
   * @returns {Promise<object>} - Promise that resolves with file info
   */
  getFile: async (fileId) => {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getFile`;
    try {
      const response = await axios.post(url, {
        file_id: fileId
      });
      Logger.log(`Got file info for file ID: ${fileId}`);
      return response.data.result;
    } catch (error) {
      Logger.log(`Failed to get file info: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * Send an audio file to a chat
   * 
   * @param {string|number} chatId - The chat ID
   * @param {Buffer} audioBuffer - The audio file buffer
   * @param {object} options - Additional options (caption, duration, etc)
   * @returns {Promise<object>} - Promise that resolves with the sent message data
   */
  sendAudio: async (chatId, audioBuffer, options = {}) => {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendAudio`;
    
    // Create form data for file upload
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    form.append('chat_id', chatId);
    form.append('audio', audioBuffer, {
      filename: options.filename || 'audio.wav',
      contentType: options.contentType || 'audio/wav'
    });
    
    if (options.caption) form.append('caption', options.caption);
    if (options.duration) form.append('duration', options.duration);
    if (options.performer) form.append('performer', options.performer);
    if (options.title) form.append('title', options.title);
    if (options.reply_to_message_id) form.append('reply_to_message_id', options.reply_to_message_id);
    if (options.parse_mode) form.append('parse_mode', options.parse_mode);

    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 60000 // 1 minute timeout for file upload
      });
      Logger.log(`Audio sent to chat ID ${chatId}`);
      return response.data.result;
    } catch (error) {
      Logger.log(`Failed to send audio: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * Send a voice message to a chat
   * 
   * @param {string|number} chatId - The chat ID
   * @param {Buffer} voiceBuffer - The voice file buffer (OGG format preferred)
   * @param {object} options - Additional options (caption, duration, etc)
   * @returns {Promise<object>} - Promise that resolves with the sent message data
   */
  sendVoice: async (chatId, voiceBuffer, options = {}) => {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendVoice`;
    
    // Create form data for file upload
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    form.append('chat_id', chatId);
    form.append('voice', voiceBuffer, {
      filename: options.filename || 'voice.ogg',
      contentType: options.contentType || 'audio/ogg'
    });
    
    if (options.caption) form.append('caption', options.caption);
    if (options.duration) form.append('duration', options.duration);
    if (options.reply_to_message_id) form.append('reply_to_message_id', options.reply_to_message_id);
    if (options.parse_mode) form.append('parse_mode', options.parse_mode);

    try {
      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 60000 // 1 minute timeout for file upload
      });
      Logger.log(`Voice message sent to chat ID ${chatId}`);
      return response.data.result;
    } catch (error) {
      Logger.log(`Failed to send voice message: ${error.message}`, 'error');
      throw error;
    }
  },
};