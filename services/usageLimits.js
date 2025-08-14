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
 * Default daily limits for different operations (fallback when config is unavailable)
 */
const DEFAULT_DAILY_LIMITS = {
  AUDIO_GENERATION: 5, // Max 5 audio generations per user per day
  SEARCH_QUERIES: 100, // Max 100 search queries per user per day
  LLM_TOKENS: 50000, // Max 50k tokens per user per day
  LLM_CALLS: 200 // Max 200 LLM calls per user per day
};

/**
 * Get configurable limits for a specific chat/user
 * @param {string} chatId - Chat/User ID
 * @returns {Promise<Object>} Configured limits or defaults
 */
async function getConfiguredLimits(chatId) {
  try {
    // Get configured limits from S3
    const usageLimits = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, 'config/usage_limits.json');
    
    if (usageLimits && usageLimits[chatId]) {
      const roomLimits = usageLimits[chatId];
      
      // Use the operation names directly if they exist, otherwise fall back to legacy mapping
      return {
        AUDIO_GENERATION: roomLimits.AUDIO_GENERATION || roomLimits.maxPodcastGenerations || DEFAULT_DAILY_LIMITS.AUDIO_GENERATION,
        SEARCH_QUERIES: roomLimits.SEARCH_QUERIES || roomLimits.maxWebSearches || DEFAULT_DAILY_LIMITS.SEARCH_QUERIES,
        LLM_TOKENS: roomLimits.LLM_TOKENS || roomLimits.dailyTokenLimit || DEFAULT_DAILY_LIMITS.LLM_TOKENS,
        LLM_CALLS: roomLimits.LLM_CALLS || roomLimits.dailyMessageLimit || DEFAULT_DAILY_LIMITS.LLM_CALLS
      };
    }
    
    // Return defaults if no room-specific config found
    return DEFAULT_DAILY_LIMITS;
  } catch (error) {
    Logger.log(`Error getting configured limits for ${chatId}: ${error.message}`, 'warn');
    // Return defaults if config loading fails
    return DEFAULT_DAILY_LIMITS;
  }
}

/**
 * Check if user has exceeded daily limit for a specific operation
 * @param {string} chatId - Chat/User ID
 * @param {string} operation - Operation type (AUDIO_GENERATION, BROWSER_AUTOMATION, etc.)
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: string}>}
 */
export async function checkDailyLimit(chatId, operation) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const usageKey = `fact_checker_bot/groups/${chatId}/usage/${today}.json`;
  
  // Get configured limits for this chat
  const configuredLimits = await getConfiguredLimits(chatId);
  const limit = configuredLimits[operation] || 10; // Default limit if not specified
  
  // Debug logging
  Logger.log(`checkDailyLimit for ${chatId}, operation: ${operation}`);
  Logger.log(`Configured limits:`, configuredLimits);
  Logger.log(`Resolved limit for ${operation}: ${limit}`);
  
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
export async function recordUsage(chatId, operation, amount = 1) {
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `fact_checker_bot/groups/${chatId}/usage/${today}.json`;
  
  try {
    // Idempotent upsert: Get current usage or create default structure
    let currentUsage = {
      date: today,
      chatId: chatId,
      lastUpdated: new Date().toISOString(),
      [operation]: amount // Default to specified amount for this operation
    };
    
    try {
      const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, usageKey);
      if (existingData && typeof existingData === 'object') {
        // Merge existing data with new operation count
        currentUsage = {
          ...existingData,
          lastUpdated: new Date().toISOString(),
          [operation]: (existingData[operation] || 0) + amount
        };
      }
    } catch (error) {
      // File doesn't exist or is invalid - use default structure
      Logger.log(`Creating new usage file for ${chatId} on ${today}`, 'info');
    }
    
    // Upsert: Save updated usage (will create or update)
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, usageKey, currentUsage);
    
    // Get current limit for logging
    const configuredLimits = await getConfiguredLimits(chatId);
    const currentLimit = configuredLimits[operation] || 10;
    Logger.log(`Recorded usage for ${chatId} - ${operation}: ${currentUsage[operation]}/${currentLimit}`);
    
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
  return Object.hasOwnProperty.call(DEFAULT_DAILY_LIMITS, operation);
}

/**
 * Record LLM usage with token counts
 * @param {string} chatId - Chat/User ID
 * @param {Object} tokenUsage - Token usage from OpenAI response
 * @returns {Promise<void>}
 */
export async function recordLLMUsage(chatId, tokenUsage) {
  if (!tokenUsage) return;
  
  // Record call count
  await recordUsage(chatId, 'LLM_CALLS', 1);
  
  // Record token usage
  const totalTokens = tokenUsage.total_tokens || 0;
  if (totalTokens > 0) {
    await recordUsage(chatId, 'LLM_TOKENS', totalTokens);
  }
}

/**
 * Check if LLM usage would exceed daily limits
 * @param {string} chatId - Chat/User ID
 * @param {number} estimatedTokens - Estimated tokens for the request
 * @returns {Promise<{callsAllowed: boolean, tokensAllowed: boolean, callsRemaining: number, tokensRemaining: number}>}
 */
export async function checkLLMUsage(chatId, estimatedTokens = 1000) {
  const callsCheck = await checkDailyLimit(chatId, 'LLM_CALLS');
  const tokensCheck = await checkDailyLimit(chatId, 'LLM_TOKENS');
  
  const tokensWouldExceed = (tokensCheck.currentCount + estimatedTokens) > tokensCheck.limit;
  
  return {
    callsAllowed: callsCheck.allowed,
    tokensAllowed: !tokensWouldExceed,
    callsRemaining: callsCheck.remaining,
    tokensRemaining: tokensCheck.remaining,
    currentTokens: tokensCheck.currentCount,
    tokenLimit: tokensCheck.limit
  };
}

export default {
  checkDailyLimit,
  recordUsage,
  recordLLMUsage,
  checkLLMUsage,
  getUsageLimitMessage,
  shouldTrackUsage,
  getConfiguredLimits,
  DEFAULT_DAILY_LIMITS
};