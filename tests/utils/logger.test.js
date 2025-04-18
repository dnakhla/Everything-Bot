import { jest } from '@jest/globals';
import { Logger } from '../../utils/logger.js';

describe('Logger', () => {
  let consoleInfoSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;
  
  beforeEach(() => {
    // Mock console methods
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore original console methods
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
  
  it('should log messages with info level by default', () => {
    // Act
    Logger.log('Test message');
    
    // Assert
    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(consoleInfoSpy.mock.calls[0][0]).toMatch(/\[.*\] Test message/);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
  
  it('should log messages with specified level', () => {
    // Act
    Logger.log('Error message', 'error');
    
    // Assert
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toMatch(/\[.*\] Error message/);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });
  
  it('should handle invalid log levels', () => {
    // Act
    Logger.log('Invalid level message', 'invalidLevel');
    
    // Assert
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy.mock.calls[0][0]).toMatch(/Invalid log level/);
    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(consoleInfoSpy.mock.calls[0][0]).toMatch(/\[.*\] Invalid level message/);
  });
});