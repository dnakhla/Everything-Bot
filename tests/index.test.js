import { jest } from '@jest/globals';
import { handler } from '../index.js';

// Mock dependencies
jest.mock('../utils/logger.js', () => ({
  Logger: {
    log: jest.fn()
  }
}));
jest.mock('../services/messageService.js', () => ({
  saveUserMessage: jest.fn().mockResolvedValue({})
}));
jest.mock('../src/commandHandlers.js', () => ({
  handleClearCommand: jest.fn().mockResolvedValue({}),
  handleRobotQuery: jest.fn().mockResolvedValue({})
}));

// Import mocks after they've been set up
import { saveUserMessage } from '../services/messageService.js';
import { handleClearCommand, handleRobotQuery } from '../src/commandHandlers.js';

describe('Lambda Handler', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  it('should process user messages correctly', async () => {
    // Arrange
    const event = {
      body: JSON.stringify({
        message: {
          chat: {
            id: '123456'
          },
          text: 'Hello world',
          message_id: '789',
          from: {
            first_name: 'Test User'
          }
        }
      })
    };
    
    // Act
    const response = await handler(event);
    
    // Assert
    expect(response.statusCode).toBe(200);
    expect(saveUserMessage).toHaveBeenCalledWith('123456', expect.objectContaining({
      message_id: '789',
      text: 'Hello world'
    }));
  });
  
  it('should process clear command correctly', async () => {
    // Arrange
    const event = {
      body: JSON.stringify({
        message: {
          chat: {
            id: '123456'
          },
          text: '/clearmessages',
          message_id: '789',
          from: {
            first_name: 'Test User'
          }
        }
      })
    };
    
    // Act
    const response = await handler(event);
    
    // Assert
    expect(response.statusCode).toBe(200);
    expect(handleClearCommand).toHaveBeenCalledWith('123456', '789');
    expect(saveUserMessage).not.toHaveBeenCalled();
  });
  
  it('should process robot query correctly', async () => {
    // Arrange
    const event = {
      body: JSON.stringify({
        message: {
          chat: {
            id: '123456'
          },
          text: 'robot, tell me a joke',
          message_id: '789',
          from: {
            first_name: 'Test User'
          }
        }
      })
    };
    
    // Act
    const response = await handler(event);
    
    // Assert
    expect(response.statusCode).toBe(200);
    expect(handleRobotQuery).toHaveBeenCalledWith('123456', 'tell me a joke', '789');
    expect(saveUserMessage).not.toHaveBeenCalled();
  });
  
  it('should handle missing message gracefully', async () => {
    // Arrange
    const event = {
      body: JSON.stringify({})
    };
    
    // Act
    const response = await handler(event);
    
    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'No action taken' });
  });
  
  it('should handle errors gracefully', async () => {
    // Arrange
    const errorMessage = 'Test error';
    saveUserMessage.mockRejectedValueOnce(new Error(errorMessage));
    
    const event = {
      body: JSON.stringify({
        message: {
          chat: {
            id: '123456'
          },
          text: 'Hello world',
          message_id: '789',
          from: {
            first_name: 'Test User'
          }
        }
      })
    };
    
    // Act
    const response = await handler(event);
    
    // Assert
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ 
      status: 'Error', 
      message: errorMessage 
    });
  });
});