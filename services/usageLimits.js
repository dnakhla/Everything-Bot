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
  BROWSER_AUTOMATION: 20, // Max 20 browser tool uses per user per day
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
  
  try {
    // Get current usage for today
    let currentUsage = {};
    try {
      const usageData = await S3Manager.getObject(usageKey);
      currentUsage = JSON.parse(usageData);
    } catch (error) {
      // File doesn't exist yet, start with empty usage
      currentUsage = {};
    }
    
    const currentCount = currentUsage[operation] || 0;
    const limit = DAILY_LIMITS[operation] || 10; // Default limit if not specified
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;
    
    // Calculate reset time (midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const resetTime = tomorrow.toISOString();
    
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
    // On error, allow the operation (fail open)
    return {
      allowed: true,
      remaining: DAILY_LIMITS[operation] || 10,
      resetTime: new Date().toISOString(),
      currentCount: 0,
      limit: DAILY_LIMITS[operation] || 10
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
    // Get current usage
    let currentUsage = {};
    try {
      const usageData = await S3Manager.getObject(usageKey);
      currentUsage = JSON.parse(usageData);
    } catch (error) {
      // File doesn't exist, start fresh
      currentUsage = {
        date: today,
        chatId: chatId
      };
    }
    
    // Increment counter
    currentUsage[operation] = (currentUsage[operation] || 0) + 1;
    currentUsage.lastUpdated = new Date().toISOString();
    
    // Save back to S3
    await S3Manager.uploadObject(usageKey, JSON.stringify(currentUsage, null, 2));
    
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