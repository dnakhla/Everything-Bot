import axios from 'axios';
import { Logger } from '../utils/logger.js';

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