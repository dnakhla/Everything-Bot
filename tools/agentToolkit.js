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
import { createToolWrapper } from '../utils/toolWrapper.js';

/**
 * Unified search tool - handles all types of search with topic selection
 * @param {string} query - What to search for
 * @param {string} topic - Search type: 'web', 'news', 'images', 'videos', 'places', 'reddit', 'alternative'
 * @param {Object} options - Additional search options
 * @returns {string} Formatted search results
 */
export const search = createToolWrapper(
  async (query, topic = 'web', options = {}) => {
    const { subreddit = 'all', timeframe = 'week', maxResults = 10 } = options;
    
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
 * Agent toolkit registry - simplified interface for agents
 */
export const AGENT_TOOLKIT = {
  search: {
    name: 'search',
    description: 'Universal search: search(query, topic, options)',
    examples: [
      'search("climate change", "news")',
      'search("pizza", "places")', 
      'search("cats", "images")',
      'search("AI", "reddit", {subreddit: "technology"})'
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
  }
};

/**
 * Get simplified toolkit for agents
 * @returns {Object} Simplified agent toolkit
 */
export function getAgentToolkit() {
  return AGENT_TOOLKIT;
}