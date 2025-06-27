/**
 * Tools Index - Central hub for all specialized tools
 * 
 * This module aggregates all specialized tools used by the bot agents.
 * Each tool is organized in its own file for better maintainability.
 */

// Math and calculation tools
export { performMathCalculation } from './mathCalculation.js';

// Reddit-specific tools
export { 
  searchReddit, 
  getRedditPosts 
} from './redditSearch.js';

// Search engine tools
export { 
  searchUnpopularSites,
  performNewsSearch,
  performPlacesSearch,
  performImageSearch,
  performVideoSearch
} from './searchEngines.js';

// Content analysis tools
export { summarizeContent } from './contentAnalysis.js';

// Data processing tools
export { 
  filterData,
  sortData,
  analyzeData
} from './dataProcessing.js';

// Accommodation search tools
export { searchAccommodation } from './accommodation.js';

// Memory and conversation search tools
export { 
  searchChatHistory,
  getRecentConversationSummary,
  getMessagesFromLastHours,
  getMessagesFromLastDays,
  analyzeImagesFromTimeframe,
  extractTextFromImagesInTimeframe,
  findImagesByDate,
  searchForSpecificImages
} from './memorySearch.js';

// Agent Toolkit - Simplified interface for AI agents
export { 
  search,
  messages,
  images,
  calculate,
  analyze,
  AGENT_TOOLKIT,
  getAgentToolkit
} from './agentToolkit.js';

/**
 * Tool registry for agent discovery
 * Maps tool categories to their available functions
 */
export const TOOL_REGISTRY = {
  math: {
    performMathCalculation: 'Perform mathematical calculations and evaluations'
  },
  
  social: {
    searchReddit: 'Search Reddit discussions and opinions',
    getRedditPosts: 'Get top posts from specific subreddits'
  },
  
  search: {
    searchUnpopularSites: 'Search alternative/niche sites for diverse perspectives',
    performNewsSearch: 'Search current news articles',
    performPlacesSearch: 'Search for places and locations',
    performImageSearch: 'Search for images',
    performVideoSearch: 'Search for videos'
  },
  
  content: {
    summarizeContent: 'Summarize large text into key points'
  },
  
  data: {
    filterData: 'Filter data based on criteria',
    sortData: 'Sort data by specified fields',
    analyzeData: 'Analyze and aggregate data for insights'
  },
  
  memory: {
    searchChatHistory: 'Search through chat message history by keyword',
    getRecentConversationSummary: 'Get conversation summary from recent messages',
    getMessagesFromLastHours: 'Get messages from the last N hours',
    getMessagesFromLastDays: 'Get messages from the last N days',
    analyzeImagesFromTimeframe: 'Analyze images shared within a specific timeframe',
    extractTextFromImagesInTimeframe: 'Extract text from images within a specific timeframe',
    findImagesByDate: 'Find and analyze images shared on a specific date',
    searchForSpecificImages: 'Search for specific images by content (receipts, documents, etc.)'
  },
  
  travel: {
    searchAccommodation: 'Search for hotels and accommodation'
  }
};

/**
 * Get all available tools categorized
 * @returns {Object} Object with categories and their tools
 */
export function getAvailableTools() {
  return TOOL_REGISTRY;
}

/**
 * Get tool by name across all categories
 * @param {string} toolName - Name of the tool to find
 * @returns {Object|null} Tool information or null if not found
 */
export function getToolByName(toolName) {
  for (const [category, tools] of Object.entries(TOOL_REGISTRY)) {
    if (tools[toolName]) {
      return {
        name: toolName,
        category,
        description: tools[toolName]
      };
    }
  }
  return null;
}

/**
 * Get all tools in a specific category
 * @param {string} category - Category name
 * @returns {Object|null} Tools in the category or null if category doesn't exist
 */
export function getToolsByCategory(category) {
  return TOOL_REGISTRY[category] || null;
}