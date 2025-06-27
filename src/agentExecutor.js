/**
 * Agent Executor - Handles execution of agent toolkit functions
 * 
 * This module handles the execution of OpenAI function calls and maps them
 * to the corresponding agentToolkit functions. It provides a clean interface
 * between the OpenAI API and our simplified agent tools.
 */

import { Logger } from '../utils/logger.js';
import { 
  search,
  messages,
  images,
  calculate,
  analyze,
  fetch_url
} from '../tools/agentToolkit.js';
import { TOOL_USAGE_CONFIG } from './agentConfig.js';

/**
 * Execute an agent tool function call
 * @param {string} functionName - Name of the function to execute
 * @param {Object} functionArgs - Arguments for the function
 * @param {string} chatId - Chat ID for context
 * @returns {Promise<string>} Result of the function execution
 */
export async function executeAgentTool(functionName, functionArgs, chatId) {
  Logger.log(`Executing agent tool: ${functionName} with args:`, functionArgs);
  
  try {
    // Add timeout for Lambda compatibility
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timeout')), TOOL_USAGE_CONFIG.TOOL_TIMEOUT);
    });
    
    const executionPromise = (async () => {
      switch (functionName) {
        case 'search':
          return await executeSearchTool(functionArgs, chatId);
          
        case 'messages':
          return await executeMessagesTool(functionArgs, chatId);
          
        case 'images':
          return await executeImagesTool(functionArgs, chatId);
          
        case 'calculate':
          return await executeCalculateTool(functionArgs);
          
        case 'analyze':
          return await executeAnalyzeTool(functionArgs);
          
        case 'fetch_url':
          return await executeFetchUrlTool(functionArgs);
          
        case 'send_messages':
          return await executeSendMessagesTool(functionArgs, chatId);
          
        default:
          throw new Error(`Unknown tool function: ${functionName}`);
      }
    })();
    
    return await Promise.race([executionPromise, timeoutPromise]);
    
  } catch (error) {
    Logger.log(`Error executing ${functionName}: ${error.message}`, 'error');
    return `❌ Error executing ${functionName}: ${error.message}`;
  }
}

/**
 * Execute search tool with proper parameter mapping
 */
async function executeSearchTool(args, chatId) {
  const { query, topic = 'web', options = {} } = args;
  
  Logger.log(`Search: "${query}" in topic "${topic}" with options:`, options);
  
  const result = await search(query, topic, options);
  return result;
}

/**
 * Execute messages tool with action-based parameter mapping
 */
async function executeMessagesTool(args, chatId) {
  const { action, params = {} } = args;
  
  Logger.log(`Messages: action "${action}" with params:`, params);
  
  const result = await messages(chatId, action, params);
  return result;
}

/**
 * Execute images tool with action-based parameter mapping
 */
async function executeImagesTool(args, chatId) {
  const { action, params = {} } = args;
  
  Logger.log(`Images: action "${action}" with params:`, params);
  
  const result = await images(chatId, action, params);
  return result;
}

/**
 * Execute calculate tool
 */
async function executeCalculateTool(args) {
  const { expression } = args;
  
  Logger.log(`Calculate: "${expression}"`);
  
  const result = await calculate(expression);
  return result;
}

/**
 * Execute analyze tool with content and options
 */
async function executeAnalyzeTool(args) {
  const { content, action = 'summarize', options = {} } = args;
  
  Logger.log(`Analyze: action "${action}" with options:`, options);
  
  const result = await analyze(content, action, options);
  return result;
}

/**
 * Execute fetch_url tool using agentToolkit
 */
async function executeFetchUrlTool(args) {
  const { url, instruction = 'summarize the main content' } = args;
  
  Logger.log(`Fetch URL: "${url}" with instruction: "${instruction}"`);
  
  const result = await fetch_url(url, instruction);
  return result;
}

/**
 * Execute send_messages tool - this sends messages directly with staggered delays
 */
async function executeSendMessagesTool(args, chatId) {
  const { messages, links_message } = args;
  
  Logger.log(`Send Messages: ${messages.length} messages`, { has_links: !!links_message });
  
  // Import here to avoid circular dependency
  const telegramModule = await import('../services/telegramAPI.js');
  const TelegramAPI = telegramModule.TelegramAPI;
  
  // Combine messages and links if provided
  const finalMessages = [...messages];
  if (links_message) {
    finalMessages.push(links_message);
  }
  
  // Send messages with staggered delays
  try {
    for (let i = 0; i < finalMessages.length; i++) {
      const message = finalMessages[i];
      
      await TelegramAPI.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
      
      // Add quick delay between messages for natural flow
      if (i < finalMessages.length - 1) {
        const nextMessage = finalMessages[i + 1];
        
        // Much faster delays - optimized for quick responses
        const baseDelay = 800; // Base 800ms delay
        const lengthBonus = Math.min(nextMessage.length * 10, 1200); // 10ms per char, max 1.2s bonus
        const quickDelay = baseDelay + lengthBonus; // 800ms to 2s total
        
        Logger.log(`Quick delay: ${quickDelay}ms for next message (${nextMessage.length} chars)`);
        await new Promise(resolve => setTimeout(resolve, quickDelay));
      }
    }
    
    Logger.log(`Successfully sent ${finalMessages.length} messages with delays`);
    
    // Return special marker to indicate messages were sent and loop should end
    return {
      __MESSAGES_SENT__: true,
      count: finalMessages.length
    };
    
  } catch (error) {
    Logger.log(`Error sending messages: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get user-friendly description of what tool is being executed
 * @param {string} functionName - Name of the function
 * @param {Object} functionArgs - Arguments for the function
 * @returns {string} User-friendly description
 */
export function getToolExecutionDescription(functionName, functionArgs) {
  switch (functionName) {
    case 'search':
      const { query, topic = 'web' } = functionArgs;
      const topicMap = {
        'web': 'web',
        'news': 'news',
        'reddit': 'Reddit',
        'images': 'images',
        'videos': 'videos',
        'places': 'places',
        'alternative': 'alternative sources'
      };
      return `Searching ${topicMap[topic] || topic} for: "${query}"`;
      
    case 'messages':
      const { action, params = {} } = functionArgs;
      switch (action) {
        case 'get':
          return `Retrieving messages from ${params.timeframe || '24h'}`;
        case 'search':
          return `Searching chat history for: "${params.query}"`;
        case 'summary':
          return `Generating conversation summary (${params.timeframe || '24h'})`;
        case 'filter':
          return `Filtering messages by: ${params.criteria}`;
        case 'range':
          return `Retrieving messages from ${params.startDate} to ${params.endDate}`;
        default:
          return `Processing messages (${action})`;
      }
      
    case 'images':
      const { action: imgAction, params: imgParams = {} } = functionArgs;
      switch (imgAction) {
        case 'find':
          return imgParams.date ? 
            `Finding images from ${imgParams.date}` : 
            `Finding images from ${imgParams.timeframe || '24h'}`;
        case 'analyze':
          return `Analyzing images for: "${imgParams.query}"`;
        case 'extract-text':
          return `Extracting text from images (${imgParams.timeframe || '24h'})`;
        case 'search':
          return `Searching images for: "${imgParams.query}"`;
        default:
          return `Processing images (${imgAction})`;
      }
      
    case 'calculate':
      return `Calculating: ${functionArgs.expression}`;
      
    case 'analyze':
      const { action: analyzeAction = 'summarize' } = functionArgs;
      return analyzeAction === 'summarize' ? 
        'Summarizing content' : 
        'Analyzing data';
        
    case 'fetch_url':
      const { url } = functionArgs;
      return `Fetching content from: ${url}`;
        
    case 'send_messages':
      return `Sending ${functionArgs.messages?.length || 1} chat messages`;
        
    default:
      return `Executing ${functionName}`;
  }
}