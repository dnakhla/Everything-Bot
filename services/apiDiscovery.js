import axios from 'axios';
import { Logger } from '../utils/logger.js';

/**
 * API Discovery Service - Reverse engineer client-side loaded content
 * Attempts to find and use API endpoints instead of scraping JavaScript-heavy pages
 */

/**
 * Site-specific patterns for known websites
 */
const SITE_PATTERNS = {
  'mltt.com': {
    apiBase: '/api/',
    endpoints: ['schedule', 'matches', 'results', 'teams'],
    dataPath: 'data',
    headers: { 'Accept': 'application/json' }
  },
  'espn.com': {
    apiBase: '/apis/site/v2/',
    endpoints: ['sports', 'scoreboard'],
    dataPath: 'events',
    headers: { 'Accept': 'application/json' }
  }
};

/**
 * Common API URL patterns to try
 */
function generateApiCandidates(originalUrl) {
  const urlObj = new URL(originalUrl);
  const baseUrl = urlObj.origin;
  const path = urlObj.pathname;
  const pathSegments = path.split('/').filter(s => s);
  
  const candidates = [
    // Standard API patterns
    `${baseUrl}/api${path}`,
    `${baseUrl}/api/v1${path}`,
    `${baseUrl}/api/v2${path}`,
    `${baseUrl}/graphql`,
    
    // Data-specific patterns
    `${baseUrl}/data${path}.json`,
    `${baseUrl}${path}/data`,
    `${baseUrl}${path}.json`,
    
    // Sports-specific patterns
    `${baseUrl}/api/schedule`,
    `${baseUrl}/api/matches`,
    `${baseUrl}/api/results`,
    `${baseUrl}/api/games`,
    `${baseUrl}/api/scoreboard`,
    
    // Path variations
    ...pathSegments.map(segment => `${baseUrl}/api/${segment}`),
    
    // Known site patterns
    ...(SITE_PATTERNS[urlObj.hostname]?.endpoints || []).map(endpoint => 
      `${baseUrl}${SITE_PATTERNS[urlObj.hostname].apiBase}${endpoint}`
    )
  ];
  
  return [...new Set(candidates)]; // Remove duplicates
}

/**
 * Different header combinations to try for API detection
 */
const API_HEADERS = [
  { 'Accept': 'application/json' },
  { 'Accept': 'application/json, text/plain, */*' },
  { 'X-Requested-With': 'XMLHttpRequest' },
  { 'Content-Type': 'application/json' },
  {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (compatible; FactCheckerBot/1.0)'
  }
];

/**
 * Check if content appears to be JavaScript-heavy
 */
function isJavaScriptHeavy(html) {
  if (!html || typeof html !== 'string') return false;
  
  const scriptTags = (html.match(/<script/gi) || []).length;
  const textContent = html.replace(/<[^>]*>/g, '').trim().length;
  const totalLength = html.length;
  
  // Indicators of JavaScript-heavy sites
  const indicators = [
    scriptTags > 5, // Many script tags
    textContent < totalLength * 0.1, // Very little actual text content
    html.includes('__NEXT_DATA__'), // Next.js
    html.includes('__NUXT__'), // Nuxt.js
    html.includes('ng-app'), // Angular
    html.includes('data-reactroot'), // React
    html.includes('Loading...'), // Loading indicators
    html.includes('<div id="app">'), // Vue/SPA patterns
    html.includes('<div id="root">'), // React root
  ];
  
  const score = indicators.filter(Boolean).length;
  Logger.log(`JavaScript-heavy detection score: ${score}/9 for ${html.length} chars`);
  
  return score >= 3; // Threshold for considering it JS-heavy
}

/**
 * Extract potential API endpoints from JavaScript code
 */
function extractApiEndpoints(html) {
  const endpoints = new Set();
  
  // Common API URL patterns in JavaScript
  const apiPatterns = [
    /["'](\/api\/[^"']+)["']/g,
    /["'](https?:\/\/[^"']*\/api\/[^"']+)["']/g,
    /["'](\/graphql[^"']*)["']/g,
    /endpoint:\s*["']([^"']+)["']/g,
    /url:\s*["']([^"']*api[^"']*)["']/g,
  ];
  
  apiPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      endpoints.add(match[1]);
    }
  });
  
  return Array.from(endpoints);
}

/**
 * Extract data from JavaScript variables
 */
function extractJavaScriptData(html) {
  const dataPatterns = [
    /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
    /window\.__DATA__\s*=\s*({.+?});/s,
    /__NEXT_DATA__\s*=\s*({.+?})/s,
    /var\s+(?:data|initialData|pageData)\s*=\s*({.+?});/s,
    /window\.(?:APP_DATA|BOOTSTRAP_DATA)\s*=\s*({.+?});/s,
  ];
  
  for (const pattern of dataPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        Logger.log(`Extracted JavaScript data: ${Object.keys(data).join(', ')}`);
        return data;
      } catch (e) {
        Logger.log(`Failed to parse extracted JS data: ${e.message}`, 'warn');
      }
    }
  }
  
  return null;
}

/**
 * Try to fetch from potential API endpoints
 */
async function tryApiEndpoints(candidates, originalUrl) {
  Logger.log(`Trying ${candidates.length} API endpoint candidates`);
  
  for (const candidate of candidates) {
    for (const headers of API_HEADERS) {
      try {
        Logger.log(`Testing API endpoint: ${candidate}`);
        
        const response = await axios.get(candidate, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FactCheckerBot/1.0)',
            ...headers
          },
          timeout: 8000,
          maxContentLength: 2 * 1024 * 1024, // 2MB limit
          validateStatus: status => status < 400
        });
        
        // Check if response looks like API data
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('application/json') || 
            (typeof response.data === 'object' && response.data !== null)) {
          
          Logger.log(`Found API endpoint: ${candidate} (${contentType})`);
          return {
            url: candidate,
            data: response.data,
            contentType,
            success: true
          };
        }
        
      } catch (error) {
        // Silently continue to next candidate
        if (error.code !== 'ENOTFOUND' && error.response?.status !== 404) {
          Logger.log(`API endpoint ${candidate} error: ${error.message}`, 'debug');
        }
      }
    }
  }
  
  return null;
}

/**
 * Process and format API data for analysis
 */
function processApiData(apiResult, instruction) {
  const { data, url } = apiResult;
  
  try {
    // Convert API data to readable format
    let processedData;
    
    if (Array.isArray(data)) {
      processedData = data.map(item => JSON.stringify(item, null, 2)).join('\n\n');
    } else if (typeof data === 'object') {
      processedData = JSON.stringify(data, null, 2);
    } else {
      processedData = String(data);
    }
    
    Logger.log(`Processed API data: ${processedData.length} characters`);
    
    return {
      content: processedData,
      source: `API endpoint: ${url}`,
      type: 'api_data',
      instruction: instruction
    };
    
  } catch (error) {
    Logger.log(`Error processing API data: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Main intelligent fetch function with API discovery
 */
export async function intelligentFetch(url, instruction = 'summarize the main content') {
  Logger.log(`Starting intelligent fetch for: ${url}`);
  
  try {
    // Step 1: Try simple fetch first
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FactCheckerBot/1.0)'
      },
      timeout: 10000,
      maxContentLength: 1024 * 1024 // 1MB limit
    });
    
    const html = response.data;
    
    // Step 2: Check if JavaScript-heavy
    if (!isJavaScriptHeavy(html)) {
      Logger.log('Page appears to be server-rendered, using standard extraction');
      return {
        content: html,
        source: url,
        type: 'html',
        instruction: instruction
      };
    }
    
    Logger.log('Detected JavaScript-heavy page, attempting API discovery');
    
    // Step 3: Try to extract data from JavaScript variables first
    const jsData = extractJavaScriptData(html);
    if (jsData) {
      Logger.log('Found data in JavaScript variables');
      return {
        content: JSON.stringify(jsData, null, 2),
        source: `JavaScript data from ${url}`,
        type: 'js_data',
        instruction: instruction
      };
    }
    
    // Step 4: Extract potential API endpoints from the page
    const extractedEndpoints = extractApiEndpoints(html);
    Logger.log(`Extracted ${extractedEndpoints.length} potential endpoints from JavaScript`);
    
    // Step 5: Generate API candidates
    const apiCandidates = generateApiCandidates(url);
    
    // Combine extracted and generated endpoints
    const allCandidates = [...new Set([...extractedEndpoints, ...apiCandidates])];
    
    // Step 6: Try API endpoints
    const apiResult = await tryApiEndpoints(allCandidates, url);
    if (apiResult) {
      return processApiData(apiResult, instruction);
    }
    
    // Step 7: Fallback to original HTML (might have some content)
    Logger.log('API discovery failed, falling back to original HTML');
    return {
      content: html,
      source: url,
      type: 'html_fallback',
      instruction: instruction
    };
    
  } catch (error) {
    Logger.log(`Intelligent fetch failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Add new site pattern (for learning from successful discoveries)
 */
export function addSitePattern(hostname, pattern) {
  SITE_PATTERNS[hostname] = pattern;
  Logger.log(`Added new site pattern for ${hostname}`);
}