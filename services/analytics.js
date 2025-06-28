/**
 * Analytics service for tracking bot events using Google Analytics
 */

import { Logger } from '../utils/logger.js';

class Analytics {
  /**
   * Track event with Google Analytics
   * @param {string} eventName - Name of the event
   * @param {Object} parameters - Event parameters
   */
  static trackEvent(eventName, parameters = {}) {
    try {
      // Only track in production (when running on Lambda)
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        // Send to Google Analytics via Measurement Protocol
        this.sendToGA(eventName, parameters);
      }
      
      // Always log locally for debugging
      Logger.log(`[ANALYTICS] ${eventName}`, parameters);
    } catch (error) {
      Logger.log(`Analytics tracking error: ${error.message}`, 'warn');
    }
  }

  /**
   * Send event to Google Analytics Measurement Protocol
   * @param {string} eventName - Event name
   * @param {Object} parameters - Event parameters
   */
  static async sendToGA(eventName, parameters) {
    try {
      const { CONFIG } = await import('../config.js');
      const measurementId = 'G-VB38RTLPZM';
      const apiSecret = CONFIG.GA_API_SECRET;
      
      if (!apiSecret) {
        Logger.log('GA_API_SECRET not configured, skipping GA tracking', 'warn');
        return;
      }

      const clientId = this.generateClientId(parameters.chatId || 'unknown');
      
      const payload = {
        client_id: clientId,
        events: [{
          name: eventName,
          parameters: {
            ...parameters,
            // Add default parameters
            platform: 'telegram_bot',
            environment: process.env.NODE_ENV || 'production'
          }
        }]
      };

      const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        Logger.log(`GA tracking failed: ${response.status}`, 'warn');
      }
    } catch (error) {
      Logger.log(`GA tracking error: ${error.message}`, 'warn');
    }
  }

  /**
   * Generate consistent client ID from chat ID
   * @param {string} chatId - Chat ID
   * @returns {string} Client ID
   */
  static generateClientId(chatId) {
    // Generate a consistent but anonymous client ID
    const hash = require('crypto').createHash('sha256').update(chatId.toString()).digest('hex');
    return hash.substring(0, 16) + '.' + hash.substring(16, 26);
  }

  // Event tracking methods
  static trackMessageReceived(chatId, messageType, hasAttachments = false) {
    this.trackEvent('message_received', {
      chat_id: this.hashChatId(chatId),
      message_type: messageType,
      has_attachments: hasAttachments
    });
  }

  static trackMessageSent(chatId, messageCount, hasLinks = false) {
    this.trackEvent('message_sent', {
      chat_id: this.hashChatId(chatId),
      message_count: messageCount,
      has_links: hasLinks
    });
  }

  static trackLLMCall(model, purpose, tokenCount = null) {
    this.trackEvent('llm_call', {
      model: model,
      purpose: purpose,
      token_count: tokenCount
    });
  }

  static trackToolUsage(toolName, success = true, executionTime = null) {
    this.trackEvent('tool_usage', {
      tool_name: toolName,
      success: success,
      execution_time_ms: executionTime
    });
  }

  static trackImageAnalysis(imageType, analysisType, success = true) {
    this.trackEvent('image_analysis', {
      image_type: imageType,
      analysis_type: analysisType,
      success: success
    });
  }

  static trackVideoAnalysis(videoType, duration, frameCount, success = true) {
    this.trackEvent('video_analysis', {
      video_type: videoType,
      duration_seconds: duration,
      frame_count: frameCount,
      success: success
    });
  }

  static trackVoiceTranscription(duration, success = true) {
    this.trackEvent('voice_transcription', {
      duration_seconds: duration,
      success: success
    });
  }

  static trackPersonaSwitch(fromPersona, toPersona, chatId) {
    this.trackEvent('persona_switch', {
      from_persona: fromPersona,
      to_persona: toPersona,
      chat_id: this.hashChatId(chatId)
    });
  }

  static trackMemorySearch(searchType, resultCount) {
    this.trackEvent('memory_search', {
      search_type: searchType,
      result_count: resultCount
    });
  }

  static trackWebSearch(searchType, query, resultCount) {
    this.trackEvent('web_search', {
      search_type: searchType,
      query_length: query?.length || 0,
      result_count: resultCount
    });
  }

  static trackError(errorType, errorMessage, context = {}) {
    this.trackEvent('bot_error', {
      error_type: errorType,
      error_message: errorMessage.substring(0, 100), // Truncate for privacy
      ...context
    });
  }

  static trackNewConversation(chatId, chatType) {
    this.trackEvent('new_conversation', {
      chat_id: this.hashChatId(chatId),
      chat_type: chatType
    });
  }

  /**
   * Hash chat ID for privacy
   * @param {string|number} chatId 
   * @returns {string}
   */
  static hashChatId(chatId) {
    if (!chatId) return 'unknown';
    const hash = require('crypto').createHash('sha256').update(chatId.toString()).digest('hex');
    return hash.substring(0, 8); // First 8 characters for analytics
  }
}

export { Analytics };