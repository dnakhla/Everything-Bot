import moment from 'moment';
import { OpenAI } from 'openai';
import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from './s3Manager.js';
import { TelegramAPI } from './telegramAPI.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
});

// Simple in-memory cache for searches
const searchCache = {};

/**
 * Save a bot message to S3
 * 
 * @param {string|number} chatId - The chat ID
 * @param {object} messageData - The message data to save
 * @returns {Promise<void>}
 */
export async function saveBotMessage(chatId, messageData) {
  const key = `fact_checker_bot/groups/${chatId}.json`;
  const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
    
  existingData.messages.push({
    isBot: true,
    message_from: 'Robot',
    messageId: messageData.message_id,
    message_text: messageData.text,
    timestamp: {
      unix: Date.now(),
      friendly: new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    },
  });
    
  await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, existingData);
}

/**
 * Save a user message to S3
 * 
 * @param {string|number} chatId - The chat ID
 * @param {object} message - The user message object
 * @returns {Promise<void>}
 */
export async function saveUserMessage(chatId, message) {
  const senderName = message.from.first_name || 'A ROBOT';
  const userMessage = {
    message_from: senderName,
    message_text: message.text,
    messageId: message.message_id,
    timestamp: {
      unix: Date.now(),
      friendly: new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    },
    isBot: false, // Indicate that this is a user message
  };

  const key = `fact_checker_bot/groups/${chatId}.json`;

  try {
    const existingData = 
            (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
    existingData.messages.push(userMessage);

    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, existingData);
    Logger.log(`Message saved to S3 for chat ID ${chatId}`);
  } catch (error) {
    Logger.log(`Error saving message to S3: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get all messages for a chat from S3
 * 
 * @param {string|number} chatId - The chat ID
 * @returns {Promise<Array>} - Promise that resolves with the messages
 */
export async function getMessagesFromS3(chatId) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
    Logger.log(`Fetching messages for chat ${chatId}`);
    const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    return data?.messages || [];
  } catch (error) {
    Logger.log(`Error getting messages: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Get messages from the last N hours
 * 
 * @param {string|number} chatId - The chat ID
 * @param {number} N - Number of hours to look back
 * @returns {Promise<Array>} - Promise that resolves with the filtered messages
 */
export async function getMessagesFromLastNhours(chatId, N) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
    const cutoffTime = moment().subtract(N, 'hours').valueOf();

    Logger.log(`Fetching messages for chat ${chatId} from the last ${N} hours`);

    const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);

    // Filter messages from the last hours using the timestamp
    const recentMessages = (data?.messages ?? []).filter(msg => {
      return msg.timestamp?.unix >= cutoffTime;
    });

    Logger.log(`Found ${recentMessages.length} messages within the time range`);
    return recentMessages;

  } catch (error) {
    if (error.name === 'NoSuchKey') {
      Logger.log(`No message history found for chat ${chatId}`, 'info');
    } else {
      Logger.log(`Error getting messages: ${error.message}`, 'error');
    }
    return [];
  }
}

/**
 * Get messages from the last 24 hours
 * 
 * @param {string|number} chatId - The chat ID
 * @returns {Promise<Array>} - Promise that resolves with the messages from the last 24 hours
 */
export async function getMessagesFromLast24Hours(chatId) {
  return getMessagesFromLastNhours(chatId, 24);
}

/**
 * Delete messages from Telegram
 * 
 * @param {string|number} chatId - The chat ID
 * @param {Array<string|number>} messageIds - Array of message IDs to delete
 * @returns {Promise<void>}
 */
export async function deleteMessages(chatId, messageIds) {
  for (const messageId of messageIds) {
    try {
      await TelegramAPI.deleteMessage(chatId, messageId);
      Logger.log(`Deleted message with ID ${messageId} in chat ${chatId}`);
    } catch (error) {
      Logger.log(`Failed to delete message ${messageId}: ${error.message}`, 'error');
    }
  }
}

/**
 * Perform a search using Google Serper API
 * 
 * @param {string} query - The search query
 * @returns {Promise<string>} - Promise that resolves with the formatted search results
 */
export async function performGoogleSearch(query) {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  if (searchCache[cacheKey]) {
    Logger.log(`Using cached search results for query: "${query}"`);
    return searchCache[cacheKey];
  }
    
  let data = JSON.stringify({
    'q': query
  });
    
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://google.serper.dev/search',
    headers: { 
      'X-API-KEY': CONFIG.SERPER_API_KEY, 
      'Content-Type': 'application/json'
    },
    data: data,
    timeout: 10000 // 10 seconds
  };

  try {
    Logger.log(`Performing Google search for query: "${query}"`);
        
    const response = await axios.request(config);
    Logger.log(`Serper API status: ${response.status}`);
    const data = response.data;

    // Prepare response string
    let resultSummary = '';

    // Knowledge Graph
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      resultSummary += '💡 *Knowledge Graph*\n';
      resultSummary += `- **Title:** ${kg.title}\n`;
      resultSummary += `- **Type:** ${kg.type}\n`;
      resultSummary += `- **Description:** ${kg.description}\n`;
      resultSummary += `- **Source:** [${kg.descriptionSource}](${kg.descriptionLink})\n\n`;
    }

    // Organic Results
    if (data.organic && data.organic.length > 0) {
      resultSummary += '🌐 *Top Organic Results*\n';
      data.organic.slice(0, 10).forEach((result, index) => {
        resultSummary += `${index + 1}. **${result.title}**\n   ${result.link}\n   _${result.snippet}_\n`;
      });
      resultSummary += '\n';
    }

    // People Also Ask
    if (data.peopleAlsoAsk && data.peopleAlsoAsk.length > 0) {
      resultSummary += '🤔 *People Also Ask*\n';
      data.peopleAlsoAsk.slice(0, 10).forEach((question, index) => {
        resultSummary += `${index + 1}. **${question.question}**\n   _${question.snippet}_\n   [Read More](${question.link})\n`;
      });
      resultSummary += '\n';
    }

    // Related Searches
    if (data.relatedSearches && data.relatedSearches.length > 0) {
      resultSummary += '🔍 *Related Searches*\n';
      resultSummary += data.relatedSearches.slice(0, 5).map(rs => `- ${rs.query}`).join('\n');
    }

    const finalResult = resultSummary || 'No relevant context found from Google.';
    // Cache the successful result
    searchCache[cacheKey] = finalResult;
    return finalResult;
  } catch (error) {
    Logger.log(`Google search failed: ${error.message}`, 'error');
        
    // Try using Brave Search API as fallback
    try {
      Logger.log(`Falling back to Brave Search API for query: "${query}"`);
      return await performBraveSearch(query);
    } catch (braveError) {
      Logger.log(`Brave search also failed: ${braveError.message}`, 'error');
      return 'Failed to retrieve search results. Please try again later.';
    }
  }
}

/**
 * Perform a search using Brave Search API (fallback)
 * 
 * @param {string} query - The search query
 * @returns {Promise<string>} - Promise that resolves with the formatted search results
 */
export async function performBraveSearch(query) {
  const cacheKey = `brave_${query.toLowerCase().trim()}`;
  if (searchCache[cacheKey]) {
    Logger.log(`Using cached Brave search results for query: "${query}"`);
    return searchCache[cacheKey];
  }
    
  try {
    Logger.log(`Performing Brave search for query: "${query}"`);
        
    const config = {
      method: 'get',
      url: `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': CONFIG.BRAVE_API_KEY
      },
      timeout: 10000 // 10 seconds
    };
        
    const response = await axios.request(config);
    Logger.log(`Brave API status: ${response.status}`);
    const data = response.data;
        
    // Format the results
    let resultSummary = '';
        
    // Web results
    if (data.web && data.web.results && data.web.results.length > 0) {
      resultSummary += '🌐 *Web Results*\n';
      data.web.results.slice(0, 10).forEach((result, index) => {
        resultSummary += `${index + 1}. **${result.title}**\n   ${result.url}\n   _${result.description}_\n`;
      });
      resultSummary += '\n';
    }
        
    // Knowledge graph / featured snippet
    if (data.featured_snippet) {
      resultSummary += '💡 *Featured Information*\n';
      resultSummary += `- **${data.featured_snippet.title || 'Information'}**\n`;
      resultSummary += `- ${data.featured_snippet.description}\n`;
      if (data.featured_snippet.url) {
        resultSummary += `- Source: [${data.featured_snippet.url}](${data.featured_snippet.url})\n`;
      }
      resultSummary += '\n';
    }
        
    // Related searches
    if (data.query && data.query.related_queries && data.query.related_queries.length > 0) {
      resultSummary += '🔍 *Related Searches*\n';
      resultSummary += data.query.related_queries.slice(0, 5).map(q => `- ${q}`).join('\n');
    }
        
    const finalResult = resultSummary || 'No relevant results found from Brave Search.';
    // Cache the successful result
    searchCache[cacheKey] = finalResult;
    return finalResult;
  } catch (error) {
    Logger.log(`Brave search failed: ${error.message}`, 'error');
    throw error; // Let the caller handle this error
  }
}

/**
 * Fetch content from a URL
 * 
 * @param {string} url - The URL to fetch content from
 * @returns {Promise<string>} - Promise that resolves with the content summary
 */
export async function fetchUrlContent(url) {
  // Check cache first using URL as key
  const cacheKey = `url_${url.toLowerCase().trim()}`;
  if (searchCache[cacheKey]) {
    Logger.log(`Using cached URL content for: ${url}`);
    return searchCache[cacheKey];
  }
  
  try {
    Logger.log(`Fetching content from URL: ${url}`);
    
    const config = {
      method: 'get',
      url: url,
      timeout: 15000, // 15 seconds
      maxContentLength: 1024 * 1024, // Limit to 1MB
      headers: {
        'User-Agent': 'FactChecker Bot/1.0'
      }
    };
    
    const response = await axios.request(config);
    
    // Only process HTML content
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      return `Content from ${url} is not HTML (${contentType}). Cannot extract meaningful content.`;
    }
    
    // Extract title and main content (simplified approach)
    const html = response.data;
    let title = '';
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }
    
    // Create a simple content summary
    let contentSummary = `📄 *Content from ${url}*\n`;
    contentSummary += `📌 **Title:** ${title || 'No title'}\n\n`;
    
    // Extract text content (simplified approach - in reality you might want a proper HTML parser)
    let textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')     // Remove styles
      .replace(/<[^>]+>/g, ' ')                                              // Remove HTML tags
      .replace(/\s+/g, ' ')                                                 // Normalize whitespace
      .trim();
    
    // Limit content length for reasonable response
    if (textContent.length > 2000) {
      textContent = textContent.substring(0, 2000) + '... (content truncated)';
    }
    
    contentSummary += textContent;
    
    // Cache the result
    searchCache[cacheKey] = contentSummary;
    return contentSummary;
  } catch (error) {
    Logger.log(`Failed to fetch URL content: ${error.message}`, 'error');
    return `Failed to retrieve content from ${url}: ${error.message}`;
  }
}