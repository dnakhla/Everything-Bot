# Tools Directory

This directory contains all specialized tools used by the Everything Bot's AI agents. Each tool is organized in its own file for better maintainability, testing, and development.

## 📁 Directory Structure

```
tools/
├── README.md                 # This file
├── index.js                  # Main entry point and tool registry
├── mathCalculation.js        # Mathematical operations
├── redditSearch.js          # Reddit discussion search
├── searchEngines.js         # Web search tools (news, places, images, videos)
├── contentAnalysis.js       # Content summarization
├── dataProcessing.js        # Data filtering, sorting, analysis
└── accommodation.js         # Hotel and travel search
```

## 🛠 Tool Categories

### Math Tools (`mathCalculation.js`)
- **`performMathCalculation(expression)`** - Evaluate mathematical expressions

### Social Tools (`redditSearch.js`)
- **`searchReddit(query, subreddit)`** - Search Reddit discussions
- **`getRedditPosts(subreddit, timeframe)`** - Get top posts from subreddits

### Search Tools (`searchEngines.js`)
- **`searchUnpopularSites(query)`** - Search alternative/niche sites
- **`performNewsSearch(query)`** - Search current news articles
- **`performPlacesSearch(query)`** - Search for places and locations
- **`performImageSearch(query)`** - Search for images
- **`performVideoSearch(query)`** - Search for videos

### Content Tools (`contentAnalysis.js`)
- **`summarizeContent(content, maxPoints)`** - Summarize text into key points

### Data Processing Tools (`dataProcessing.js`)
- **`filterData(data, criteria)`** - Filter arrays based on criteria
- **`sortData(data, sortBy, order)`** - Sort data by specified fields
- **`analyzeData(data, operation, field)`** - Analyze and aggregate data

### Travel Tools (`accommodation.js`)
- **`searchAccommodation(location, checkin, checkout, adults, rooms)`** - Search hotels

## 🚀 Usage Examples

### Direct Import from Tools
```javascript
import { performMathCalculation } from './tools/mathCalculation.js';
import { searchReddit } from './tools/redditSearch.js';

// Use tools directly
const result = await performMathCalculation('2 + 2 * 3');
const posts = await searchReddit('AI news', 'technology');
```

### Import from Index (Recommended)
```javascript
import { 
  performMathCalculation,
  searchReddit,
  performNewsSearch 
} from './tools/index.js';

// Use tools with centralized imports
const mathResult = await performMathCalculation('sqrt(16)');
const redditData = await searchReddit('climate change');
const news = await performNewsSearch('artificial intelligence');
```

### Tool Discovery
```javascript
import { getAvailableTools, getToolByName } from './tools/index.js';

// Get all available tools organized by category
const allTools = getAvailableTools();
console.log(allTools);

// Find a specific tool
const mathTool = getToolByName('performMathCalculation');
console.log(mathTool); // { name: 'performMathCalculation', category: 'math', description: '...' }
```

## 🤖 Agent Integration

Tools are designed to work seamlessly with the bot's agent system:

```javascript
// In agent code
import { TOOL_REGISTRY } from './tools/index.js';

// Agents can discover available tools
const searchTools = TOOL_REGISTRY.search;
const dataTools = TOOL_REGISTRY.data;

// Dynamically select tools based on user input
if (userMessage.includes('reddit')) {
  const { searchReddit } = await import('./tools/redditSearch.js');
  return await searchReddit(query);
}
```

## 📋 Tool Registry

The `TOOL_REGISTRY` object in `index.js` provides:
- **Tool Discovery**: Agents can find available tools by category
- **Dynamic Loading**: Tools can be loaded on-demand
- **Documentation**: Each tool includes a description
- **Categorization**: Tools are organized by functionality

## 🔄 Migration from Legacy

The old `services/specializedTools.js` file has been updated to re-export from this new structure, maintaining backward compatibility. New code should import directly from the tools directory.

### Before (Legacy)
```javascript
import { performMathCalculation } from '../services/specializedTools.js';
```

### After (New Structure)
```javascript
import { performMathCalculation } from '../tools/index.js';
// or
import { performMathCalculation } from '../tools/mathCalculation.js';
```

## 🧪 Testing

Each tool file can be tested independently:

```javascript
// Test math tools
import { performMathCalculation } from './tools/mathCalculation.js';
console.assert((await performMathCalculation('2+2')).includes('4'));

// Test search tools
import { searchReddit } from './tools/redditSearch.js';
const result = await searchReddit('test query');
console.assert(result.includes('Reddit Discussion'));
```

## 📈 Benefits of New Structure

1. **Modularity**: Each tool is self-contained
2. **Maintainability**: Easier to update individual tools
3. **Testing**: Tools can be tested in isolation
4. **Performance**: Only load tools that are needed
5. **Documentation**: Better organization and documentation
6. **Scalability**: Easy to add new tools without bloating files
7. **Agent Discovery**: Tools can be discovered and used dynamically

## 🔮 Future Enhancements

- **Tool Validation**: Input/output schema validation
- **Tool Metrics**: Performance and usage tracking  
- **Tool Caching**: Cache results for expensive operations
- **Tool Composition**: Chain tools together for complex operations
- **Tool Authentication**: Per-tool API key management