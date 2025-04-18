import { Readable } from 'stream';
import { jest } from '@jest/globals';
import { streamToString } from '../../utils/utils.js';

describe('Utils', () => {
  describe('streamToString', () => {
    it('should convert a stream to a string', async () => {
      // Arrange
      const testString = 'test data';
      const stream = Readable.from([testString]);
      
      // Act
      const result = await streamToString(stream);
      
      // Assert
      expect(result).toBe(testString);
    });
    
    it('should handle empty streams', async () => {
      // Arrange
      const stream = Readable.from(['']);
      
      // Act
      const result = await streamToString(stream);
      
      // Assert
      expect(result).toBe('');
    });
    
    it('should reject on stream error', async () => {
      // Arrange
      const mockStream = new Readable({
        read() {} // Empty read implementation
      });
      
      // Act & Assert
      const promise = streamToString(mockStream);
      mockStream.emit('error', new Error('Test error'));
      
      await expect(promise).rejects.toThrow('Test error');
    });
  });
});