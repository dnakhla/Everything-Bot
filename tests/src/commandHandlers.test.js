import { jest } from '@jest/globals';
import { handleClearCommand, handleRobotQuery } from '../../src/commandHandlers.js';

// Mock dependencies
jest.mock('openai');
jest.mock('../../utils/logger.js', () => ({
  Logger: {
    log: jest.fn()
  }
}));
jest.mock('../../config.js', () => ({
  CONFIG: {
    S3_BUCKET_NAME: 'test-bucket',
    MAX_TOKENS: 350,
    GPT_MODEL: 'test-model'
  }
}));
jest.mock('../../services/s3Manager.js');
jest.mock('../../services/telegramAPI.js');
jest.mock('../../services/messageService.js');

// Import mocks after they've been set up
import { S3Manager } from '../../services/s3Manager.js';
import { TelegramAPI } from '../../services/telegramAPI.js';
import * as messageService from '../../services/messageService.js';
import { OpenAI } from 'openai';

describe('Command Handlers', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('handleClearCommand', () => {
    it('should clear messages and delete bot messages', async () => {
      // Arrange
      const chatId = '123456';
      const messageId = '789';
      
      const mockMessages = [
        { isBot: true, messageId: 101 },
        { isBot: false, messageId: 102 },
        { isBot: true, messageId: 103 }
      ];
      
      S3Manager.getFromS3 = jest.fn().mockResolvedValue({ messages: mockMessages });
      S3Manager.saveToS3 = jest.fn().mockResolvedValue({});
      TelegramAPI.deleteMessage = jest.fn().mockResolvedValue({});
      TelegramAPI.sendMessage = jest.fn().mockResolvedValue({ message_id: 999 });
      
      // Act
      await handleClearCommand(chatId, messageId);
      
      // Assert
      expect(S3Manager.getFromS3).toHaveBeenCalledWith('test-bucket', 'fact_checker_bot/groups/123456.json');
      expect(TelegramAPI.deleteMessage).toHaveBeenCalledTimes(3); // 2 bot messages + 1 confirmation
      expect(S3Manager.saveToS3).toHaveBeenCalledWith('test-bucket', 'fact_checker_bot/groups/123456.json', { messages: [] });
    });
    
    it('should handle empty messages array', async () => {
      // Arrange
      S3Manager.getFromS3 = jest.fn().mockResolvedValue({ messages: [] });
      S3Manager.saveToS3 = jest.fn().mockResolvedValue({});
      TelegramAPI.sendMessage = jest.fn().mockResolvedValue({ message_id: 999 });
      TelegramAPI.deleteMessage = jest.fn().mockResolvedValue({});
      
      // Act
      await handleClearCommand('123456', '789');
      
      // Assert
      expect(TelegramAPI.deleteMessage).toHaveBeenCalledTimes(1); // Only confirmation message
      expect(S3Manager.saveToS3).toHaveBeenCalledWith('test-bucket', 'fact_checker_bot/groups/123456.json', { messages: [] });
    });
    
    it('should handle null response from S3', async () => {
      // Arrange
      S3Manager.getFromS3 = jest.fn().mockResolvedValue(null);
      S3Manager.saveToS3 = jest.fn().mockResolvedValue({});
      TelegramAPI.sendMessage = jest.fn().mockResolvedValue({ message_id: 999 });
      TelegramAPI.deleteMessage = jest.fn().mockResolvedValue({});
      
      // Act
      await handleClearCommand('123456', '789');
      
      // Assert
      expect(TelegramAPI.deleteMessage).toHaveBeenCalledTimes(1); // Only confirmation message
      expect(S3Manager.saveToS3).toHaveBeenCalledWith('test-bucket', 'fact_checker_bot/groups/123456.json', { messages: [] });
    });
  });
  
  describe('handleRobotQuery', () => {
    it('should process query and send a response', async () => {
      // Arrange
      const chatId = '123456';
      const query = 'test query';
      const requestMessageId = '789';
      const fetchingMessageId = { message_id: 100 };
      const sentMessageId = { message_id: 101 };
      
      TelegramAPI.sendMessage = jest.fn()
        .mockResolvedValueOnce(fetchingMessageId)  // First call for "Processing..." message
        .mockResolvedValueOnce(sentMessageId);     // Second call for actual response
      
      TelegramAPI.deleteMessage = jest.fn().mockResolvedValue({});
      
      messageService.getMessagesFromLast24Hours = jest.fn().mockResolvedValue([]);
      messageService.getMessagesFromLastNhours = jest.fn().mockResolvedValue([]);
      messageService.performGoogleSearch = jest.fn().mockResolvedValue('Google results');
      messageService.performBraveSearch = jest.fn().mockResolvedValue('Brave results');
      messageService.saveBotMessage = jest.fn().mockResolvedValue({});
      
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response'
            }
          }
        ]
      };
      
      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      };
      
      // Act
      await handleRobotQuery(chatId, query, requestMessageId);
      
      // Assert
      expect(TelegramAPI.sendMessage).toHaveBeenCalledTimes(2);
      expect(TelegramAPI.deleteMessage).toHaveBeenCalledWith(chatId, 100);
      expect(messageService.saveBotMessage).toHaveBeenCalledWith(chatId, sentMessageId);
    });
    
    it('should handle errors in processing', async () => {
      // Arrange
      const chatId = '123456';
      const query = 'test query';
      const requestMessageId = '789';
      const fetchingMessageId = { message_id: 100 };
      const errorResponseId = { message_id: 101 };
      
      TelegramAPI.sendMessage = jest.fn()
        .mockResolvedValueOnce(fetchingMessageId)
        .mockResolvedValueOnce(errorResponseId);
      
      TelegramAPI.deleteMessage = jest.fn().mockResolvedValue({});
      
      const error = new Error('Processing error');
      OpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(error)
        }
      };
      
      messageService.getMessagesFromLast24Hours = jest.fn().mockResolvedValue([]);
      messageService.getMessagesFromLastNhours = jest.fn().mockResolvedValue([]);
      messageService.performGoogleSearch = jest.fn().mockResolvedValue('Google results');
      messageService.performBraveSearch = jest.fn().mockResolvedValue('Brave results');
      messageService.saveBotMessage = jest.fn().mockResolvedValue({});
      
      // Act
      await handleRobotQuery(chatId, query, requestMessageId);
      
      // Assert
      expect(TelegramAPI.deleteMessage).toHaveBeenCalledWith(chatId, 100);
      expect(TelegramAPI.sendMessage).toHaveBeenCalledWith(
        chatId, 
        'Sorry, I was unable to process your question at this time. Please try again later.'
      );
      expect(messageService.saveBotMessage).toHaveBeenCalledWith(chatId, errorResponseId);
    });
  });
});