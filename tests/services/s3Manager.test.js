import { jest } from '@jest/globals';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Manager } from '../../services/s3Manager.js';
import { Readable } from 'stream';

// Mock dependencies
jest.mock('@aws-sdk/client-s3');
jest.mock('../../utils/logger.js', () => ({
  Logger: {
    log: jest.fn()
  }
}));

describe('S3Manager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('saveToS3', () => {
    it('should save data to S3 successfully', async () => {
      // Arrange
      const mockSend = jest.fn().mockResolvedValue({});
      S3Client.prototype.send = mockSend;
      
      const bucket = 'test-bucket';
      const key = 'test-key';
      const data = { test: 'data' };
      
      // Act
      await S3Manager.saveToS3(bucket, key, data);
      
      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      
      // Verify PutObjectCommand was constructed with correct params
      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input).toEqual({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: 'application/json'
      });
    });
    
    it('should throw an error when S3 save fails', async () => {
      // Arrange
      const mockError = new Error('S3 save error');
      S3Client.prototype.send = jest.fn().mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(S3Manager.saveToS3('bucket', 'key', {}))
        .rejects.toThrow('S3 save error');
    });
  });
  
  describe('getFromS3', () => {
    it('should get data from S3 successfully', async () => {
      // Arrange
      const testData = { test: 'data' };
      const mockBody = Readable.from([JSON.stringify(testData)]);
      
      S3Client.prototype.send = jest.fn().mockResolvedValue({
        Body: mockBody
      });
      
      // Act
      const result = await S3Manager.getFromS3('test-bucket', 'test-key');
      
      // Assert
      expect(S3Client.prototype.send).toHaveBeenCalledWith(
        expect.any(GetObjectCommand)
      );
      expect(result).toEqual(testData);
    });
    
    it('should return null for NoSuchKey error', async () => {
      // Arrange
      const error = new Error('No such key');
      error.name = 'NoSuchKey';
      S3Client.prototype.send = jest.fn().mockRejectedValue(error);
      
      // Act
      const result = await S3Manager.getFromS3('test-bucket', 'test-key');
      
      // Assert
      expect(result).toBeNull();
    });
    
    it('should return null for 404 error', async () => {
      // Arrange
      const error = new Error('Not found');
      error.$metadata = { httpStatusCode: 404 };
      S3Client.prototype.send = jest.fn().mockRejectedValue(error);
      
      // Act
      const result = await S3Manager.getFromS3('test-bucket', 'test-key');
      
      // Assert
      expect(result).toBeNull();
    });
    
    it('should throw other errors', async () => {
      // Arrange
      const error = new Error('Internal error');
      S3Client.prototype.send = jest.fn().mockRejectedValue(error);
      
      // Act & Assert
      await expect(S3Manager.getFromS3('test-bucket', 'test-key'))
        .rejects.toThrow('Internal error');
    });
  });
});