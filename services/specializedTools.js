import { evaluate, parse, format } from 'mathjs';
import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Perform mathematical calculations and evaluations
 * @param {string} expression - Mathematical expression to evaluate
 * @returns {string} Formatted result
 */
export async function performMathCalculation(expression) {
  try {
    Logger.log(`Performing math calculation: ${expression}`);
        
    // Parse and evaluate the mathematical expression
    const result = evaluate(expression);
        
    // Format the result appropriately
    let formattedResult;
    if (typeof result === 'number') {
      // Round to reasonable precision for display
      formattedResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(8));
    } else if (typeof result === 'object' && result.toString) {
      formattedResult = result.toString();
    } else {
      formattedResult = result;
    }
        
    return `Math calculation: ${expression} = ${formattedResult}`;
        
  } catch (error) {
    Logger.log(`Math calculation error: ${error.message}`, 'error');
    return `Error calculating "${expression}": ${error.message}`;
  }
}

/**
 * Search Reddit for discussions and opinions on a topic
 * @param {string} query - Search query for Reddit
 * @param {string} subreddit - Specific subreddit to search (optional, defaults to 'all')
 * @returns {string} Reddit search results
 */
export async function searchReddit(query, subreddit = 'all') {
  try {
    Logger.log(`Searching Reddit: ${query} in r/${subreddit}`);
        
    // Use Reddit JSON API - no authentication needed for public posts
    const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=10&t=week`;
        
    const config = {
      method: 'get',
      url: searchUrl,
      headers: {
        'User-Agent': 'TelegramBot/1.0'
      },
      timeout: 10000
    };

    const response = await axios.request(config);
    const data = response.data;
        
    let resultSummary = `🔴 Reddit Discussion: "${query}" in r/${subreddit}\n\n`;
        
    if (data.data && data.data.children && data.data.children.length > 0) {
      const posts = data.data.children.slice(0, 10);
            
      posts.forEach((post, index) => {
        const postData = post.data;
        resultSummary += `${index + 1}. ${postData.title}\n`;
        resultSummary += `   👍 ${postData.ups} upvotes | 💬 ${postData.num_comments} comments\n`;
        resultSummary += `   r/${postData.subreddit} • u/${postData.author}\n`;
        if (postData.selftext && postData.selftext.length > 0) {
          const preview = postData.selftext.slice(0, 150) + (postData.selftext.length > 150 ? '...' : '');
          resultSummary += `   "${preview}"\n`;
        }
        resultSummary += `   https://reddit.com${postData.permalink}\n\n`;
      });
    } else {
      resultSummary += 'No recent discussions found on this topic.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Reddit search error: ${error.message}`, 'error');
    return `Error searching Reddit: ${error.message}`;
  }
}

/**
 * Get top posts from specific Reddit communities
 * @param {string} subreddit - Subreddit name (without r/)
 * @param {string} timeframe - Time period: hour, day, week, month, year, all
 * @returns {string} Top Reddit posts
 */
export async function getRedditPosts(subreddit, timeframe = 'day') {
  try {
    Logger.log(`Getting top posts from r/${subreddit} for ${timeframe}`);
        
    const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeframe}&limit=8`;
        
    const config = {
      method: 'get',
      url: url,
      headers: {
        'User-Agent': 'TelegramBot/1.0'
      },
      timeout: 10000
    };

    const response = await axios.request(config);
    const data = response.data;
        
    let resultSummary = `🔴 Top Posts from r/${subreddit} (${timeframe})\n\n`;
        
    if (data.data && data.data.children && data.data.children.length > 0) {
      const posts = data.data.children.slice(0, 10);
            
      posts.forEach((post, index) => {
        const postData = post.data;
        resultSummary += `${index + 1}. ${postData.title}\n`;
        resultSummary += `   👍 ${postData.ups} upvotes | 💬 ${postData.num_comments} comments\n`;
        resultSummary += `   u/${postData.author} • ${new Date(postData.created_utc * 1000).toLocaleDateString()}\n`;
        resultSummary += `   https://reddit.com${postData.permalink}\n\n`;
      });
    } else {
      resultSummary += 'No posts found in this subreddit.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Reddit posts error: ${error.message}`, 'error');
    return `Error getting Reddit posts: ${error.message}`;
  }
}

/**
 * Search unpopular/alternative sites for diverse perspectives
 * @param {string} query - Search query
 * @returns {string} Results from alternative sources
 */
export async function searchUnpopularSites(query) {
  try {
    Logger.log(`Searching unpopular sites for: ${query}`);
        
    // Search specific alternative/niche sites that might have different perspectives
    const alternativeSites = [
      'site:medium.com',
      'site:substack.com',
      'site:x.com',
      'site:hackernews.com',
      'site:arstechnica.com',
      'site:techdirt.com',
      'site:slashdot.org',
      'site:stratechery.com',
      'site:marginalrevolution.com',
      'site:reason.com'
    ];
        
    const searchQuery = `${query} (${alternativeSites.join(' OR ')})`;
        
    const data = JSON.stringify({
      'q': searchQuery,
      'num': 8
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
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `🔍 Alternative Sources for "${query}":\n\n`;
        
    if (results.organic && results.organic.length > 0) {
      results.organic.slice(0, 10).forEach((result, index) => {
        resultSummary += `${index + 1}. ${result.title}\n`;
        resultSummary += `   ${result.snippet}\n`;
        resultSummary += `   Source: ${result.link}\n\n`;
      });
    } else {
      resultSummary += 'No alternative sources found for this topic.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Unpopular sites search error: ${error.message}`, 'error');
    return `Error searching alternative sources: ${error.message}`;
  }
}

/**
 * Search for current news articles using Google News
 * @param {string} query - News search query
 * @returns {string} Formatted news search results
 */
export async function performNewsSearch(query) {
  try {
    Logger.log(`Performing news search for: ${query}`);
        
    const data = JSON.stringify({
      'q': query,
      'num': 8
    });
        
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/news',
      headers: { 
        'X-API-KEY': CONFIG.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `📰 News Results for "${query}":\n\n`;
        
    if (results.news && results.news.length > 0) {
      results.news.slice(0, 10).forEach((article, index) => {
        resultSummary += `${index + 1}. ${article.title}\n`;
        resultSummary += `   ${article.snippet}\n`;
        resultSummary += `   Source: ${article.source} • ${article.date || 'Recent'}\n`;
        resultSummary += `   Link: ${article.link}\n\n`;
      });
    } else {
      resultSummary += 'No recent news found for this query.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`News search error: ${error.message}`, 'error');
    return `Error searching for news: ${error.message}`;
  }
}

/**
 * Search for places and locations using Google Places
 * @param {string} query - Place search query
 * @returns {string} Formatted places search results
 */
export async function performPlacesSearch(query) {
  try {
    Logger.log(`Performing places search for: ${query}`);
        
    const data = JSON.stringify({
      'q': query,
      'num': 6
    });
        
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/places',
      headers: { 
        'X-API-KEY': CONFIG.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `📍 Places Results for "${query}":\n\n`;
        
    if (results.places && results.places.length > 0) {
      results.places.slice(0, 10).forEach((place, index) => {
        resultSummary += `${index + 1}. ${place.title}\n`;
        if (place.address) resultSummary += `   📍 ${place.address}\n`;
        if (place.rating) resultSummary += `   ⭐ ${place.rating} (${place.ratingCount || 0} reviews)\n`;
        if (place.phoneNumber) resultSummary += `   📞 ${place.phoneNumber}\n`;
        if (place.website) resultSummary += `   🌐 ${place.website}\n`;
        resultSummary += '\n';
      });
    } else {
      resultSummary += 'No places found for this query.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Places search error: ${error.message}`, 'error');
    return `Error searching for places: ${error.message}`;
  }
}

/**
 * Summarize a large text or data into key points
 * @param {string} content - Content to summarize
 * @param {number} maxPoints - Maximum number of key points (default: 5)
 * @returns {string} Summarized content
 */
export async function summarizeContent(content, maxPoints = 5) {
  try {
    Logger.log(`Summarizing content (${content.length} chars) into ${maxPoints} points using LLM`);
        
    // Import OpenAI at the top level to avoid repeated imports
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
    });
        
    // Use LLM to summarize content
    const response = await openai.chat.completions.create({
      model: CONFIG.GPT_MODEL || 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a content summarizer. Extract the ${maxPoints} most important points from the given content. Format as a numbered list. Be concise but informative.`
        },
        {
          role: 'user',
          content: `Summarize this content into ${maxPoints} key points:\n\n${content}`
        }
      ],
      temperature: 0.3,
      max_tokens: 400
    });
        
    const summary = response.choices[0].message.content;
    return `📝 Summary (${maxPoints} key points):\n\n${summary}`;
        
  } catch (error) {
    Logger.log(`Summarize error: ${error.message}`, 'error');
    return `Error summarizing content: ${error.message}`;
  }
}

/**
 * Filter data based on criteria
 * @param {Array} data - Array of data to filter
 * @param {string} criteria - Filter criteria (e.g., "contains:keyword", "date:recent", "score:>5")
 * @returns {string} Filtered results
 */
export async function filterData(data, criteria) {
  try {
    Logger.log(`Filtering ${data.length} items with criteria: ${criteria}`);
        
    if (!Array.isArray(data)) {
      return 'Error: Data must be an array to filter';
    }
        
    let filtered = [...data];
        
    // Parse criteria
    const [type, value] = criteria.split(':');
        
    switch (type.toLowerCase()) {
    case 'contains':
      filtered = data.filter(item => 
        JSON.stringify(item).toLowerCase().includes(value.toLowerCase())
      );
      break;
                
    case 'date':
      if (value === 'recent') {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        filtered = data.filter(item => {
          const itemDate = new Date(item.date || item.timestamp || item.created_at);
          return itemDate.getTime() > oneDayAgo;
        });
      }
      break;
                
    case 'score':
      const operator = value.match(/^([><=]+)(.+)$/);
      if (operator) {
        const op = operator[1];
        const threshold = parseFloat(operator[2]);
        filtered = data.filter(item => {
          const score = item.score || item.rating || item.ups || 0;
          switch (op) {
          case '>': return score > threshold;
          case '<': return score < threshold;
          case '>=': return score >= threshold;
          case '<=': return score <= threshold;
          case '=': case '==': return score === threshold;
          default: return true;
          }
        });
      }
      break;
                
    case 'length':
      const lengthOp = value.match(/^([><=]+)(.+)$/);
      if (lengthOp) {
        const op = lengthOp[1];
        const threshold = parseInt(lengthOp[2]);
        filtered = data.filter(item => {
          const text = item.text || item.content || item.title || '';
          const length = text.length;
          switch (op) {
          case '>': return length > threshold;
          case '<': return length < threshold;
          case '>=': return length >= threshold;
          case '<=': return length <= threshold;
          default: return true;
          }
        });
      }
      break;
                
    default:
      return `❌ Unknown filter criteria: ${criteria}. Use contains:keyword, date:recent, score:>5, length:>100`;
    }
        
    return `🔍 Filter Results: ${filtered.length}/${data.length} items match criteria "${criteria}"\n\n${JSON.stringify(filtered.slice(0, 5), null, 2)}${filtered.length > 5 ? '\n... (showing first 5)' : ''}`;
        
  } catch (error) {
    Logger.log(`Filter error: ${error.message}`, 'error');
    return `Error filtering data: ${error.message}`;
  }
}

/**
 * Sort data by specified field
 * @param {Array} data - Array of data to sort
 * @param {string} sortBy - Field to sort by (e.g., "date", "score", "title")
 * @param {string} order - Sort order: "asc" or "desc" (default: "desc")
 * @returns {string} Sorted results
 */
export async function sortData(data, sortBy, order = 'desc') {
  try {
    Logger.log(`Sorting ${data.length} items by ${sortBy} (${order})`);
        
    if (!Array.isArray(data)) {
      return 'Error: Data must be an array to sort';
    }
        
    const sorted = [...data].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
            
      // Handle nested properties
      if (sortBy.includes('.')) {
        const path = sortBy.split('.');
        aVal = path.reduce((obj, key) => obj?.[key], a);
        bVal = path.reduce((obj, key) => obj?.[key], b);
      }
            
      // Handle different data types
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
            
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }
            
      // Handle dates
      if (aVal && bVal && (new Date(aVal).toString() !== 'Invalid Date')) {
        const dateA = new Date(aVal).getTime();
        const dateB = new Date(bVal).getTime();
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      }
            
      // Default comparison
      return 0;
    });
        
    return `📊 Sort Results: ${sorted.length} items sorted by "${sortBy}" (${order})\n\n${JSON.stringify(sorted.slice(0, 5), null, 2)}${sorted.length > 5 ? '\n... (showing first 5)' : ''}`;
        
  } catch (error) {
    Logger.log(`Sort error: ${error.message}`, 'error');
    return `Error sorting data: ${error.message}`;
  }
}

/**
 * Reduce/aggregate data to extract insights
 * @param {Array} data - Array of data to analyze
 * @param {string} operation - Operation to perform: "count", "average", "sum", "group", "trends"
 * @param {string} field - Field to operate on (optional)
 * @returns {string} Analysis results
 */
export async function analyzeData(data, operation, field = null) {
  try {
    Logger.log(`Analyzing ${data.length} items: ${operation} operation on field "${field}"`);
        
    if (!Array.isArray(data)) {
      return 'Error: Data must be an array to analyze';
    }
        
    let result = '';
        
    switch (operation.toLowerCase()) {
    case 'count':
      if (field) {
        const counts = {};
        data.forEach(item => {
          const value = item[field] || 'unknown';
          counts[value] = (counts[value] || 0) + 1;
        });
        result = `📊 Count by ${field}:\n${Object.entries(counts)
          .sort(([,a], [,b]) => b - a)
          .map(([key, count]) => `• ${key}: ${count}`)
          .join('\n')}`;
      } else {
        result = `📊 Total count: ${data.length} items`;
      }
      break;
                
    case 'average':
    case 'avg':
      if (!field) return 'Error: Field required for average operation';
      const values = data.map(item => parseFloat(item[field])).filter(v => !isNaN(v));
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      result = `📊 Average ${field}: ${avg.toFixed(2)} (from ${values.length} valid values)`;
      break;
                
    case 'sum':
      if (!field) return 'Error: Field required for sum operation';
      const sumValues = data.map(item => parseFloat(item[field])).filter(v => !isNaN(v));
      const total = sumValues.reduce((sum, val) => sum + val, 0);
      result = `📊 Sum of ${field}: ${total} (from ${sumValues.length} valid values)`;
      break;
                
    case 'group':
      if (!field) return 'Error: Field required for group operation';
      const groups = {};
      data.forEach(item => {
        const groupKey = item[field] || 'unknown';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
      });
      result = `📊 Grouped by ${field}:\n${Object.entries(groups)
        .sort(([,a], [,b]) => b.length - a.length)
        .map(([key, items]) => `• ${key}: ${items.length} items`)
        .join('\n')}`;
      break;
                
    case 'trends':
      if (!field) return 'Error: Field required for trends operation';
      const dateField = field || 'date';
      const timeData = data
        .filter(item => item[dateField])
        .map(item => ({
          date: new Date(item[dateField]),
          item
        }))
        .sort((a, b) => a.date - b.date);
                
      if (timeData.length < 2) {
        result = '📊 Insufficient data for trend analysis';
      } else {
        const timeSpan = timeData[timeData.length - 1].date - timeData[0].date;
        const days = Math.ceil(timeSpan / (1000 * 60 * 60 * 24));
        result = `📊 Trends over ${days} days:\n• ${timeData.length} data points\n• ${(timeData.length / days).toFixed(1)} items per day average`;
      }
      break;
                
    default:
      return `❌ Unknown operation: ${operation}. Use: count, average, sum, group, trends`;
    }
        
    return result;
        
  } catch (error) {
    Logger.log(`Analysis error: ${error.message}`, 'error');
    return `Error analyzing data: ${error.message}`;
  }
}

/**
 * Search for accommodation using Booking.com-style search
 * @param {string} location - Location to search (city, country, etc.)
 * @param {string} checkin - Check-in date (YYYY-MM-DD)
 * @param {string} checkout - Check-out date (YYYY-MM-DD)
 * @param {number} adults - Number of adults (default: 2)
 * @param {number} rooms - Number of rooms (default: 1)
 * @returns {string} Accommodation search results
 */
export async function searchAccommodation(location, checkin, checkout, adults = 2, rooms = 1) {
  try {
    Logger.log(`Searching accommodation: ${location}, ${checkin} to ${checkout}, ${adults} adults, ${rooms} rooms`);
        
    // For now, we'll use a web search approach to find accommodation
    // Since we don't have direct Booking.com API access, we'll search for hotels
    const searchQuery = `${location} hotels ${checkin} to ${checkout} booking accommodation`;
        
    const data = JSON.stringify({
      'q': searchQuery,
      'num': 8
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
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `🏨 Accommodation Search for "${location}"\n`;
    resultSummary += `📅 ${checkin} to ${checkout} • ${adults} adults • ${rooms} room(s)\n\n`;
        
    // Check for featured snippets with booking info
    if (results.answerBox) {
      resultSummary += `💡 Quick Info:\n${results.answerBox.answer || results.answerBox.snippet}\n\n`;
    }
        
    // Include top booking-related results
    if (results.organic && results.organic.length > 0) {
      resultSummary += '🔗 Booking Options:\n';
      let hotelCount = 0;
      results.organic.forEach((result, index) => {
        if (hotelCount < 10 && (
          result.link.includes('booking.com') || 
                    result.link.includes('hotels.com') || 
                    result.link.includes('expedia.com') ||
                    result.link.includes('airbnb.com') ||
                    result.title.toLowerCase().includes('hotel') ||
                    result.title.toLowerCase().includes('accommodation')
        )) {
          resultSummary += `${hotelCount + 1}. ${result.title}\n`;
          resultSummary += `   ${result.snippet}\n`;
          resultSummary += `   Book: ${result.link}\n\n`;
          hotelCount++;
        }
      });
    }
        
    // Add helpful booking tips
    resultSummary += '💡 Booking Tips:\n';
    resultSummary += '• Compare prices across multiple sites\n';
    resultSummary += '• Check cancellation policies\n';
    resultSummary += '• Read recent reviews\n';
    resultSummary += '• Book directly with hotel for best rates';
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Accommodation search error: ${error.message}`, 'error');
    return `Error searching for accommodation: ${error.message}`;
  }
}

/**
 * Search for images using Google Images API via Serper
 * @param {string} query - Image search query
 * @returns {string} Formatted image search results
 */
export async function performImageSearch(query) {
  try {
    Logger.log(`Performing image search for: ${query}`);
        
    const data = JSON.stringify({
      'q': query,
      'num': 8 // Limit results
    });
        
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/images',
      headers: { 
        'X-API-KEY': CONFIG.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `🖼️ Image Search Results for "${query}":\n`;
        
    if (results.images && results.images.length > 0) {
      results.images.slice(0, 10).forEach((img, index) => {
        resultSummary += `${index + 1}. ${img.title}\n`;
        resultSummary += `   Source: ${img.source || 'Unknown'}\n`;
        resultSummary += `   Link: ${img.link}\n`;
        if (img.imageUrl) {
          resultSummary += `   Image URL: ${img.imageUrl}\n`;
        }
        resultSummary += '\n';
      });
    } else {
      resultSummary += 'No images found for this query.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Image search error: ${error.message}`, 'error');
    return `Error searching for images: ${error.message}`;
  }
}

/**
 * Search for videos using Google Video search via Serper
 * @param {string} query - Video search query
 * @returns {string} Formatted video search results
 */
export async function performVideoSearch(query) {
  try {
    Logger.log(`Performing video search for: ${query}`);
        
    const data = JSON.stringify({
      'q': query,
      'num': 6 // Limit results
    });
        
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/videos',
      headers: { 
        'X-API-KEY': CONFIG.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 10000
    };

    const response = await axios.request(config);
    const results = response.data;
        
    let resultSummary = `🎥 Video Search Results for "${query}":\n`;
        
    if (results.videos && results.videos.length > 0) {
      results.videos.slice(0, 10).forEach((video, index) => {
        resultSummary += `${index + 1}. ${video.title}\n`;
        resultSummary += `   Channel: ${video.channel || 'Unknown'}\n`;
        resultSummary += `   Duration: ${video.duration || 'N/A'}\n`;
        resultSummary += `   Link: ${video.link}\n`;
        if (video.date) {
          resultSummary += `   Published: ${video.date}\n`;
        }
        resultSummary += '\n';
      });
    } else {
      resultSummary += 'No videos found for this query.\n';
    }
        
    return resultSummary;
        
  } catch (error) {
    Logger.log(`Video search error: ${error.message}`, 'error');
    return `Error searching for videos: ${error.message}`;
  }
}

