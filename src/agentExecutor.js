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
  browser,
  generate_audio
} from '../tools/agentToolkit.js';
import { analyzeImage, analyzeImageContent } from '../tools/imageAnalysis.js';
import { messageSearchToolkit } from './tools/messageSearchTool.js';
import { createVoiceMemo } from '../tools/voiceMemo.js';
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
            
          case 'run_code':
            result = await executeRunCodeTool(functionArgs);
            break;
            
          case 'analyze':
            result = await executeUnifiedAnalyzeTool(functionArgs, chatId);
            break;
            
          case 'fetch_url':
            result = await executeFetchUrlTool(functionArgs);
            break;
            
          case 'browser':
            result = await executeBrowserTool(functionArgs, chatId);
            break;
            
            
          case 'generate_audio':
            result = await executeGenerateAudioTool(functionArgs, chatId);
            break;
          
          case 'send_messages':
            result = await executeSendMessagesTool(functionArgs, chatId);
            break;

          case 'search_messages':
          case 'get_recent_messages':
          case 'get_user_messages':
            result = await executeSearchMessagesTool(functionArgs, chatId);
            break;

          case 'create_voice_memo':
            result = await executeCreateVoiceMemoTool(functionArgs, chatId);
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
/**
 * Execute run_code tool with safe code execution
 */
async function executeRunCodeTool(args) {
  const { code, language = 'javascript', context = {} } = args;

  Logger.log(`Run Code: "${code.substring(0, 100)}${code.length > 100 ? '...' : ''}" (${language})`);

  // Import and use the code runner
  const { runCode } = await import('../tools/codeRunner.js');

  const result = await runCode(code, context, { language });
  return result;
}

/**
 * Execute analyze tool with content and options
 */
/**
 * Execute unified analyze tool for all content types
 */
async function executeUnifiedAnalyzeTool(args, chatId) {
  const {
    content,
    contentType = 'auto',
    instruction = 'analyze this content thoroughly',
    options = {}
  } = args;

  Logger.log(`Unified Analyze: contentType "${contentType}", instruction "${instruction}", options: ${JSON.stringify(options)}`);

  // Auto-detect content type if not specified
  let detectedType = contentType;
  if (contentType === 'auto') {
    if (content.startsWith('http://') || content.startsWith('https://')) {
      detectedType = content.match(/\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i) ? 'image' : 'url';
    } else if (content.startsWith('data:image/')) {
      detectedType = 'image';
    } else if (content.includes('file_id')) {
      detectedType = 'voice'; // Assume voice for file_id (could be enhanced)
    } else {
      detectedType = 'text';
    }
  }

  Logger.log(`Content type detected/specified: ${detectedType}`);

  try {
    switch (detectedType) {
      case 'image':
        // Use existing image analysis functionality
        const { analyzeImage } = await import('../tools/imageAnalysis.js');
        return await analyzeImage(content, instruction, chatId);

      case 'voice':
      case 'audio':
        // Handle voice/audio transcription and analysis
        const { analyzeVoiceMessage } = await import('../tools/voiceAnalysis.js');
        return await analyzeVoiceMessage(content, instruction, options);

      case 'document':
        // Handle document analysis
        const { analyzeDocument } = await import('../tools/documentAnalysis.js');
        return await analyzeDocument(content, instruction, options);

      case 'url':
        // Handle URL content analysis
        const { fetch_url } = await import('../tools/agentToolkit.js');
        return await fetch_url(content, instruction);

      case 'text':
      default:
        // Handle text analysis using existing functionality
        const { analyze } = await import('../tools/agentToolkit.js');
        const action = options.action || 'analyze';
        return await analyze(content, action, options);
    }
  } catch (error) {
    Logger.log(`Unified analyze error for type ${detectedType}: ${error.message}`, 'error');
    return `❌ Analysis failed for ${detectedType} content: ${error.message}`;
  }
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

/**
 * Execute generate_audio tool with proper parameter mapping
 */
async function executeGenerateAudioTool(args, chatId) {
  const { texts, options = {} } = args;
  
  // Handle backward compatibility - if old 'text' parameter is used
  const textArray = texts || (args.text ? [args.text] : []);
  
  Logger.log(`Generate Audio: ${textArray.length} messages, first: "${textArray[0]?.substring(0, 100)}..." with options: ${JSON.stringify(options)}`);
  
  const result = await generate_audio(textArray, options, chatId);
  return result;
}

/**
 * Execute send_messages tool - handles both text and audio responses
 */
async function executeSendMessagesTool(args, chatId) {
  const { messages, medium = { type: 'text' } } = args;
  const mediumType = medium.type || 'text';
  const voiceOptions = {
    voiceId: medium.voiceId || 'auto',
    emotion: medium.emotion || 'auto',
    speed: medium.speed || 1.0
  };

  Logger.log(`[SEND_MESSAGES] Starting: ${messages.length} messages, medium: ${JSON.stringify(medium)}, chatId: ${chatId}`);
  Analytics.trackMessageSent(chatId, messages.length);

  // Import here to avoid circular dependency
  const telegramModule = await import('../services/telegramAPI.js');
  const TelegramAPI = telegramModule.TelegramAPI;

  // Import saveBotMessage to save messages to S3
  const messageServiceModule = await import('../services/messageService.js');
  const { saveBotMessage } = messageServiceModule;

  // Handle audio medium
  if (mediumType === 'audio') {
    Logger.log(`[SEND_MESSAGES] Audio mode selected - creating voice message`);

    // Validate content is suitable for audio
    const combinedText = messages.join(' ');
    if (combinedText.length > 1200) {
      Logger.log(`[SEND_MESSAGES] Audio content too long (${combinedText.length} chars), falling back to text`);
      // Fall back to text if too long
      const fallbackMessage = `📢 Audio content was too long (${combinedText.length} characters). Here's the text version:\n\n${combinedText}`;
      const sentMessage = await TelegramAPI.sendMessage(chatId, fallbackMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      if (sentMessage) {
        await saveBotMessage(chatId, sentMessage);
        Logger.log(`Saved fallback text message ${sentMessage.message_id} to S3`);
      }

      return {
        __MESSAGES_SENT__: true,
        count: 1,
        timestamp: Date.now()
      };
    }

    // Create voice memo using existing voice memo functionality
    try {
      const { createVoiceMemo } = await import('../tools/voiceMemo.js');

      Logger.log(`[SEND_MESSAGES] Creating voice memo: "${combinedText.substring(0, 50)}..." (${voiceOptions.voiceId})`);
      const result = await createVoiceMemo(
        combinedText,
        voiceOptions.voiceId || 'auto',
        voiceOptions.emotion || 'auto',
        voiceOptions.speed || 1.0,
        '', // title
        chatId
      );

      // Send the audio to Telegram
      if (result && result.success && result.audioBuffer) {
        const sentMessage = await TelegramAPI.sendVoice(chatId, result.audioBuffer, {
          caption: result.metadata?.title || 'Voice message'
        });

        if (sentMessage) {
          await saveBotMessage(chatId, sentMessage);
          Logger.log(`Saved voice message ${sentMessage.message_id} to S3`);
        }

        return {
          __MESSAGES_SENT__: true,
          count: 1,
          timestamp: Date.now(),
          audioGenerated: true
        };
      } else {
        throw new Error('Voice memo creation failed or returned invalid result');
      }

    } catch (error) {
      Logger.log(`[SEND_MESSAGES] Audio generation failed: ${error.message}, falling back to text`, 'warn');
      // Fall back to text on error
      const fallbackMessage = `🎤 Voice generation failed. Here's the text version:\n\n${combinedText}`;
      const sentMessage = await TelegramAPI.sendMessage(chatId, fallbackMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      if (sentMessage) {
        await saveBotMessage(chatId, sentMessage);
        Logger.log(`Saved fallback text message ${sentMessage.message_id} to S3`);
      }

      return {
        __MESSAGES_SENT__: true,
        count: 1,
        timestamp: Date.now()
      };
    }
  }

  // Default text message handling with automatic splitting
  let finalMessages = [];

  // Split long messages and flatten arrays
  for (const message of messages) {
    if (typeof message === 'string') {
      // Split messages that are too long (Telegram limit is 4096 chars)
      if (message.length > 3000) {
        const chunks = splitMessage(message, 3000);
        finalMessages.push(...chunks);
      } else {
        finalMessages.push(message);
      }
    } else {
      finalMessages.push(String(message));
    }
  }

  // Remove message limit - no truncation

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

    Logger.log(`[SEND_MESSAGES] Successfully sent ${finalMessages.length} text messages with delays and saved to S3`);

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
 * Execute unified search messages tool with parameter mapping
 */
async function executeSearchMessagesTool(args, chatId) {
  Logger.log(`Unified message search with args: ${JSON.stringify(args)}`);

  // Map different tool formats to unified search_messages parameters
  let searchArgs = { ...args, chat_id: chatId };

  // Handle get_recent_messages mapping (count -> limit)
  if (args.count !== undefined) {
    searchArgs.limit = args.count;
    searchArgs.query = searchArgs.query || '';
    delete searchArgs.count;
  }

  // Handle get_user_messages mapping (username -> user_filter)
  if (args.username !== undefined) {
    searchArgs.user_filter = args.username;
    searchArgs.query = searchArgs.query || '';
    delete searchArgs.username;
  }

  const result = await messageSearchToolkit.search_messages(searchArgs);
  return result;
}


/**
 * Execute create voice memo tool
 */
async function executeCreateVoiceMemoTool(args, chatId) {
  Logger.log(`Creating voice memo with args: ${JSON.stringify(args)}`);

  const result = await createVoiceMemo(
    args.text,
    args.voiceId || 'auto',
    args.emotion || 'auto',
    args.speed || 'auto',
    args.title || '',
    chatId
  );

  return result;
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
      const searchEmojis = {
        'web': '🌐 Searching the web',
        'news': '📰 Reading the latest news',
        'reddit': '👥 Browsing Reddit discussions',
        'images': '🖼️ Looking for images',
        'videos': '🎬 Finding videos',
        'places': '📍 Exploring places',
        'alternative': '🔍 Checking alternative sources'
      };
      return `${searchEmojis[topic] || '🔍 Searching'} for: "${query}"`;
      
    case 'messages':
      const { action, params = {} } = functionArgs;
      switch (action) {
        case 'get':
          return `📜 Reading through messages from ${params.timeframe || '24h'}`;
        case 'search':
          return `🔍 Digging through chat history for: "${params.query}"`;
        case 'summary':
          return `📝 Summarizing our conversation (${params.timeframe || '24h'})`;
        case 'filter':
          return `🎯 Filtering messages by: ${params.criteria}`;
        case 'range':
          return `📅 Pulling messages from ${params.startDate} to ${params.endDate}`;
        default:
          return `💬 Processing messages (${action})`;
      }
      
    case 'images':
      const { action: imgAction, params: imgParams = {} } = functionArgs;
      switch (imgAction) {
        case 'find':
          return imgParams.date ? 
            `🖼️ Looking for images from ${imgParams.date}` : 
            `🖼️ Scanning for images from ${imgParams.timeframe || '24h'}`;
        case 'analyze':
          return `👁️ Analyzing images for: "${imgParams.query}"`;
        case 'extract-text':
          return `📖 Reading text from images (${imgParams.timeframe || '24h'})`;
        case 'search':
          return `🔍 Searching through images for: "${imgParams.query}"`;
        default:
          return `🎨 Processing images (${imgAction})`;
      }
      
    case 'run_code':
      const { code } = functionArgs;
      const codePreview = code.length > 50 ? code.substring(0, 50) + '...' : code;
      return `⚡ Running code: ${codePreview}`;
      
    case 'analyze':
      const { contentType = 'auto', instruction = 'analyze content' } = functionArgs;
      const typeEmoji = {
        text: '📝', image: '🖼️', voice: '🎤', audio: '🔊',
        document: '📄', video: '🎬', url: '🌐', auto: '🔍'
      };
      return `${typeEmoji[contentType] || '🔍'} ${instruction}`;
        
    case 'fetch_url':
      const { url } = functionArgs;
      return `📄 Reading content from: ${url}`;
        
        
    case 'generate_audio':
      const { texts: audioTexts, text: audioText } = functionArgs;
      const textArray = audioTexts || (audioText ? [audioText] : []);
      const totalChars = textArray.reduce((sum, text) => sum + (text?.length || 0), 0);
      return textArray.length > 1 
        ? `🎙️ Recording ${textArray.length} voice messages (${totalChars} chars total)`
        : `🎙️ Recording voice message (${totalChars} chars)`;
        
    case 'send_messages':
      return `💬 Preparing ${functionArgs.messages?.length || 1} response messages`;

    case 'search_messages':
      const { query: searchQuery, user_filter, days_back = 7 } = functionArgs;
      if (searchQuery && user_filter) {
        return `🔍 Searching for "${searchQuery}" in ${user_filter}'s messages (${days_back} days)`;
      } else if (searchQuery) {
        return `🔍 Searching chat history for "${searchQuery}" (${days_back} days back)`;
      } else if (user_filter) {
        return `👤 Finding recent messages from ${user_filter}`;
      }
      return `📚 Searching conversation history`;

    case 'get_recent_messages':
      const { count = 20 } = functionArgs;
      return `📝 Getting last ${count} messages for context`;

    case 'get_user_messages':
      const { username, days_back: userDays = 30 } = functionArgs;
      return `👤 Finding messages from ${username} (last ${userDays} days)`;

    case 'create_voice_memo':
      const { text: voiceText = '', voiceId = 'auto', title: voiceTitle } = functionArgs;
      const shortText = voiceText.substring(0, 50);
      const voiceChar = voiceId === 'auto' ? 'smart voice' : voiceId;
      return voiceTitle ?
        `🎤 Creating voice memo "${voiceTitle}" (${voiceChar})` :
        `🎤 Creating voice memo: "${shortText}..." (${voiceChar})`;

    default:
      return `⚙️ Executing ${functionName}`;
  }
}