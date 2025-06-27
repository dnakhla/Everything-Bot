# Everything Bot - Architecture Overview

## Directory Structure

```
factcheckerTelegram/
├── src/                          # Core application logic
│   ├── commandHandlers.js        # Main bot command handling (simplified)
│   ├── agentConfig.js           # OpenAI function definitions for agent toolkit
│   └── agentExecutor.js         # Tool execution mapping and orchestration
├── tools/                        # Modular tool system
│   ├── index.js                 # Tool registry and exports
│   ├── agentToolkit.js          # Simplified agent interface (5 unified tools)
│   ├── mathCalculation.js       # Mathematical calculations
│   ├── memorySearch.js          # Chat history and message operations
│   ├── contentAnalysis.js       # Text summarization and analysis
│   ├── searchEngines.js         # Web, news, images, videos, places search
│   ├── redditSearch.js          # Reddit discussions and posts
│   ├── dataProcessing.js        # Data filtering, sorting, analysis
│   └── accommodation.js         # Hotel/travel search
├── services/                     # Core services
│   ├── messageService.js        # Message persistence and retrieval
│   ├── telegramAPI.js          # Telegram Bot API wrapper
│   ├── searchService.js        # Search engine integrations
│   └── s3Manager.js            # AWS S3 file storage
├── utils/                        # Utility functions
│   ├── toolWrapper.js          # DRY tool wrapper patterns
│   └── logger.js               # Logging utility
└── config.js                   # Application configuration
```

## Agent Toolkit Architecture

### Simplified Interface (5 Tools)
The new architecture provides a clean, simplified interface for AI agents:

1. **`search(query, topic, options)`** - Universal search
   - Topics: web, news, images, videos, places, reddit, alternative
   - Unified interface for all search operations

2. **`messages(chatId, action, params)`** - Chat operations  
   - Actions: get, search, summary, filter, range
   - Handles all message history operations

3. **`images(chatId, action, params)`** - Image operations
   - Actions: find, analyze, extract-text, search
   - Unified image processing and analysis

4. **`calculate(expression)`** - Mathematical calculations
   - Supports arithmetic, algebra, trigonometry
   - Clean interface for all math operations

5. **`analyze(content, action, options)`** - Content processing
   - Actions: summarize, data
   - Text summarization and data analysis

### Benefits

- **Reduced Complexity**: 5 tools instead of 25+ individual tools
- **Consistent Interface**: All tools follow similar patterns
- **Better Abstraction**: AI agents get intuitive, high-level operations
- **Maintainable**: Clear separation of concerns
- **Extensible**: Easy to add new functionality within existing tools

## Implementation Details

### Tool Execution Flow

1. **OpenAI Function Call** → `agentConfig.js` (function definitions)
2. **Parameter Mapping** → `agentExecutor.js` (execution orchestration)  
3. **Tool Execution** → `agentToolkit.js` (unified interface)
4. **Service Layer** → Individual service modules
5. **Result Formatting** → Standardized responses

### Error Handling

- Consistent error handling across all tools
- Graceful degradation when services fail
- User-friendly error messages
- Comprehensive logging

### Rate Limiting

- Tool usage tracking to prevent loops
- Configurable limits per tool type
- Intelligent fallback strategies

## Configuration

All agent behavior is controlled through:

- `src/agentConfig.js` - OpenAI function definitions and system prompts
- `src/agentExecutor.js` - Tool execution mapping
- `tools/agentToolkit.js` - Unified tool interface
- `config.js` - API keys and service configuration

## Migration from Legacy

The old 25+ tool system has been completely replaced with:
- Clean, modular architecture
- Simplified agent interface
- Better error handling
- Improved maintainability
- Consistent patterns throughout

All legacy files have been removed or deprecated to ensure clean codebase.