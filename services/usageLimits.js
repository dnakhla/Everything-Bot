/**
 * Usage Limits Service - Simple daily limits stored in chat directories
 * 
 * This service manages daily usage limits for expensive operations,
 * storing usage counts in the same S3 directory structure as chat messages.
 */

import { S3Manager } from './s3Manager.js';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Daily limits for different operations
 */
const DAILY_LIMITS = {
  AUDIO_GENERATION: 5, // Max 5 audio generations per user per day
  SEARCH_QUERIES: 100 // Max 100 search queries per user per day
};

/**
 * Check if user has exceeded daily limit for a specific operation
 * @param {string} chatId - Chat/User ID
 * @param {string} operation - Operation type (AUDIO_GENERATION, BROWSER_AUTOMATION, etc.)
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: string}>}
 */
export async function checkDailyLimit(chatId, operation) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const usageKey = `fact_checker_bot/groups/${chatId}/usage/${today}.json`;
  const limit = DAILY_LIMITS[operation] || 10; // Default limit if not specified
  
  // Calculate reset time (midnight UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const resetTime = tomorrow.toISOString();
  
  try {
    // Idempotent check: Always try to get current usage, fallback gracefully
    let currentCount = 0;
    
    try {
      const usageData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, usageKey);
      if (usageData && typeof usageData === 'object' && typeof usageData[operation] === 'number') {
        currentCount = usageData[operation];
      }
    } catch (error) {
      // File doesn't exist or is invalid - treat as zero usage (idempotent)
      currentCount = 0;
    }
    
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;
    
    Logger.log(`Usage check for ${chatId} - ${operation}: ${currentCount}/${limit} (${remaining} remaining)`);
    
    return {
      allowed,
      remaining,
      resetTime,
      currentCount,
      limit
    };
    
  } catch (error) {
    Logger.log(`Error checking daily limit: ${error.message}`, 'error');
    // On error, fail open (allow operation) - idempotent fallback
    return {
      allowed: true,
      remaining: limit,
      resetTime: resetTime,
      currentCount: 0,
      limit: limit
    };
  }
}

/**
 * Record usage of an operation
 * @param {string} chatId - Chat/User ID
 * @param {string} operation - Operation type
 * @returns {Promise<void>}
 */
export async function recordUsage(chatId, operation) {
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `fact_checker_bot/groups/${chatId}/usage/${today}.json`;
  
  try {
    // Idempotent upsert: Get current usage or create default structure
    let currentUsage = {
      date: today,
      chatId: chatId,
      lastUpdated: new Date().toISOString(),
      [operation]: 1 // Default to 1 for this operation
    };
    
    try {
      const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, usageKey);
      if (existingData && typeof existingData === 'object') {
        // Merge existing data with new operation count
        currentUsage = {
          ...existingData,
          lastUpdated: new Date().toISOString(),
          [operation]: (existingData[operation] || 0) + 1
        };
      }
    } catch (error) {
      // File doesn't exist or is invalid - use default structure
      Logger.log(`Creating new usage file for ${chatId} on ${today}`, 'info');
    }
    
    // Upsert: Save updated usage (will create or update)
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, usageKey, currentUsage);
    
    Logger.log(`Recorded usage for ${chatId} - ${operation}: ${currentUsage[operation]}/${DAILY_LIMITS[operation] || 10}`);
    
  } catch (error) {
    Logger.log(`Error recording usage: ${error.message}`, 'error');
    // Don't throw - usage tracking is non-critical
  }
}

/**
 * Get formatted usage limit error message
 * @param {string} operation - Operation type
 * @param {Object} limitInfo - Limit information from checkDailyLimit
 * @returns {string} Formatted error message
 */
export function getUsageLimitMessage(operation, limitInfo) {
  const operationNames = {
    AUDIO_GENERATION: 'audio generation',
    BROWSER_AUTOMATION: 'browser automation',
    SEARCH_QUERIES: 'search queries'
  };
  
  const operationName = operationNames[operation] || operation.toLowerCase();
  const resetDate = new Date(limitInfo.resetTime).toLocaleDateString();
  
  return `🚫 **Daily limit reached!**

You've used all ${limitInfo.limit} ${operationName} requests for today (${limitInfo.currentCount}/${limitInfo.limit}).

Your limit will reset at midnight UTC (${resetDate}).

This helps us manage costs and ensure fair usage for everyone! 😊`;
}

/**
 * Check if operation requires usage tracking
 * @param {string} operation - Operation type
 * @returns {boolean} True if operation should be tracked
 */
export function shouldTrackUsage(operation) {
  return Object.hasOwnProperty.call(DAILY_LIMITS, operation);
}

export default {
  checkDailyLimit,
  recordUsage,
  getUsageLimitMessage,
  shouldTrackUsage,
  DAILY_LIMITS
};