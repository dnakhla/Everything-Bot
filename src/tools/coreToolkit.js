/**
 * Core Toolkit - The 6 Essential Tools for GPT-5 Agent
 * Clean, focused implementation with search_messages handling memory via chat history
 */

import { performWebSearch } from '../../tools/searchEngines.js';
import { intelligentFetch } from '../../services/apiDiscovery.js';
import { searchChatMessages, getMessagesFromLastNhours, analyzeRecentImages } from '../../services/messageService.js';
import { transcribeAudio, createVoiceMemo } from '../../tools/voiceMemo.js';
import { performReflection } from '../../tools/reflection.js';
import { TelegramAPI } from '../../services/telegramAPI.js';

/**
 * 1. SEARCH_WEB - Web search capabilities
 */
export const searchWeb = {
  type: 'function',
  function: {
    name: 'search_web',
    description: 'Search the web for current information, news, and answers',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - be specific and use quotes for exact phrases'
        },
        type: {
          type: 'string',
          enum: ['web', 'news', 'images'],
          description: 'Type of search to perform',
          default: 'web'
        }
      },
      required: ['query']
    }
  }
};

/**
 * 2. FETCH_URL - Retrieve and analyze web content
 */
export const fetchUrl = {
  type: 'function',
  function: {
    name: 'fetch_url',
    description: 'Fetch and analyze content from a specific URL',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch content from'
        },
        instruction: {
          type: 'string',
          description: 'What to look for or analyze in the content',
          default: 'summarize the main content'
        }
      },
      required: ['url']
    }
  }
};

/**
 * 3. SEARCH_MESSAGES - Search chat history including images and voice (also serves as memory)
 */
export const searchMessages = {
  type: 'function',
  function: {
    name: 'search_messages',
    description: 'Search chat history for text, analyze recent images, transcribe voice messages, or retrieve conversation memory',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for in messages, images, voice content, or past conversations for memory'
        },
        type: {
          type: 'string',
          enum: ['text', 'images', 'voice', 'all', 'memory'],
          description: 'Type of content to search - use "memory" to retrieve past conversation context',
          default: 'text'
        },
        timeframe: {
          type: 'string',
          enum: ['1h', '6h', '24h', '3d', '7d', '30d'],
          description: 'How far back to search',
          default: '24h'
        }
      },
      required: ['query']
    }
  }
};

/**
 * 4. CREATE_VOICE_MESSAGE - Generate voice messages
 */
export const createVoiceMessage = {
  type: 'function',
  function: {
    name: 'create_voice_message',
    description: 'Generate a voice message with specified content and voice characteristics',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text content to convert to voice'
        },
        voice_style: {
          type: 'string',
          enum: ['friendly', 'professional', 'casual', 'enthusiastic', 'calm'],
          description: 'Voice style and tone',
          default: 'friendly'
        },
        title: {
          type: 'string',
          description: 'Optional title for the voice message'
        }
      },
      required: ['text']
    }
  }
};

/**
 * 5. SEND_MESSAGE - Send text or voice messages to chat
 */
export const sendMessage = {
  type: 'function',
  function: {
    name: 'send_message',
    description: 'Send final response messages to the user (text or voice)',
    parameters: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of messages to send (will be sent with natural delays)'
        },
        type: {
          type: 'string',
          enum: ['text', 'voice'],
          description: 'Type of messages to send',
          default: 'text'
        }
      },
      required: ['messages']
    }
  }
};

/**
 * 6. REFLECT - Strategic thinking and self-assessment
 */
export const reflect = {
  type: 'function',
  function: {
    name: 'reflect',
    description: 'Perform strategic thinking, self-assessment, or decision-making reflection',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['assess', 'plan', 'decide', 'evaluate'],
          description: 'Type of reflection to perform'
        },
        focus: {
          type: 'string',
          description: 'What to reflect on - current situation, approach, next steps, etc.',
          default: 'current situation'
        },
        context: {
          type: 'string',
          description: 'Additional context for the reflection'
        }
      },
      required: ['action']
    }
  }
};

/**
 * Export all 6 core tools as array for agent configuration
 */
export const CORE_TOOLS = [
  searchWeb,
  fetchUrl,
  searchMessages,
  createVoiceMessage,
  sendMessage,
  reflect
];

/**
 * Tool execution functions
 */
export const CORE_TOOL_FUNCTIONS = {
  search_web: async (args) => {
    const { query, type = 'web' } = args;
    return await performWebSearch(query, type);
  },

  fetch_url: async (args) => {
    const { url, instruction = 'summarize the main content' } = args;
    const result = await intelligentFetch(url, instruction);
    return result.content || result;
  },

  search_messages: async (args, chatId) => {
    const { query, type = 'text', timeframe = '24h' } = args;

    const hours = {
      '1h': 1, '6h': 6, '24h': 24, '3d': 72, '7d': 168, '30d': 720
    }[timeframe] || 24;

    try {
      switch (type) {
        case 'text':
          // Use Telegram's native search API first, fallback to S3 search
          try {
            const telegramResults = await TelegramAPI.searchMessages(chatId, query, 20);
            if (telegramResults && telegramResults.messages && telegramResults.messages.length > 0) {
              let summary = `🔍 Found ${telegramResults.messages.length} messages for "${query}":\n\n`;
              telegramResults.messages.slice(0, 10).forEach((msg, index) => {
                const date = new Date(msg.date * 1000).toLocaleString();
                const sender = msg.from?.first_name || msg.from?.username || 'Unknown';
                const text = msg.text || msg.caption || '[Media message]';
                summary += `${index + 1}. ${date} - ${sender}\n   "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n\n`;
              });
              return summary;
            }
          } catch (telegramError) {
            console.log('Telegram search failed, using S3 fallback:', telegramError.message);
          }
          // Fallback to S3-based search
          return await searchChatMessages(chatId, query, 20);

        case 'images':
          return await analyzeRecentImages(chatId, query, hours);

        case 'voice':
          return await transcribeAudio(null, null, query, chatId);

        case 'memory':
          // For memory, get recent chat history via Telegram API first
          try {
            const history = await TelegramAPI.getChatHistory(chatId, 50);
            if (history && history.messages) {
              let summary = `💭 Recent conversation memory (${history.messages.length} messages):\n\n`;
              history.messages.slice(-20).forEach((msg, index) => {
                const date = new Date(msg.date * 1000).toLocaleString();
                const sender = msg.from?.first_name || 'Unknown';
                const text = msg.text || msg.caption || '[Media]';
                summary += `${index + 1}. ${date} - ${sender}: ${text.substring(0, 80)}\n`;
              });
              return summary;
            }
          } catch (telegramError) {
            console.log('Telegram history failed, using S3 fallback:', telegramError.message);
          }
          // Fallback to S3-based retrieval
          return await getMessagesFromLastNhours(chatId, hours);

        case 'all':
          const textResults = await searchChatMessages(chatId, query, 10);
          const imageResults = await analyzeRecentImages(chatId, query, hours);
          return `**Text Search:**\n${textResults}\n\n**Image Analysis:**\n${imageResults}`;

        default:
          return await searchChatMessages(chatId, query, 20);
      }
    } catch (error) {
      return `❌ Search error: ${error.message}`;
    }
  },


  create_voice_message: async (args, chatId) => {
    const { text, voice_style = 'friendly', title } = args;

    const voiceMap = {
      'friendly': 'Friendly_Person',
      'professional': 'Professional_Speaker',
      'casual': 'Casual_Friend',
      'enthusiastic': 'Enthusiastic_Guide',
      'calm': 'Calm_Narrator'
    };

    return await createVoiceMemo(text, voiceMap[voice_style] || 'Friendly_Person', 'auto', 1, title, chatId);
  },

  send_message: async (args, chatId) => {
    const { messages, type = 'text' } = args;

    // This function returns a special marker that the agent executor recognizes
    // to send messages and end the conversation loop
    return {
      __SEND_MESSAGES__: true,
      messages: Array.isArray(messages) ? messages : [messages],
      type: type,
      chatId: chatId,
      timestamp: Date.now()
    };
  },

  reflect: async (args) => {
    const { action, focus = 'current situation', context } = args;
    return await performReflection(action, focus, { additionalContext: context });
  }
};