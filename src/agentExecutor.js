/**
 * Agent Executor - Handles execution of agent toolkit functions
 * 
 * This module handles the execution of OpenAI function calls and maps them
 * to the corresponding agentToolkit functions. It provides a clean interface
 * between the OpenAI API and our simplified agent tools.
 */

import { Logger } from '../utils/logger.js';
import { Analytics } from '../services/analytics.js';
import { 
  search,
  messages,
  images,
  calculate,
  analyze,
  fetch_url,
  browser
} from '../tools/agentToolkit.js';
import { analyzeImage, analyzeImageContent } from '../tools/imageAnalysis.js';
import { TOOL_USAGE_CONFIG } from './agentConfig.js';

/**
 * Execute an agent tool function call
 * @param {string} functionName - Name of the function to execute
 * @param {Object} functionArgs - Arguments for the function
 * @param {string} chatId - Chat ID for context
 * @returns {Promise<string>} Result of the function execution
 */
export async function executeAgentTool(functionName, functionArgs, chatId) {
  Logger.log(`Executing agent tool: ${functionName} with args: ${JSON.stringify(functionArgs)}`);
  
  try {
    // Add timeout for Lambda compatibility
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timeout')), TOOL_USAGE_CONFIG.TOOL_TIMEOUT);
    });
    
    const executionPromise = (async () => {
      const startTime = Date.now();
      let success = true;
      let result;
      
      try {
        switch (functionName) {
          case 'search':
            result = await executeSearchTool(functionArgs, chatId);
            break;
            
          case 'messages':
            result = await executeMessagesTool(functionArgs, chatId);
            break;
            
          case 'images':
            result = await executeImagesTool(functionArgs, chatId);
            break;
            
          case 'calculate':
            result = await executeCalculateTool(functionArgs);
            break;
            
          case 'analyze':
            result = await executeAnalyzeTool(functionArgs);
            break;
            
          case 'fetch_url':
            result = await executeFetchUrlTool(functionArgs);
            break;
            
          case 'browser':
            result = await executeBrowserTool(functionArgs, chatId);
            break;
            
          case 'analyze_image':
            result = await executeAnalyzeImageTool(functionArgs, chatId);
            break;
          
          case 'send_messages':
            result = await executeSendMessagesTool(functionArgs, chatId);
            break;
            
          default:
            throw new Error(`Unknown tool function: ${functionName}`);
        }
        
        // Track successful tool usage
        const executionTime = Date.now() - startTime;
        Analytics.trackToolUsage(functionName, true, executionTime);
        return result;
        
      } catch (error) {
        success = false;
        const executionTime = Date.now() - startTime;
        Analytics.trackToolUsage(functionName, false, executionTime);
        throw error;
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
  
  Logger.log(`Search: "${query}" in topic "${topic}" with options: ${JSON.stringify(options)}`);
  
  const result = await search(query, topic, options);
  return result;
}

/**
 * Execute messages tool with action-based parameter mapping
 */
async function executeMessagesTool(args, chatId) {
  const { action, params = {} } = args;
  
  Logger.log(`Messages: action "${action}" with params: ${JSON.stringify(params)}`);
  
  const result = await messages(chatId, action, params);
  return result;
}

/**
 * Execute images tool with action-based parameter mapping
 */
async function executeImagesTool(args, chatId) {
  const { action, params = {} } = args;
  
  Logger.log(`Images: action "${action}" with params: ${JSON.stringify(params)}`);
  
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
  
  Logger.log(`Analyze: action "${action}" with options: ${JSON.stringify(options)}`);
  
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
 * Execute browser tool with proper parameter mapping
 */
async function executeBrowserTool(args, chatId) {
  const { url, action = 'scrape', options = {} } = args;
  
  Logger.log(`Browser: "${url}" action "${action}" with options: ${JSON.stringify(options)}`);
  
  const result = await browser(url, action, options, chatId);
  return result;
}

/**
 * Execute analyze_image tool with proper parameter mapping
 */
async function executeAnalyzeImageTool(args, chatId) {
  const { imageData, instruction = 'analyze this image', contentType = 'general' } = args;
  
  Logger.log(`Analyze Image: instruction "${instruction}", contentType "${contentType}"`);
  
  if (contentType === 'general') {
    const result = await analyzeImage(imageData, instruction, chatId);
    return result;
  } else {
    const result = await analyzeImageContent(imageData, contentType, chatId);
    return result;
  }
}

/**
 * Execute send_messages tool - this sends messages directly with staggered delays
 */
async function executeSendMessagesTool(args, chatId) {
  const { messages } = args;
  
  Logger.log(`[SEND_MESSAGES] Starting: ${messages.length} messages, chatId: ${chatId}`);
  Analytics.trackMessageSent(chatId, messages.length);
  
  // Import here to avoid circular dependency
  const telegramModule = await import('../services/telegramAPI.js');
  const TelegramAPI = telegramModule.TelegramAPI;
  
  // Import saveBotMessage to save messages to S3
  const messageServiceModule = await import('../services/messageService.js');
  const { saveBotMessage } = messageServiceModule;
  
  // Use messages directly - no separate links handling
  const finalMessages = [...messages];
  
  // Send messages with staggered delays
  try {
    for (let i = 0; i < finalMessages.length; i++) {
      const message = finalMessages[i];
      
      const sentMessage = await TelegramAPI.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
      
      // Save each sent message to S3
      if (sentMessage) {
        await saveBotMessage(chatId, sentMessage);
        Logger.log(`Saved AI response message ${sentMessage.message_id} to S3`);
      } else {
        Logger.log(`Warning: Failed to send message ${i + 1}, could not save to S3`, 'warn');
      }
      
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
    
    Logger.log(`[SEND_MESSAGES] Successfully sent ${finalMessages.length} messages with delays and saved to S3`);
    
    // Return special marker to indicate messages were sent and loop should end
    return {
      __MESSAGES_SENT__: true,
      count: finalMessages.length,
      timestamp: Date.now()
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
        
    case 'browser':
      const { url: browserUrl, action: browserAction = 'scrape', options: browserOptions = {} } = functionArgs;
      const { instruction = '', waitFor = 3000 } = browserOptions;
      
      switch (browserAction) {
        case 'scrape':
          return `🌐 Opening browser to scrape: ${browserUrl}`;
        case 'screenshot':
          return `📸 Taking ${browserOptions.fullPageScreenshot ? 'full page' : 'viewport'} screenshot of: ${browserUrl}`;
        case 'interact':
          if (browserOptions.clickElement && browserOptions.fillForm) {
            return `🖱️ Filling form and clicking "${browserOptions.clickElement}" on: ${browserUrl}`;
          } else if (browserOptions.clickElement) {
            return `🖱️ Clicking "${browserOptions.clickElement}" on: ${browserUrl}`;
          } else if (browserOptions.fillForm) {
            return `⌨️ Filling form fields on: ${browserUrl}`;
          }
          return `🤖 Interacting with page: ${browserUrl}`;
        case 'wait-and-scrape':
          return `⏳ Loading page (${waitFor}ms wait) and scraping dynamic content from: ${browserUrl}`;
        case 'spa-scrape':
          return `⚡ Loading Single Page App (${waitFor}ms) and extracting content from: ${browserUrl}`;
        case 'links':
          return `🔗 Extracting relevant links from: ${browserUrl}`;
        case 'find-clickables':
          return `🔍 Scanning for clickable elements related to "${instruction}" on: ${browserUrl}`;
        case 'smart-navigate':
          return `🧠 Smart navigation: Auto-clicking through ${browserUrl} to find "${instruction}"`;
        default:
          return `🌐 Browser automation (${browserAction}) on: ${browserUrl}`;
      }
        
    case 'fetch_url':
      const { url } = functionArgs;
      return `📄 Fetching content from: ${url}`;
        
    case 'analyze_image':
      const { instruction: imgInstruction = 'analyze image', contentType = 'general' } = functionArgs;
      return contentType === 'general' ? 
        `Analyzing image: "${imgInstruction}"` :
        `Analyzing ${contentType}: "${imgInstruction}"`;
        
    case 'send_messages':
      return `Sending ${functionArgs.messages?.length || 1} chat messages`;
        
    default:
      return `⚙️ Executing ${functionName}`;
  }
}