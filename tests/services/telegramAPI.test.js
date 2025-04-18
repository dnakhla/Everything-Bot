import { jest } from '@jest/globals';
import { TelegramAPI } from '../../services/telegramAPI.js';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/logger.js', () => ({
  Logger: {
    log: jest.fn()
  }
}));
jest.mock('../../config.js', () => ({
  CONFIG: {
    TELEGRAM_BOT_TOKEN: 'test-token'
  }
}));

describe('TelegramAPI', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('deleteMessage', () => {
    it('should delete a message successfully', async () => {
      // Arrange
      axios.post.mockResolvedValue({ data: { ok: true } });
      
      // Act
      await TelegramAPI.deleteMessage('123456', '789');
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/deleteMessage',
        {
          chat_id: '123456',
          message_id: '789'
        }
      );
    });
    
    it('should throw an error when delete fails', async () => {
      // Arrange
      const error = new Error('Delete failed');
      axios.post.mockRejectedValue(error);
      
      // Act & Assert
      await expect(TelegramAPI.deleteMessage('123456', '789'))
        .rejects.toThrow('Delete failed');
    });
  });
  
  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      // Arrange
      const messageResult = { message_id: 123 };
      axios.post.mockResolvedValue({ 
        data: { 
          ok: true,
          result: messageResult 
        } 
      });
      
      // Act
      const result = await TelegramAPI.sendMessage('123456', 'Test message');
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        {
          chat_id: '123456',
          text: 'Test message',
          parse_mode: 'Markdown'
        }
      );
      expect(result).toEqual(messageResult);
    });
    
    it('should include additional options when provided', async () => {
      // Arrange
      axios.post.mockResolvedValue({ 
        data: { 
          ok: true, 
          result: {} 
        } 
      });
      
      const options = {
        reply_to_message_id: 456,
        disable_notification: true
      };
      
      // Act
      await TelegramAPI.sendMessage('123456', 'Test message', options);
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        {
          chat_id: '123456',
          text: 'Test message',
          parse_mode: 'Markdown',
          reply_to_message_id: 456,
          disable_notification: true
        }
      );
    });
    
    it('should throw an error when send fails', async () => {
      // Arrange
      const error = new Error('Send failed');
      axios.post.mockRejectedValue(error);
      
      // Act & Assert
      await expect(TelegramAPI.sendMessage('123456', 'Test message'))
        .rejects.toThrow('Send failed');
    });
  });
});