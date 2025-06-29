/**
 * Tool Configuration Index
 * Central registry for all agent tools with dynamic loading based on feature flags
 */

import { searchTool } from './searchTool.js';
import { messagesTool } from './messagesTool.js';
import { browserTool } from './browserTool.js';

// Tool registry - add new tools here
const ALL_TOOLS = {
  search: searchTool,
  messages: messagesTool,
  images: {
    definition: {
      type: 'function',
      function: {
        name: 'images',
        description: 'Find, analyze, and extract text from images in chat history using computer vision.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['find', 'analyze', 'extract-text', 'search'] },
            params: { type: 'object' }
          },
          required: ['action']
        }
      }
    },
    documentation: `**🖼️ IMAGES TOOL** - Visual content analysis:
• images("find", {date: "2025-06-27"}) - Find images by date
• images("analyze", {query: "documents", timeframe: "48h"}) - Analyze visual content
• images("extract-text", {timeframe: "24h"}) - OCR text extraction`,
    useCases: ['Analyze uploaded images', 'Extract text from screenshots', 'Find images by content']
  },
  calculate: {
    definition: {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform mathematical calculations and expressions.',
        parameters: {
          type: 'object',
          properties: { expression: { type: 'string' } },
          required: ['expression']
        }
      }
    },
    documentation: `**🔢 CALCULATE TOOL** - Mathematical operations:
• calculate("2 + 2 * 3") - Arithmetic expressions
• calculate("sqrt(16)") - Mathematical functions
• calculate("sin(45 deg)") - Trigonometry`,
    useCases: ['Mathematical calculations', 'Unit conversions', 'Formula evaluation']
  },
  analyze: {
    definition: {
      type: 'function',
      function: {
        name: 'analyze',
        description: 'Analyze and process text content or data arrays.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            action: { type: 'string', default: 'summarize' },
            options: { type: 'object' }
          },
          required: ['content']
        }
      }
    },
    documentation: `**📊 ANALYZE TOOL** - Content processing:
• analyze(text, "summarize", {maxPoints: 5}) - Text summarization
• analyze(dataArray, "data", {operation: "count"}) - Data insights`,
    useCases: ['Summarize long content', 'Extract key points', 'Process data arrays']
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
    documentation: `**🌐 FETCH_URL TOOL** - Direct web page content access:
• fetch_url("https://example.com", "summarize the article") - Fetch and analyze web pages
• fetch_url("https://docs.site.com", "extract API documentation") - Read documentation`,
    useCases: ['Read web articles', 'Extract page content', 'Simple web scraping']
  },
  analyze_image: {
    definition: {
      type: 'function',
      function: {
        name: 'analyze_image',
        description: 'Analyze images using GPT-4.1-mini vision capabilities.',
        parameters: {
          type: 'object',
          properties: {
            imageData: { type: 'string' },
            instruction: { type: 'string', default: 'analyze this image' },
            contentType: { type: 'string', default: 'general' }
          },
          required: ['imageData']
        }
      }
    },
    documentation: `**🖼️ ANALYZE_IMAGE TOOL** - AI-powered image analysis:
• analyze_image(imageData, "describe this image") - General image description
• analyze_image(imageData, "extract text from document") - OCR text extraction`,
    useCases: ['Analyze uploaded images', 'Extract text from images', 'Identify objects in photos']
  },
  send_messages: {
    definition: {
      type: 'function',
      function: {
        name: 'send_messages',
        description: 'Send final response messages to the user. This ENDS the conversation loop.',
        parameters: {
          type: 'object',
          properties: {
            messages: { type: 'array', items: { type: 'string' } }
          },
          required: ['messages']
        }
      }
    },
    documentation: `**💬 SEND_MESSAGES TOOL** - Final response delivery:
• send_messages({messages: ["Response 1", "Response 2"]})
• This tool ENDS the conversation - use only when ready to respond
• Avoid unnecessary links (they expand and clutter chat) - only include when user specifically asks or essential
• Keep responses concise and conversational`,
    useCases: ['Deliver final responses to user', 'End conversation loop', 'Send formatted messages']
  },
  browser: browserTool,
  generate_audio: {
    definition: {
      type: 'function',
      function: {
        name: 'generate_audio',
        description: 'Generate audio/voice files from text using AI text-to-speech. ONLY use when user specifically requests audio, voice files, or podcast content. IMPORTANT: Limit text to 140-150 words maximum (1 minute audio limit).',
        parameters: {
          type: 'object',
          properties: {
            text: { 
              type: 'string',
              description: 'Text to convert to speech. Must be 140-150 words maximum for 1-minute audio.'
            },
            options: { 
              type: 'object',
              description: 'Generation options',
              properties: {
                seed: { type: 'number', default: 0 },
                cfg_weight: { type: 'number', default: 0.5 },
                temperature: { type: 'number', default: 0.8 },
                exaggeration: { type: 'number', default: 0.5 }
              }
            }
          },
          required: ['text']
        }
      }
    },
    documentation: `**🎤 GENERATE_AUDIO TOOL** - AI text-to-speech generation:
• generate_audio("Welcome to our podcast", {}) - Generate audio-only response
• WORKFLOW: Use generate_audio DIRECTLY as final response (no text message needed)
• Creates exactly ONE voice message containing complete response
• CRITICAL: Keep text to 140-150 words maximum (1-minute audio limit)
• Only use when user explicitly requests audio, voice files, or podcast content`,
    useCases: ['Create podcast-style content', 'Generate voice responses', 'Convert text to audio for accessibility', 'Create voice narrations'],
    requiresFeatureFlag: 'REPLICATE_API_TOKEN'
  }
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