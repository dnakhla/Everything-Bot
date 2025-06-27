import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Core search service functions
 * These are the underlying implementations that tools wrap around
 */

/**
 * Perform general web search using Serper API
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
  
  const data = JSON.stringify({ q: searchQuery, num });
  
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
  return response.data.organic || [];
}

/**
 * Perform news search using Serper API
 * @param {string} query - News search query
 * @returns {Array} News results
 */
export async function performNewsSearch(query) {
  const data = JSON.stringify({ q: query, num: 8 });
  
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
  return response.data.news || [];
}

/**
 * Perform places search using Serper API
 * @param {string} query - Places search query
 * @returns {Array} Places results
 */
export async function performPlacesSearch(query) {
  const data = JSON.stringify({ q: query, num: 6 });
  
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
  return response.data.places || [];
}

/**
 * Perform image search using Serper API
 * @param {string} query - Image search query
 * @returns {Array} Image results
 */
export async function performImageSearch(query) {
  const data = JSON.stringify({ q: query, num: 8 });
  
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
  return response.data.images || [];
}

/**
 * Perform video search using Serper API
 * @param {string} query - Video search query
 * @returns {Array} Video results
 */
export async function performVideoSearch(query) {
  const data = JSON.stringify({ q: query, num: 6 });
  
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
  return response.data.videos || [];
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