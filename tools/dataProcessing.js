import { Logger } from '../utils/logger.js';

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