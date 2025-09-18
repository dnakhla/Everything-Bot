import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Core search service functions using SerpAPI
 * These are the underlying implementations that tools wrap around
 */

/**
 * Perform general web search using SerpAPI
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Search results
 */
export async function performWebSearch(query, options = {}) {
  const { num = 8, sites = [] } = options;

  let searchQuery = query;
  if (sites.length > 0) {
    searchQuery = `${query} (${sites.map(site => `site:${site}`).join(' OR ')})`;
  }

  const params = {
    engine: 'google',
    q: searchQuery,
    num: num,
    api_key: CONFIG.SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  };

  const config = {
    method: 'get',
    url: 'https://serpapi.com/search',
    params: params,
    timeout: 15000
  };

  try {
    Logger.log(`SerpAPI web search: "${searchQuery}"`);
    const response = await axios.request(config);
    const results = response.data.organic_results || [];
    Logger.log(`Found ${results.length} web results`);
    return results.map(result => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      displayLink: result.displayed_link,
      source: result.source
    }));
  } catch (error) {
    Logger.log(`SerpAPI web search error: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Perform news search using SerpAPI
 * @param {string} query - News search query
 * @returns {Array} News results
 */
export async function performNewsSearch(query) {
  const params = {
    engine: 'google_news',
    q: query,
    api_key: CONFIG.SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  };

  const config = {
    method: 'get',
    url: 'https://serpapi.com/search',
    params: params,
    timeout: 15000
  };

  try {
    Logger.log(`SerpAPI news search: "${query}"`);
    const response = await axios.request(config);
    const results = response.data.news_results || [];
    Logger.log(`Found ${results.length} news results`);
    return results.map(result => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet || result.summary,
      source: result.source,
      date: result.date,
      thumbnail: result.thumbnail
    }));
  } catch (error) {
    Logger.log(`SerpAPI news search error: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Perform places search using SerpAPI
 * @param {string} query - Places search query
 * @returns {Array} Places results
 */
export async function performPlacesSearch(query) {
  const params = {
    engine: 'google_maps',
    q: query,
    api_key: CONFIG.SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  };

  const config = {
    method: 'get',
    url: 'https://serpapi.com/search',
    params: params,
    timeout: 15000
  };

  try {
    Logger.log(`SerpAPI places search: "${query}"`);
    const response = await axios.request(config);
    const results = response.data.local_results || [];
    Logger.log(`Found ${results.length} place results`);
    return results.map(result => ({
      title: result.title,
      address: result.address,
      phone: result.phone,
      rating: result.rating,
      reviews: result.reviews,
      hours: result.hours,
      website: result.website,
      place_id: result.place_id
    }));
  } catch (error) {
    Logger.log(`SerpAPI places search error: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Perform image search using SerpAPI
 * @param {string} query - Image search query
 * @returns {Array} Image results
 */
export async function performImageSearch(query) {
  const params = {
    engine: 'google_images',
    q: query,
    api_key: CONFIG.SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  };

  const config = {
    method: 'get',
    url: 'https://serpapi.com/search',
    params: params,
    timeout: 15000
  };

  try {
    Logger.log(`SerpAPI image search: "${query}"`);
    const response = await axios.request(config);
    const results = response.data.images_results || [];
    Logger.log(`Found ${results.length} image results`);
    return results.map(result => ({
      title: result.title,
      link: result.link,
      original: result.original,
      thumbnail: result.thumbnail,
      source: result.source,
      width: result.original_width,
      height: result.original_height
    }));
  } catch (error) {
    Logger.log(`SerpAPI image search error: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Perform video search using SerpAPI (YouTube)
 * @param {string} query - Video search query
 * @returns {Array} Video results
 */
export async function performVideoSearch(query) {
  const params = {
    engine: 'youtube',
    search_query: query,
    api_key: CONFIG.SERPAPI_KEY
  };

  const config = {
    method: 'get',
    url: 'https://serpapi.com/search',
    params: params,
    timeout: 15000
  };

  try {
    Logger.log(`SerpAPI YouTube search: "${query}"`);
    const response = await axios.request(config);
    const results = response.data.video_results || [];
    Logger.log(`Found ${results.length} video results`);
    return results.map(result => ({
      title: result.title,
      link: result.link,
      thumbnail: result.thumbnail?.static,
      channel: result.channel?.name,
      duration: result.length,
      views: result.views,
      published: result.published_date,
      description: result.description
    }));
  } catch (error) {
    Logger.log(`SerpAPI YouTube search error: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Perform Reddit search using SerpAPI
 * @param {string} query - Reddit search query
 * @returns {Array} Reddit results
 */
export async function performRedditSearch(query) {
  const params = {
    engine: 'google',
    q: `site:reddit.com ${query}`,
    api_key: CONFIG.SERPAPI_KEY,
    gl: 'us',
    hl: 'en'
  };

  const config = {
    method: 'get',
    url: 'https://serpapi.com/search',
    params: params,
    timeout: 15000
  };

  try {
    Logger.log(`SerpAPI Reddit search: "${query}"`);
    const response = await axios.request(config);
    const results = response.data.organic_results || [];
    Logger.log(`Found ${results.length} Reddit results`);
    return results.map(result => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      displayLink: result.displayed_link,
      source: result.source
    }));
  } catch (error) {
    Logger.log(`SerpAPI Reddit search error: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Search alternative/unpopular sites for diverse perspectives
 * @param {string} query - Search query
 * @returns {Array} Alternative search results
 */
export async function searchAlternativeSites(query) {
  const alternativeSites = [
    'medium.com',
    'substack.com',
    'x.com',
    'hackernews.com',
    'arstechnica.com',
    'techdirt.com',
    'slashdot.org',
    'stratechery.com',
    'marginalrevolution.com',
    'reason.com'
  ];

  return await performWebSearch(query, { sites: alternativeSites });
}