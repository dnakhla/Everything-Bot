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
      // Send to Google Analytics
      this.sendToGA(eventName, parameters);
      
      // Always log locally for debugging
      Logger.log(`[ANALYTICS] ${eventName}: ${JSON.stringify(parameters)}`);
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
    // Generate a consistent but anonymous client ID using simple hash
    const hash = this.simpleHash(chatId.toString());
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

  static trackLLMCall(model, purpose, tokenUsage = null, chatId = null, responseTime = null) {
    const eventData = {
      model: model,
      purpose: purpose,
      chat_id: chatId ? this.hashChatId(chatId) : 'unknown'
    };

    // Add token usage data if available
    if (tokenUsage) {
      eventData.prompt_tokens = tokenUsage.prompt_tokens || 0;
      eventData.completion_tokens = tokenUsage.completion_tokens || 0;
      eventData.total_tokens = tokenUsage.total_tokens || 0;
      
      // Calculate estimated cost (rough estimates in USD)
      const cost = this.calculateLLMCost(model, tokenUsage);
      if (cost > 0) {
        eventData.estimated_cost_usd = cost;
      }
    }

    // Add response time if available
    if (responseTime) {
      eventData.response_time_ms = responseTime;
    }

    this.trackEvent('llm_call', eventData);
  }

  /**
   * Calculate estimated cost for LLM usage based on current pricing
   * @param {string} model - Model name
   * @param {Object} usage - Token usage object
   * @returns {number} Estimated cost in USD
   */
  static calculateLLMCost(model, usage) {
    // OpenAI pricing estimates (per 1M tokens) as of 2024
    const pricing = {
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-4.1': { input: 30.00, output: 60.00 },
      'gpt-4.1-mini': { input: 0.15, output: 0.60 },
      'gpt-4.1-nano': { input: 0.075, output: 0.30 },
      'gpt-4o-transcribe': { input: 6.00, output: 6.00 }, // Per hour estimate
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
    };

    // Find matching model (handle variations)
    let modelPricing = null;
    for (const [key, value] of Object.entries(pricing)) {
      if (model.toLowerCase().includes(key.toLowerCase())) {
        modelPricing = value;
        break;
      }
    }

    if (!modelPricing || !usage.prompt_tokens || !usage.completion_tokens) {
      return 0;
    }

    // Calculate cost: (tokens / 1,000,000) * price_per_million
    const inputCost = (usage.prompt_tokens / 1000000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1000000) * modelPricing.output;
    
    return Math.round((inputCost + outputCost) * 1000000) / 1000000; // Round to 6 decimal places
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

  static trackAudioGeneration(chatId, textLength, duration, audioType, success = true) {
    this.trackEvent('audio_generation', {
      chat_id: this.hashChatId(chatId),
      text_length: textLength,
      duration_seconds: duration,
      audio_type: audioType, // 'voice' or 'audio'
      success: success
    });
  }

  static trackUsageLimitHit(chatId, operationType, currentCount, limit) {
    this.trackEvent('usage_limit_hit', {
      chat_id: this.hashChatId(chatId),
      operation_type: operationType,
      current_count: currentCount,
      daily_limit: limit
    });
  }

  /**
   * Simple hash function for privacy (no crypto module needed)
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  static simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string and pad
    return Math.abs(hash).toString(16).padStart(8, '0').repeat(4).substring(0, 32);
  }

  /**
   * Hash chat ID for privacy
   * @param {string|number} chatId 
   * @returns {string}
   */
  static hashChatId(chatId) {
    if (!chatId) return 'unknown';
    const hash = this.simpleHash(chatId.toString());
    return hash.substring(0, 8); // First 8 characters for analytics
  }
}

export { Analytics };