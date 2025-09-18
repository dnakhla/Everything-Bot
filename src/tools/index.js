/**
 * Tool Configuration Index
 * Central registry for all agent tools with dynamic loading based on feature flags
 */

import { searchTool } from './searchTool.js';
import { messagesTool } from './messagesTool.js';

// Tool registry - add new tools here
const ALL_TOOLS = {
  search: searchTool,
  run_code: {
    definition: {
      type: 'function',
      function: {
        name: 'run_code',
        description: 'Execute JavaScript code safely to perform calculations, data processing, string manipulation, and complex operations. Supports mathematical functions, array operations, object processing, and more.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute. Can include calculations, data processing, string operations, etc.'
            },
            language: {
              type: 'string',
              enum: ['javascript', 'js'],
              default: 'javascript',
              description: 'Programming language (currently supports JavaScript)'
            },
            context: {
              type: 'object',
              description: 'Optional variables to make available in the execution context'
            }
          },
          required: ['code']
        }
      }
    },
    documentation: `**⚡ RUN_CODE TOOL** - Secure JavaScript sandbox for calculations, data processing, and complex operations:
• Mathematical calculations: run_code({code: "Math.pow(2,10) + Math.sqrt(144) * Math.PI"})
• Array processing: run_code({code: "[1,2,3,4,5].filter(n=>n%2).map(n=>n*n).reduce((a,b)=>a+b)"})
• String manipulation: run_code({code: "'Hello World'.split('').reverse().join('').toLowerCase()"})
• JSON parsing/processing: run_code({code: "JSON.parse(data).users.filter(u=>u.active)", context: {data: jsonString}})
• Date/time operations: run_code({code: "new Date('2024-01-01').getTime() - Date.now()"})
• Data transformation: run_code({code: "Object.entries(data).map(([k,v]) => ({key:k, value:v*2}))"})
• Algorithm implementation: run_code({code: "function fibonacci(n){return n<2?n:fibonacci(n-1)+fibonacci(n-2)}; fibonacci(10)"})
• Statistical operations: run_code({code: "const arr=[1,2,3,4,5]; arr.reduce((a,b)=>a+b)/arr.length"})
• SAFE SANDBOX: No file system, network, or dangerous operations. Perfect for calculations and data manipulation.`,
    useCases: ['Mathematical calculations', 'Data processing and transformation', 'Array and object manipulation', 'String operations', 'Date/time calculations', 'JSON processing', 'Complex algorithmic operations']
  },
  analyze: {
    definition: {
      type: 'function',
      function: {
        name: 'analyze',
        description: 'Universal content analysis tool for ANY content type: text, images, documents, voice messages, files, URLs, etc. Provides comprehensive analysis including OCR, transcription, summarization, and content extraction.',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Content to analyze: text string, image URL/data, file ID, voice message data, document data, etc.'
            },
            contentType: {
              type: 'string',
              enum: ['text', 'image', 'document', 'voice', 'audio', 'video', 'url', 'auto'],
              default: 'auto',
              description: 'Type of content (auto-detects if not specified)'
            },
            instruction: {
              type: 'string',
              default: 'analyze this content thoroughly',
              description: 'Custom analysis instruction: "extract text", "summarize", "count objects", "transcribe", "translate", etc.'
            },
            options: {
              type: 'object',
              properties: {
                maxPoints: { type: 'number', description: 'Max summary points' },
                language: { type: 'string', description: 'Target language for translation' },
                format: { type: 'string', description: 'Output format preference' }
              },
              description: 'Additional analysis options'
            }
          },
          required: ['content']
        }
      }
    },
    documentation: `**🔍 ANALYZE TOOL** - Universal AI-powered content analysis for ANY media type:
• TEXT ANALYSIS: analyze("long article text", "text", "extract key points and sentiment") - Deep text processing, summarization, sentiment analysis, key extraction
• IMAGE OCR/RECOGNITION: analyze(imageUrl, "image", "extract all text and identify objects") - OCR text extraction, object detection, scene description, document analysis
• DOCUMENT PROCESSING: analyze(pdfData, "document", "summarize main findings") - PDF/DOC analysis, table extraction, content summarization
• VOICE TRANSCRIPTION: analyze(voiceFileId, "voice", "transcribe and analyze tone") - Speech-to-text, emotion detection, speaker analysis
• VIDEO ANALYSIS: analyze(videoUrl, "video", "describe actions and extract key moments") - Scene description, action detection, content summary
• WEB PAGE ANALYSIS: analyze("https://news.site.com/article", "url", "extract main facts and quotes") - Web scraping, content extraction, fact identification
• DATA INTERPRETATION: analyze(csvData, "text", "find patterns and anomalies") - Statistical analysis, trend detection, data insights
• MULTI-FORMAT SUPPORT: Handles URLs, file IDs, base64 data, chat attachments, raw text, binary data
• INTELLIGENT AUTO-DETECTION: Automatically determines content type and applies appropriate analysis methods`,
    useCases: ['Text summarization and analysis', 'Image OCR and object recognition', 'Voice/audio transcription', 'Document processing', 'Video analysis', 'URL content extraction', 'Data analysis', 'Multi-format content processing']
  },
  fetch_url: {
    definition: {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: 'Fetch and analyze content from web URLs. Use this for simple content extraction.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            instruction: { type: 'string', default: 'summarize the main content' }
          },
          required: ['url']
        }
      }
    },
    documentation: `**🌐 FETCH_URL TOOL** - Advanced web content extraction and analysis:
• NEWS ARTICLES: fetch_url("https://news.com/breaking", "extract headline, key facts, and quotes") - News analysis with fact extraction
• DOCUMENTATION: fetch_url("https://api-docs.com/reference", "extract API endpoints and parameters") - Technical documentation parsing
• RESEARCH PAPERS: fetch_url("https://arxiv.org/abs/123", "summarize methodology and conclusions") - Academic content analysis
• PRODUCT PAGES: fetch_url("https://store.com/product", "extract specs, price, and reviews") - E-commerce data extraction
• SOCIAL MEDIA: fetch_url("https://twitter.com/user/status", "analyze sentiment and engagement") - Social media content analysis
• LEGAL DOCUMENTS: fetch_url("https://law.site.com/statute", "explain in plain language") - Legal text interpretation
• REDDIT JSON API: fetch_url("https://www.reddit.com/r/jokes.json", "extract and format the jokes") - Direct Reddit API access by adding .json to any Reddit URL
• HANDLES: JavaScript-rendered content, redirects, authentication headers, rate limiting, mobile/desktop versions
• INTELLIGENT PARSING: Removes ads, navigation, extracts main content, preserves formatting and structure`,
    useCases: ['Read web articles', 'Extract page content', 'Simple web scraping']
  },
  send_messages: {
    definition: {
      type: 'function',
      function: {
        name: 'send_messages',
        description: 'Send final response messages to the user. This ENDS the conversation loop. Can send text messages or create audio messages.',
        parameters: {
          type: 'object',
          properties: {
            messages: { type: 'array', items: { type: 'string' } },
            medium: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['text', 'audio'],
                  default: 'text',
                  description: 'Response type: "text" for regular messages, "audio" for voice messages'
                },
                voiceId: {
                  type: 'string',
                  default: 'auto',
                  enum: ['auto', 'Friendly_Person', 'Deep_Voice_Man', 'Calm_Woman', 'Casual_Guy', 'Lively_Girl', 'Patient_Man'],
                  description: 'Voice character (only for audio type)'
                },
                emotion: {
                  type: 'string',
                  default: 'auto',
                  enum: ['auto', 'neutral', 'happy', 'calm', 'excited'],
                  description: 'Emotional tone (only for audio type)'
                },
                speed: {
                  type: 'number',
                  default: 1.0,
                  minimum: 0.5,
                  maximum: 2.0,
                  description: 'Speech speed (only for audio type)'
                }
              },
              default: { type: 'text' },
              description: 'Medium configuration object - defaults to text'
            }
          },
          required: ['messages']
        }
      }
    },
    documentation: `**💬 SEND_MESSAGES TOOL** - Multi-format response delivery system (CONVERSATION ENDER):
• TEXT RESPONSES: send_messages({messages: ["Point 1", "Point 2", "Final thought"]}) - Structured text delivery, breaks long responses into digestible chunks
• AUDIO/VOICE: send_messages({messages: ["Content"], medium: {type: "audio", voiceId: "Casual_Guy", emotion: "happy"}}) - High-quality TTS with voice personality selection
• SMART CHUNKING: Automatically splits walls of text into conversational message arrays for better readability
• VOICE OPTIONS: Casual_Guy, Deep_Voice_Man, Calm_Woman, Lively_Girl, Patient_Man, Friendly_Person - each with distinct personality
• EMOTION CONTROL: neutral, happy, calm, excited emotions for contextually appropriate delivery
• SPEED ADJUSTMENT: 0.5-2.0x speed for accessibility and preference matching
• INTELLIGENT MEDIUM SELECTION: Chooses text vs audio based on content type, user request, and context appropriateness
• ⚠️ CRITICAL: This tool TERMINATES the conversation loop - only use when completely ready to deliver final response
• BEST PRACTICES: Break responses into 2-4 focused messages, avoid single massive walls of text`,
    useCases: ['Deliver final responses to user', 'End conversation loop', 'Send formatted messages', 'Create voice responses when appropriate']
  },
  search_messages: {
    definition: {
      type: 'function',
      function: {
        name: 'search_messages',
        description: 'Universal message search - access bot memory, get recent messages, find user messages, search conversation history including all files, images, documents, and media. Use this for all message retrieval needs: remembering conversations, finding files, getting context, tracking users.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              default: '',
              description: 'Keywords or phrases to search for (empty string gets all messages matching other filters)'
            },
            user_filter: {
              type: 'string',
              description: 'Filter by specific username or user ID (optional)'
            },
            days_back: {
              type: 'number',
              default: 1825,
              description: 'Number of days to search back (default: 1825 - search back 5 years for comprehensive history)'
            },
            message_types: {
              type: 'array',
              items: { type: 'string' },
              default: ['text'],
              description: 'Types of messages to include: text, image, document, voice, video'
            },
            limit: {
              type: 'number',
              default: 20,
              description: 'Maximum number of results to return (default: 20, max: 100)'
            },
            include_context: {
              type: 'boolean',
              default: true,
              description: 'Include surrounding messages for context (default: true - get full day conversation)'
            }
          }
        }
      }
    },
    documentation: `**🔍 SEARCH_MESSAGES TOOL** - Comprehensive conversation memory and file retrieval system:
• DEEP SEARCH: search_messages({query: "bug report python error"}) - Searches back 5 years (1825 days) by default for comprehensive historical context
• HISTORICAL CONTEXT: When finding relevant messages, automatically includes full day conversation for complete understanding
• MULTI-YEAR ACCESS: search_messages({query: "2020 project", days_back: 1825}) - Can find conversations from up to 5 years ago with full context
• USER TRACKING: search_messages({user_filter: "@daniel", days_back: 1825, limit: 50}) - Find all activity from specific users across entire 5-year history
• CONTEXTUAL DISCOVERY: search_messages({query: "project deadline", include_context: true}) - Get conversation flow with before/after message context
• MEDIA SEARCH: search_messages({query: "screenshot", message_types: ["image"], days_back: 1825}) - Find images, documents, voice messages, videos across 5 years
• FILE RETRIEVAL: search_messages({query: "pdf report", message_types: ["document"]}) - Locate shared files with complete metadata (names, sizes, IDs)
• VOICE TRANSCRIPTION SEARCH: search_messages({query: "meeting notes", message_types: ["voice"]}) - Search transcribed voice message content
• OCR TEXT SEARCH: search_messages({query: "invoice total", message_types: ["image"]}) - Search text extracted from images and documents
• COMPREHENSIVE METADATA: Returns file IDs for downloads, transcriptions, OCR text, analyzed summaries, user info, timestamps
• INTELLIGENT FILTERING: Combines multiple filters (user + keywords + date range + media type) for precise results
• CONVERSATION CONTINUITY: Essential for maintaining context across long conversations and referencing past discussions with full day context across 5 years of history`,
    useCases: ['Search conversation history', 'Get recent message context', 'Find user activity', 'Locate shared files and media', 'Track voice messages with transcriptions', 'Build conversation continuity', 'Search all media types comprehensively']
  },
};

/**
 * Get available tools based on feature flags and configuration
 */
export async function getAvailableTools() {
  const { CONFIG } = await import('../../config.js');
  
  const availableTools = [];
  
  for (const [toolName, toolConfig] of Object.entries(ALL_TOOLS)) {
    // Check if tool requires a feature flag
    if (toolConfig.requiresFeatureFlag) {
      if (CONFIG[toolConfig.requiresFeatureFlag]) {
        availableTools.push(toolName);
      }
    } else {
      // Tool is always available
      availableTools.push(toolName);
    }
  }
  
  return availableTools;
}

/**
 * Get OpenAI function definitions for available tools
 */
export async function getToolDefinitions() {
  const availableTools = await getAvailableTools();
  
  return availableTools.map(toolName => ALL_TOOLS[toolName].definition);
}

/**
 * Generate tool documentation for system prompt based on available tools and persona
 */
export async function generateToolDocumentation(persona = 'default') {
  const availableTools = await getAvailableTools();
  
  let documentation = '';
  
  for (const toolName of availableTools) {
    const tool = ALL_TOOLS[toolName];
    if (tool.documentation) {
      documentation += tool.documentation + '\n\n';
    }
  }
  
  return documentation.trim();
}

/**
 * Get persona-specific examples for available tools
 */
export async function getPersonaExamples(persona = 'default') {
  const availableTools = await getAvailableTools();
  const examples = {};
  
  for (const toolName of availableTools) {
    const tool = ALL_TOOLS[toolName];
    if (tool.personaExamples && tool.personaExamples[persona]) {
      examples[toolName] = tool.personaExamples[persona];
    } else if (tool.personaExamples && tool.personaExamples.default) {
      examples[toolName] = tool.personaExamples.default;
    }
  }
  
  return examples;
}

/**
 * Get use cases for available tools
 */
export async function getToolUseCases() {
  const availableTools = await getAvailableTools();
  const useCases = {};
  
  for (const toolName of availableTools) {
    const tool = ALL_TOOLS[toolName];
    if (tool.useCases) {
      useCases[toolName] = tool.useCases;
    }
  }
  
  return useCases;
}

export { ALL_TOOLS };