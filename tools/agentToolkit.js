/**
 * Agent Toolkit - Simplified, abstracted interface for AI agents
 * 
 * This provides a clean, intuitive API that abstracts away the complexity
 * of the underlying specialized tools. Agents get fewer, more powerful tools.
 */

import * as SearchEngines from './searchEngines.js';
import * as RedditSearch from './redditSearch.js';
import * as MemorySearch from './memorySearch.js';
import * as MathCalculation from './mathCalculation.js';
import * as ContentAnalysis from './contentAnalysis.js';
import * as DataProcessing from './dataProcessing.js';
import * as MessageService from '../services/messageService.js';
import { browser, BROWSER_TOOLKIT } from './browserTool.js';
import { analyzeImage, extractTextFromImage, analyzeImageContent, IMAGE_ANALYSIS_TOOLKIT } from './imageAnalysis.js';
import { generateAudioSmart, shouldGenerateAudio } from './audioGeneration.js';
import { Logger } from '../utils/logger.js';
import { createToolWrapper } from '../utils/toolWrapper.js';

/**
 * Unified search tool - handles all types of search with topic selection
 * @param {string} query - What to search for
 * @param {string} topic - Search type: 'web', 'news', 'images', 'videos', 'places', 'reddit', 'alternative'
 * @param {Object} options - Additional search options
 * @param {string} chatId - Chat ID for usage tracking
 * @returns {string} Formatted search results
 */
export const search = createToolWrapper(
  async (query, topic = 'web', options = {}, chatId = null) => {
    const { subreddit = 'all', timeframe = 'week', maxResults = 10 } = options;
    
    // Track search usage if chatId provided
    if (chatId) {
      try {
        const { recordUsage } = await import('../services/usageLimits.js');
        await recordUsage(chatId, 'SEARCH_QUERIES');
      } catch (error) {
        Logger.log(`Failed to record search usage: ${error.message}`, 'warn');
      }
    }
    
    switch (topic.toLowerCase()) {
      case 'news':
        return await SearchEngines.performNewsSearch(query);
      
      case 'images':
        return await SearchEngines.performImageSearch(query);
      
      case 'videos':
        return await SearchEngines.performVideoSearch(query);
      
      case 'places':
        return await SearchEngines.performPlacesSearch(query);
      
      case 'reddit':
        return await RedditSearch.searchReddit(query, subreddit);
      
      case 'reddit-posts':
        return await RedditSearch.getRedditPosts(subreddit, timeframe);
      
      case 'alternative':
        return await SearchEngines.searchUnpopularSites(query);
      
      case 'web':
      default:
        return await MessageService.performGoogleSearch(query);
    }
  },
  {
    name: 'search',
    category: 'core',
    description: 'Universal search tool - specify topic: web, news, images, videos, places, reddit, alternative',
    formatResult: (result) => result // Results are already formatted by underlying tools
  }
);

/**
 * Unified message retrieval and filtering tool
 * @param {string} chatId - Chat ID to search
 * @param {string} action - Action: 'get', 'search', 'summary', 'filter'
 * @param {Object} params - Action parameters
 * @returns {string} Formatted message results
 */
export const messages = createToolWrapper(
  async (chatId, action, params = {}) => {
    const { 
      timeframe = '24h', 
      query = '', 
      criteria = '', 
      startDate = '', 
      endDate = '',
      maxResults = 20 
    } = params;
    
    switch (action.toLowerCase()) {
      case 'get':
        return await getMessagesByTimeframe(chatId, timeframe);
      
      case 'search':
        return await MemorySearch.searchChatHistory(chatId, query, maxResults);
      
      case 'summary':
        const hours = parseTimeframe(timeframe);
        return await MemorySearch.getRecentConversationSummary(chatId, hours);
      
      case 'filter':
        const messages = await getMessagesByTimeframe(chatId, timeframe);
        if (criteria) {
          return await DataProcessing.filterData(messages, criteria);
        }
        return messages;
      
      case 'range':
        const rangeMessages = await MessageService.getMessagesFromDateRange(chatId, startDate, endDate);
        return formatMessagesResult(rangeMessages, `${startDate} to ${endDate}`);
      
      default:
        throw new Error(`Unknown action: ${action}. Use: get, search, summary, filter, range`);
    }
  },
  {
    name: 'messages',
    category: 'core',
    description: 'Universal message tool - actions: get, search, summary, filter, range',
    formatResult: (result) => result
  }
);

/**
 * Unified image analysis and search tool
 * @param {string} chatId - Chat ID
 * @param {string} action - Action: 'find', 'analyze', 'extract-text', 'search'
 * @param {Object} params - Action parameters
 * @returns {string} Formatted image results
 */
export const images = createToolWrapper(
  async (chatId, action, params = {}) => {
    const { 
      timeframe = '24h', 
      date = '', 
      query = '', 
      lookbackDays = 30 
    } = params;
    
    switch (action.toLowerCase()) {
      case 'find':
        if (date) {
          return await MemorySearch.findImagesByDate(chatId, date, query);
        } else {
          const hours = parseTimeframe(timeframe);
          return await MemorySearch.analyzeImagesFromTimeframe(chatId, query, hours);
        }
      
      case 'analyze':
        const hours = parseTimeframe(timeframe);
        return await MemorySearch.analyzeImagesFromTimeframe(chatId, query, hours);
      
      case 'extract-text':
        const extractHours = parseTimeframe(timeframe);
        return await MemorySearch.extractTextFromImagesInTimeframe(chatId, extractHours);
      
      case 'search':
        return await MemorySearch.searchForSpecificImages(chatId, query, lookbackDays);
      
      default:
        throw new Error(`Unknown action: ${action}. Use: find, analyze, extract-text, search`);
    }
  },
  {
    name: 'images',
    category: 'core',
    description: 'Universal image tool - actions: find, analyze, extract-text, search',
    formatResult: (result) => result
  }
);

/**
 * Mathematical calculations
 * @param {string} expression - Mathematical expression to evaluate
 * @returns {string} Calculation result
 */
export const calculate = MathCalculation.performMathCalculation;

/**
 * Content analysis and summarization
 * @param {string} content - Content to analyze
 * @param {string} action - Action: 'summarize', 'analyze'
 * @param {Object} options - Analysis options
 * @returns {string} Analysis result
 */
export const analyze = createToolWrapper(
  async (content, action = 'summarize', options = {}) => {
    const { maxPoints = 5, operation = 'count', field = null } = options;
    
    switch (action.toLowerCase()) {
      case 'summarize':
        return await ContentAnalysis.summarizeContent(content, maxPoints);
      
      case 'data':
        if (Array.isArray(content)) {
          return await DataProcessing.analyzeData(content, operation, field);
        }
        throw new Error('Data analysis requires an array of data');
      
      default:
        throw new Error(`Unknown action: ${action}. Use: summarize, data`);
    }
  },
  {
    name: 'analyze',
    category: 'core',
    description: 'Content analysis tool - actions: summarize, data',
    formatResult: (result) => result
  }
);

/**
 * Browser automation for JavaScript-heavy sites and dynamic content
 * @param {string} url - URL to navigate to
 * @param {string} action - Action: 'scrape', 'screenshot', 'interact', 'wait-and-scrape', 'spa-scrape', 'links'
 * @param {Object} options - Action-specific options
 * @returns {Promise<string>} Browser automation results
 */
export { browser };

/**
 * Fetch and analyze content from a URL
 * @param {string} url - URL to fetch
 * @param {string} instruction - What to analyze in the content, or 'raw' for full content
 * @returns {Promise<string>} Fetched content (raw by default) or analyzed content
 */
export const fetch_url = createToolWrapper(
  async (url, instruction = 'raw') => {
    
    // Track URL fetch usage if chatId provided
    if (chatId) {
      try {
        const { recordUsage } = await import('../services/usageLimits.js');
        await recordUsage(chatId, 'FETCH_URL');
      } catch (error) {
        Logger.log(`Failed to record fetch_url usage: ${error.message}`, 'warn');
      }
    }
    try {
      // Validate URL
      const urlPattern = /^https?:\/\//i;
      if (!urlPattern.test(url)) {
        throw new Error('Invalid URL format. Must start with http:// or https://');
      }
      
      // Try intelligent fetch with API discovery first
      try {
        const { intelligentFetch } = await import('../services/apiDiscovery.js');
        const fetchResult = await intelligentFetch(url, instruction);
        
        Logger.log(`Intelligent fetch result: ${fetchResult.type} (${fetchResult.content.length} chars)`);
        
        let content = fetchResult.content;
        let links = [];
        
        // Extract links if we have HTML content
        if (fetchResult.type === 'html' || fetchResult.type === 'html_fallback') {
          links = extractLinks(content, url);
          
          // Clean HTML content
          if (content.includes('<html')) {
            content = content
              .replace(/<script[^>]*>.*?<\/script>/gis, '')
              .replace(/<style[^>]*>.*?<\/style>/gis, '')
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          }
          
          // Basic entity decoding
          if (content.includes('&')) {
            content = content.replace(/&nbsp;/g, ' ');
            content = content.replace(/&amp;/g, '&');
            content = content.replace(/&lt;/g, '<');
            content = content.replace(/&gt;/g, '>');
            content = content.replace(/&quot;/g, '"');
            content = content.replace(/\s+/g, ' ').trim();
          }
        } else if (fetchResult.type === 'api_data' || fetchResult.type === 'js_data') {
          // For API/JS data, try to extract any URLs from the JSON
          links = extractLinksFromJson(content, url);
        }
        
        if (!content || content.length < 50) {
          return '❌ No meaningful content found on the page';
        }
        
        const sourceInfo = fetchResult.type === 'api_data' ? '🔗 API Data' : 
                          fetchResult.type === 'js_data' ? '⚡ JavaScript Data' : '📄 Web Content';
        
        // Return raw content by default, or analyze if specific instruction given
        if (instruction === 'raw' || instruction === 'summarize the main content') {
          let result = `${sourceInfo} from ${url}:\n\n${content}`;
          
          // Add relevant links if found
          if (links.length > 0) {
            result += `\n\n🔗 **Links Found:**\n${links.slice(0, 10).map(link => `• [${link.text}](${link.url})`).join('\n')}`;
          }
          
          return result;
        } else {
          // Use the analyze tool to process the content according to specific instruction
          const analyzedResult = await ContentAnalysis.summarizeContent(content, 8, instruction);
          
          let result = `${sourceInfo} from ${url}:\n\n${analyzedResult}`;
          
          // Add relevant links if found
          if (links.length > 0) {
            const relevantLinks = filterRelevantLinks(links, instruction);
            if (relevantLinks.length > 0) {
              result += `\n\n🔗 **Related Links Found:**\n${relevantLinks.slice(0, 5).map(link => `• [${link.text}](${link.url})`).join('\n')}`;
            }
          }
          
          return result;
        }
        
      } catch (intelligentError) {
        Logger.log(`Intelligent fetch failed, falling back to simple fetch: ${intelligentError.message}`, 'warn');
        
        // Fallback to original method with link extraction
        const axios = (await import('axios')).default;
        
        const response = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FactCheckerBot/1.0)'
          },
          maxContentLength: 10 * 1024 * 1024, // 10MB limit for reports/PDFs
          maxBodyLength: 10 * 1024 * 1024
        });
        
        let content = response.data;
        let links = [];
        
        // Extract links before cleaning HTML
        if (response.headers['content-type']?.includes('text/html')) {
          links = extractLinks(content, url);
          
          // Basic HTML cleanup
          content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          content = content.replace(/<[^>]*>/g, ' ');
          content = content.replace(/&nbsp;/g, ' ');
          content = content.replace(/&amp;/g, '&');
          content = content.replace(/&lt;/g, '<');
          content = content.replace(/&gt;/g, '>');
          content = content.replace(/&quot;/g, '"');
          content = content.replace(/\s+/g, ' ').trim();
        }
        
        // Return raw content by default, or analyze if specific instruction given
        if (instruction === 'raw' || instruction === 'summarize the main content') {
          let result = `📄 Content from ${url}:\n\n${content}`;
          
          // Add links if found
          if (links.length > 0) {
            result += `\n\n🔗 **Links Found:**\n${links.slice(0, 10).map(link => `• [${link.text}](${link.url})`).join('\n')}`;
          }
          
          return result;
        } else {
          // Use the analyze tool to process the content according to specific instruction
          const analyzedResult = await ContentAnalysis.summarizeContent(content, 8, instruction);
          
          let result = `📄 Content from ${url}:\n\n${analyzedResult}`;
          
          // Add relevant links if found
          if (links.length > 0) {
            const relevantLinks = filterRelevantLinks(links, instruction);
            if (relevantLinks.length > 0) {
              result += `\n\n🔗 **Related Links Found:**\n${relevantLinks.slice(0, 5).map(link => `• [${link.text}](${link.url})`).join('\n')}`;
            }
          }
          
          return result;
        }
      }
      
    } catch (error) {
      if (error.code === 'ENOTFOUND') {
        return `❌ Could not reach ${url} - domain not found`;
      } else if (error.code === 'ETIMEDOUT') {
        return `❌ Timeout while fetching ${url} - site took too long to respond`;
      } else if (error.response?.status) {
        return `❌ HTTP ${error.response.status} error while fetching ${url}`;
      } else {
        return `❌ Error fetching ${url}: ${error.message}`;
      }
    }
  },
  {
    name: 'fetch_url',
    category: 'core', 
    description: 'Fetch web page content (returns full sanitized content by default, or analyzed content with specific instruction)',
    formatResult: (result) => result
  }
);

// Helper functions
function parseTimeframe(timeframe) {
  const match = timeframe.match(/^(\d+)([hdw])$/);
  if (!match) return 24; // Default to 24 hours
  
  const [, amount, unit] = match;
  const num = parseInt(amount);
  
  switch (unit) {
    case 'h': return num;
    case 'd': return num * 24;
    case 'w': return num * 24 * 7;
    default: return 24;
  }
}

async function getMessagesByTimeframe(chatId, timeframe) {
  if (timeframe.includes('h')) {
    const hours = parseTimeframe(timeframe);
    return await MemorySearch.getMessagesFromLastHours(chatId, hours);
  } else if (timeframe.includes('d')) {
    const days = parseTimeframe(timeframe) / 24;
    return await MemorySearch.getMessagesFromLastDays(chatId, days);
  } else {
    // Default to hours
    const hours = parseTimeframe(timeframe);
    return await MemorySearch.getMessagesFromLastHours(chatId, hours);
  }
}

function formatMessagesResult(messages, description) {
  if (!messages || messages.length === 0) {
    return `📅 No messages found for ${description}.`;
  }
  
  let summary = `📅 Messages from ${description} (${messages.length} total):\n\n`;
  const recentMessages = messages.slice(-10);
  
  recentMessages.forEach((msg, index) => {
    const date = new Date(msg.timestamp).toLocaleDateString();
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const preview = msg.content.length > 80 ? 
      msg.content.substring(0, 80) + '...' : msg.content;
    
    summary += `${index + 1}. ${date} ${time}\n   "${preview}"\n`;
    if (msg.user) summary += `   From: ${msg.user}\n`;
    summary += '\n';
  });
  
  if (messages.length > 10) {
    summary += `... (showing last 10 of ${messages.length} messages)`;
  }
  
  return summary;
}

function formatTranscriptResults(messages, timeframe) {
  if (!messages || messages.length === 0) {
    return `🎤 No voice messages with transcripts found for ${timeframe}.`;
  }
  
  let summary = `🎤 Voice Message Transcripts from ${timeframe} (${messages.length} total):\n\n`;
  
  messages.slice(-10).forEach((msg, index) => {
    const date = new Date(msg.timestamp).toLocaleDateString();
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const voiceAttachment = msg.attachments.find(att => att.type === 'voice' && att.transcription);
    
    if (voiceAttachment) {
      summary += `${index + 1}. ${date} ${time}\n`;
      summary += `   From: ${msg.user || 'Unknown'}\n`;
      summary += `   Duration: ${voiceAttachment.duration}s\n`;
      summary += `   Transcript: "${voiceAttachment.transcription}"\n\n`;
    }
  });
  
  if (messages.length > 10) {
    summary += `... (showing last 10 of ${messages.length} voice messages)`;
  }
  
  return summary;
}

/**
 * Generate audio from text using Replicate API
 * @param {string} text - Text to convert to speech
 * @param {Object} options - Generation options
 * @param {string} chatId - Chat ID for sending the audio
 * @returns {Promise<string>} Success message
 */
export const generate_audio = createToolWrapper(
  async (text, options = {}, chatId) => {
    if (!chatId) {
      throw new Error('Chat ID is required for audio generation');
    }

    // Check daily usage limit for audio generation
    const { checkDailyLimit, recordUsage, getUsageLimitMessage } = await import('../services/usageLimits.js');
    const limitCheck = await checkDailyLimit(chatId.toString(), 'AUDIO_GENERATION');
    
    if (!limitCheck.allowed) {
      const errorMessage = getUsageLimitMessage('AUDIO_GENERATION', limitCheck);
      Logger.log(`Audio generation blocked for chat ${chatId}: daily limit exceeded (${limitCheck.currentCount}/${limitCheck.limit})`);
      
      // Track usage limit hit
      const { Analytics } = await import('../services/analytics.js');
      Analytics.trackUsageLimitHit(chatId, 'AUDIO_GENERATION', limitCheck.currentCount, limitCheck.limit);
      
      // Import TelegramAPI to send limit message
      const { TelegramAPI } = await import('../services/telegramAPI.js');
      await TelegramAPI.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      
      // Return termination marker to end conversation
      return {
        __MESSAGES_SENT__: true,
        audioType: 'limit_exceeded',
        limitInfo: limitCheck
      };
    }

    // Check if this is an appropriate use case
    if (!shouldGenerateAudio(text)) {
      Logger.log(`Audio generation may not be appropriate for: "${text.substring(0, 100)}..."`, 'warn');
    }

    Logger.log(`Generating audio for chat ${chatId}: "${text.substring(0, 100)}..." (${limitCheck.remaining - 1} remaining today)`);

    try {
      // Generate audio using the smart generation function
      const { buffer: audioBuffer, metadata } = await generateAudioSmart(text, options);

      // Import TelegramAPI here to avoid circular dependency
      const { TelegramAPI } = await import('../services/telegramAPI.js');

      // Always send as voice message (no audio files)
      const duration = Math.ceil(metadata.estimatedDuration);

      // Send as voice message
      const sentMessage = await TelegramAPI.sendVoice(chatId, audioBuffer, {
        caption: `🎤 Voice message (${duration}s)`,
        duration: duration,
        parse_mode: 'Markdown'
      });

      Logger.log(`Sent voice message ${sentMessage.message_id} to chat ${chatId}`);
      
      // Record successful usage and track analytics
      await recordUsage(chatId.toString(), 'AUDIO_GENERATION');
      
      const { Analytics } = await import('../services/analytics.js');
      Analytics.trackAudioGeneration(chatId, metadata.processedLength, duration, 'voice', true);
      
      // Return special marker to end conversation loop after audio generation
      return {
        __MESSAGES_SENT__: true,
        audioType: 'voice',
        duration: duration,
        characters: metadata.processedLength,
        messageId: sentMessage.message_id
      };

    } catch (error) {
      Logger.log(`Audio generation failed: ${error.message}`, 'error');
      
      // Track failed audio generation
      const { Analytics } = await import('../services/analytics.js');
      Analytics.trackAudioGeneration(chatId, text.length, 0, 'unknown', false);
      
      throw new Error(`Failed to generate audio: ${error.message}`);
    }
  },
  {
    name: 'generate_audio',
    category: 'core',
    description: 'Generate and send audio files from text using AI TTS',
    formatResult: (result) => result
  }
);

/**
 * Agent toolkit registry - simplified interface for agents
 */
export const AGENT_TOOLKIT = {
  search: {
    name: 'search',
    description: 'Universal search with ADVANCED QUERY TECHNIQUES - Always use quotes, boolean operators, and specific terms',
    examples: [
      'search(\'"climate change" impacts 2024 AND policy\', "news")',
      'search(\'"telegram bot" development tutorial OR guide\', "web")', 
      'search(\'"AI safety" research -hype -marketing\', "alternative")',
      'search(\'"machine learning" applications "December 2024"\', "reddit", {subreddit: "technology"})'
    ],
    advanced_techniques: [
      'QUOTED PHRASES: "exact phrase" for precision',
      'BOOLEAN OPERATORS: AND, OR, - for complex queries', 
      'TIME SPECIFIC: Add dates, "2024", "recent", "latest"',
      'EXCLUSIONS: Use -unwanted -terms to filter noise',
      'MULTI-ANGLE: Same topic across different source types'
    ],
    topics: ['web', 'news', 'images', 'videos', 'places', 'reddit', 'alternative']
  },
  
  messages: {
    name: 'messages', 
    description: 'Chat history operations: messages(chatId, action, params)',
    examples: [
      'messages(chatId, "search", {query: "budget"}) - Find messages containing keyword',
      'messages(chatId, "get", {timeframe: "24h"}) - Get recent messages with files/links/media',
      'messages(chatId, "summary", {timeframe: "2d"}) - Conversation summary including voice transcripts'
    ],
    actions: ['search', 'get', 'summary', 'filter', 'range']
  },
  
  images: {
    name: 'images',
    description: 'Image operations: images(chatId, action, params)',
    examples: [
      'images(chatId, "find", {date: "2025-06-27"})',
      'images(chatId, "search", {query: "receipts"})',
      'images(chatId, "extract-text", {timeframe: "48h"})',
      'images(chatId, "analyze", {query: "documents"})'
    ],
    actions: ['find', 'analyze', 'extract-text', 'search']
  },
  
  calculate: {
    name: 'calculate',
    description: 'Mathematical calculations: calculate(expression)',
    examples: [
      'calculate("2 + 2 * 3")',
      'calculate("sqrt(16)")',
      'calculate("sin(45 deg)")'
    ]
  },
  
  analyze: {
    name: 'analyze',
    description: 'Content analysis: analyze(content, action, options)',
    examples: [
      'analyze(text, "summarize", {maxPoints: 5})',
      'analyze(dataArray, "data", {operation: "count"})'
    ],
    actions: ['summarize', 'data']
  },
  
  browser: {
    name: 'browser',
    description: 'Browser automation for JavaScript-heavy sites, SPAs, and dynamic content: browser(url, action, options)',
    examples: [
      'browser("https://spa-site.com", "scrape", {waitFor: 5000, scrollDown: true})',
      'browser("https://js-heavy.com", "spa-scrape", {instruction: "find pricing"})',
      'browser("https://dynamic.com", "wait-and-scrape", {selector: ".content"})',
      'browser("https://site.com", "links", {instruction: "documentation"})',
      'browser("https://site.com", "screenshot", {fullPageScreenshot: true, instruction: "describe the layout"})'
    ],
    actions: ['scrape', 'screenshot', 'interact', 'wait-and-scrape', 'spa-scrape', 'links'],
    use_cases: [
      'Sites that require JavaScript to render content',
      'Single Page Applications (React, Vue, Angular)',
      'Dynamic content that loads after page load',
      'Sites requiring interaction or scrolling',
      'Complex web apps with client-side routing',
      'Screenshots with AI analysis for visual inspection'
    ]
  },
  
  analyze_image: {
    name: 'analyze_image',
    description: 'AI-powered image analysis using GPT-4.1-mini vision model: analyze_image(imageData, instruction, chatId)',
    examples: [
      'analyze_image(imageBuffer, "describe what you see", chatId)',
      'analyze_image(base64Image, "extract all text from this receipt", chatId)',
      'analyze_image(imageData, "identify the brand and model", chatId)',
      'analyze_image(screenshotData, "explain this error message", chatId)'
    ],
    use_cases: [
      'Analyzing uploaded images from chat',
      'OCR text extraction from photos',
      'Receipt and document analysis',
      'Screenshot troubleshooting',
      'Product identification and analysis',
      'Chart and diagram interpretation'
    ]
  },
  
  generate_audio: {
    name: 'generate_audio',
    description: 'Generate audio/voice files from text using AI text-to-speech: generate_audio(text, options, chatId)',
    examples: [
      'generate_audio("Welcome to our podcast episode about today\'s tech news", {}, chatId)',
      'generate_audio(podcastScript, {exaggeration: 0.3}, chatId)',
      'generate_audio("Here\'s your audio summary of the latest developments", {}, chatId)'
    ],
    use_cases: [
      'Create podcast-style audio content as complete response',
      'Generate voice responses when user requests audio',
      'Convert research findings into audio format',
      'Create voice narrations as final response'
    ],
    important: 'WORKFLOW: Use generate_audio DIRECTLY as final response (no text message needed). Creates exactly ONE audio file. MAX 1 MINUTE (1000 characters).',
    workflow: 'Research → generate_audio → END (audio-only response, max 1 minute)'
  }
};

/**
 * Extract links from HTML content
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {Array} Array of link objects with url and text
 */
function extractLinks(html, baseUrl) {
  const links = [];
  const baseUrlObj = new URL(baseUrl);
  
  // Extract all <a> tags with href attributes
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    let url = match[1];
    let text = match[2].replace(/<[^>]*>/g, '').trim(); // Remove HTML tags from link text
    
    // Skip if no meaningful text
    if (!text || text.length < 2) continue;
    
    // Resolve relative URLs
    try {
      if (url.startsWith('/')) {
        url = baseUrlObj.origin + url;
      } else if (url.startsWith('./') || url.startsWith('../')) {
        url = new URL(url, baseUrl).href;
      } else if (!url.startsWith('http')) {
        url = new URL(url, baseUrl).href;
      }
      
      // Skip non-web protocols
      if (!url.startsWith('http')) continue;
      
      links.push({ url, text: text.substring(0, 100) }); // Limit text length
    } catch (e) {
      // Invalid URL, skip
      continue;
    }
  }
  
  // Remove duplicates
  const uniqueLinks = links.filter((link, index, self) => 
    index === self.findIndex(l => l.url === link.url)
  );
  
  return uniqueLinks;
}

/**
 * Extract URLs from JSON data
 * @param {string} jsonContent - JSON content as string
 * @param {string} baseUrl - Base URL for context
 * @returns {Array} Array of link objects
 */
function extractLinksFromJson(jsonContent, baseUrl) {
  const links = [];
  
  try {
    // Find all URL-like patterns in the JSON
    const urlPattern = /(https?:\/\/[^\s"',\]}\)]+)/g;
    let match;
    
    while ((match = urlPattern.exec(jsonContent)) !== null) {
      const url = match[1];
      // Use domain as text since we don't have link text in JSON
      const domain = new URL(url).hostname;
      links.push({ url, text: domain });
    }
    
    // Remove duplicates
    return links.filter((link, index, self) => 
      index === self.findIndex(l => l.url === link.url)
    );
    
  } catch (e) {
    return [];
  }
}

/**
 * Filter links to find most relevant ones based on instruction
 * @param {Array} links - Array of link objects
 * @param {string} instruction - The search instruction
 * @returns {Array} Filtered and scored links
 */
function filterRelevantLinks(links, instruction) {
  if (!links || links.length === 0) return [];
  
  // Extract keywords from instruction
  const keywords = instruction.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['find', 'show', 'get', 'search', 'look', 'the', 'for', 'and', 'with'].includes(word));
  
  // Score links based on relevance
  const scoredLinks = links.map(link => {
    let score = 0;
    const linkText = link.text.toLowerCase();
    const linkUrl = link.url.toLowerCase();
    
    // Score based on keyword matches in text and URL
    keywords.forEach(keyword => {
      if (linkText.includes(keyword)) score += 3;
      if (linkUrl.includes(keyword)) score += 2;
    });
    
    // Boost score for certain patterns
    if (linkText.includes('result') || linkText.includes('match') || linkText.includes('score')) score += 2;
    if (linkText.includes('schedule') || linkText.includes('game') || linkText.includes('team')) score += 1;
    if (linkUrl.includes('/result') || linkUrl.includes('/match') || linkUrl.includes('/score')) score += 2;
    
    return { ...link, score };
  });
  
  // Sort by score and return top results
  return scoredLinks
    .filter(link => link.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Get simplified toolkit for agents
 * @returns {Object} Simplified agent toolkit
 */
export function getAgentToolkit() {
  return AGENT_TOOLKIT;
}