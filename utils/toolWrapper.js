import { Logger } from './logger.js';

/**
 * Create a standardized tool wrapper around service functions
 * Implements DRY principles and consistent error handling
 * 
 * @param {Function} serviceFunction - The underlying service function to wrap
 * @param {Object} options - Configuration options for the wrapper
 * @param {string} options.name - Tool name for logging
 * @param {string} options.category - Tool category
 * @param {string} options.description - Tool description
 * @param {Function} options.formatResult - Function to format the result
 * @param {Function} options.validateParams - Function to validate parameters
 * @param {Object} options.defaultParams - Default parameters
 * @returns {Function} Wrapped tool function
 */
export function createToolWrapper(serviceFunction, options = {}) {
  const {
    name = serviceFunction.name || 'unknown',
    category = 'general',
    description = 'No description provided',
    formatResult = (result) => result,
    validateParams = () => true,
    defaultParams = {},
    errorMessage = `Error in ${name}`
  } = options;

  // Return the wrapped function
  const wrappedFunction = async (...args) => {
    try {
      // Merge with default parameters
      const params = { ...defaultParams, ...args };
      
      // Log the tool usage
      Logger.log(`Tool ${name} called with params: ${JSON.stringify(params)}`);
      
      // Validate parameters if validator provided
      if (validateParams && !validateParams(...args)) {
        throw new Error(`Invalid parameters for ${name}`);
      }
      
      // Call the underlying service function
      const result = await serviceFunction(...args);
      
      // Format the result using the provided formatter
      const formattedResult = formatResult(result, args);
      
      // Log successful completion
      Logger.log(`Tool ${name} completed successfully`);
      
      return formattedResult;
      
    } catch (error) {
      // Standardized error handling
      Logger.log(`${errorMessage}: ${error.message}`, 'error');
      return `${errorMessage}: ${error.message}`;
    }
  };

  // Attach metadata to the function for introspection
  wrappedFunction.toolMetadata = {
    name,
    category,
    description,
    originalFunction: serviceFunction
  };

  return wrappedFunction;
}

/**
 * Create a tool wrapper specifically for search operations
 * Provides common search result formatting
 * 
 * @param {Function} searchFunction - The search service function
 * @param {Object} options - Search-specific options
 * @returns {Function} Wrapped search tool
 */
export function createSearchToolWrapper(searchFunction, options = {}) {
  const {
    emptyResultsMessage = 'No results found',
    resultIcon = '🔍',
    maxDisplayResults = 10
  } = options;

  return createToolWrapper(searchFunction, {
    ...options,
    formatResult: (results, params) => {
      const [query] = params;
      
      if (!results || (Array.isArray(results) && results.length === 0)) {
        return `${resultIcon} ${emptyResultsMessage} for "${query}".`;
      }
      
      if (typeof results === 'string') {
        return results;
      }
      
      if (Array.isArray(results)) {
        let summary = `${resultIcon} Found ${results.length} results for "${query}":\n\n`;
        results.slice(0, maxDisplayResults).forEach((item, index) => {
          summary += `${index + 1}. ${formatSearchResultItem(item)}\n`;
        });
        
        if (results.length > maxDisplayResults) {
          summary += `... (showing first ${maxDisplayResults} of ${results.length})`;
        }
        
        return summary;
      }
      
      return results;
    }
  });
}

/**
 * Format individual search result items
 * @param {Object} item - Search result item
 * @returns {string} Formatted item
 */
function formatSearchResultItem(item) {
  if (typeof item === 'string') return item;
  
  if (item.title && item.snippet) {
    return `${item.title}\n   ${item.snippet}`;
  }
  
  if (item.title) {
    return item.title;
  }
  
  if (item.content) {
    const preview = item.content.length > 100 ? 
      item.content.substring(0, 100) + '...' : 
      item.content;
    return preview;
  }
  
  return JSON.stringify(item);
}

/**
 * Create batch tool wrapper for operations that work on multiple items
 * @param {Function} batchFunction - Function that processes multiple items
 * @param {Object} options - Batch-specific options
 * @returns {Function} Wrapped batch tool
 */
export function createBatchToolWrapper(batchFunction, options = {}) {
  const { 
    batchSize = 10,
    progressCallback = null 
  } = options;

  return createToolWrapper(batchFunction, {
    ...options,
    formatResult: (results, params) => {
      if (Array.isArray(results)) {
        return `📊 Processed ${results.length} items in batches of ${batchSize}`;
      }
      return results;
    }
  });
}

/**
 * Get metadata from a wrapped tool function
 * @param {Function} toolFunction - Wrapped tool function
 * @returns {Object|null} Tool metadata or null if not a wrapped tool
 */
export function getToolMetadata(toolFunction) {
  return toolFunction?.toolMetadata || null;
}

/**
 * Check if a function is a wrapped tool
 * @param {Function} func - Function to check
 * @returns {boolean} True if it's a wrapped tool
 */
export function isWrappedTool(func) {
  return typeof func === 'function' && func.toolMetadata !== undefined;
}