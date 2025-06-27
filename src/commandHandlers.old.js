import { OpenAI } from 'openai';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from '../services/s3Manager.js';
import { TelegramAPI } from '../services/telegramAPI.js';
import {
  fetchUrlContent,
  performGoogleSearch,
  performBraveSearch,
  saveUserMessage,
  saveBotMessage,
  getMessagesFromLastNhours,
  getMessagesFromLastNdays,
  getOldestMessages,
  getMessagesFromDateRange,
  searchChatMessages,
  getConversationSummary,
  analyzeRecentImages,
  extractTextFromRecentImages
} from '../services/messageService.js';
// Import agent configuration and execution
import { getAgentTools, getAgentSystemPrompt, TOOL_USAGE_CONFIG } from './agentConfig.js';
import { executeAgentTool, getToolExecutionDescription } from './agentExecutor.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
});

// Simple in-memory cache for cancellation requests
const cancellationRequests = new Map();

/**
 * Safely edit a message without sending new ones on failure
 * @param {string|number} chatId - Chat ID
 * @param {number} messageId - Message ID to edit
 * @param {string} newText - New text content
 */
async function safeEditMessage(chatId, messageId, newText) {
  if (!messageId) return;
  try {
    await TelegramAPI.editMessageText(chatId, messageId, newText);
  } catch (editError) {
    Logger.log(`Failed to edit message ${messageId}: ${editError.message}`, 'warning');
    // Don't send new message, just continue silently
  }
}

/**
 * Handle the /cancel command
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string|number} request_message_id - The message ID of the command
 * @returns {Promise<void>}
 */
export async function handleCancelCommand(chatId, request_message_id) {
  if (!chatId) {
    Logger.log('Invalid chat ID provided to handleCancelCommand', 'error');
    return;
  }

  try {
    Logger.log(`Cancel command received for chat ${chatId}`);
        
    // Set cancellation flag for this chat
    cancellationRequests.set(chatId.toString(), true);
        
    // Send confirmation
    await TelegramAPI.sendMessage(chatId, '🛑 Cancellation requested. The bot will stop processing after the current operation.', { reply_to_message_id: request_message_id });
        
    // Auto-cleanup after 30 seconds to prevent memory leaks
    setTimeout(() => {
      cancellationRequests.delete(chatId.toString());
    }, 30000);
        
    Logger.log(`Cancellation set for chat ${chatId}`);
        
  } catch (error) {
    Logger.log(`Error in handleCancelCommand: ${error.message}`, 'error');
        
    try {
      await TelegramAPI.sendMessage(chatId, '❌ Failed to cancel operation. Please try again.', { reply_to_message_id: request_message_id });
    } catch (sendError) {
      Logger.log(`Failed to send cancel error message: ${sendError.message}`, 'error');
    }
  }
}

/**
 * Check if cancellation was requested for a chat
 * 
 * @param {string|number} chatId - The chat ID
 * @returns {boolean} True if cancellation was requested
 */
function isCancellationRequested(chatId) {
  return cancellationRequests.has(chatId.toString());
}

/**
 * Clear cancellation request for a chat
 * 
 * @param {string|number} chatId - The chat ID
 */
function clearCancellationRequest(chatId) {
  cancellationRequests.delete(chatId.toString());
}

/**
 * Handle the /clearmessages command
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string|number} request_message_id - The message ID of the command
 * @returns {Promise<void>}
 */
export async function handleClearCommand(chatId, request_message_id) {
  if (!chatId) {
    Logger.log('Invalid chat ID provided to handleClearCommand', 'error');
    return;
  }

  const key = `fact_checker_bot/groups/${chatId}.json`;

  try {
    Logger.log(`Starting clear command for chat ${chatId}`);
        
    // Send immediate confirmation
    const confirmMessageData = await TelegramAPI.sendMessage(chatId, 'Clearing chat history...', { reply_to_message_id: request_message_id });

    // Get existing messages
    const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
    Logger.log(`Found ${existingData.messages.length} total messages in storage`);

    // Filter recent bot messages (last 48 hours) for deletion
    const now = Date.now();
    const fortyEightHoursAgo = now - (48 * 60 * 60 * 1000);
        
    const botMessages = existingData.messages.filter((msg) => msg.isBot && msg.messageId);
    const recentBotMessages = botMessages.filter((msg) => 
      msg.timestamp && msg.timestamp.unix && msg.timestamp.unix > fortyEightHoursAgo
    );
        
    Logger.log(`Found ${botMessages.length} total bot messages, ${recentBotMessages.length} recent enough to delete`);

    let deletedCount = 0;
    for (const msg of recentBotMessages) {
      try {
        await TelegramAPI.deleteMessage(chatId, msg.messageId);
        deletedCount++;
        Logger.log(`Deleted message ${msg.messageId}`);
      } catch (error) {
        Logger.log(`Failed to delete message ${msg.messageId}: ${error.message}`, 'info');
        // Continue with other deletions - this is expected for old messages
      }
    }

    // Clear stored messages
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, { messages: [] });
    Logger.log(`Cleared S3 storage for chat ${chatId}`);

    // Update confirmation message with results
    const resultMessage = `✅ Cleared ${deletedCount} bot messages from chat history.`;
    await TelegramAPI.editMessageText(chatId, confirmMessageData.message_id, resultMessage);
        
    // Wait a bit then delete the confirmation
    setTimeout(async () => {
      try {
        await TelegramAPI.deleteMessage(chatId, confirmMessageData.message_id);
        Logger.log('Deleted confirmation message');
      } catch (error) {
        Logger.log(`Failed to delete confirmation message: ${error.message}`, 'warning');
      }
    }, 3000); // Delete after 3 seconds
        
    Logger.log(`Successfully cleared chat history for chat ID ${chatId}`);
    return;
        
  } catch (error) {
    Logger.log(`Error in handleClearCommand: ${error.message}`, 'error');
        
    // Try to send error message
    try {
      await TelegramAPI.sendMessage(chatId, '❌ Failed to clear chat history. Please try again.', { reply_to_message_id: request_message_id });
    } catch (sendError) {
      Logger.log(`Failed to send error message: ${sendError.message}`, 'error');
    }
  }
}

/**
 * Get recent messages based on count
 * 
 * @param {string|number} chatId - The chat ID
 * @param {number} numberOfMessages - Number of recent messages to retrieve
 * @returns {Promise<Array>} - Promise that resolves with the messages
 */
async function getRecentMessages(chatId, numberOfMessages = 10) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;

    Logger.log(`Fetching ${numberOfMessages} recent messages for chat ${chatId}`);

    const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);

    // Get the most recent messages based on count
    const recentMessages = (data?.messages ?? []).slice(-numberOfMessages);

    Logger.log(`Found ${recentMessages.length} messages`);
    return recentMessages;

  } catch (error) {
    if (error.name === 'NoSuchKey') {
      Logger.log(`No message history found for chat ${chatId}`, 'info');
    } else {
      Logger.log(`Error getting messages: ${error.message}`, 'error');
    }
    return [];
  }
}

/**
 * Handle incoming messages and route to appropriate handlers
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string} text - The message text
 * @param {object} message - The complete message object
 * @returns {Promise<void>}
 */
export async function handleMessage(chatId, text, message) {
  // Ignore messages from bots (including our own bot)
  if (message.from && message.from.is_bot) {
    Logger.log(`Ignoring message from bot: ${message.from.first_name || 'Unknown'}`);
    return;
  }
    
  if (text.startsWith('/clearmessages')) {
    await handleClearCommand(chatId, message.message_id);
  } else if (text.startsWith('/cancel')) {
    await handleCancelCommand(chatId, message.message_id);
  } else if (text.toLowerCase().startsWith('robot,') || text.toLowerCase().startsWith('robot ')) {
    const query = text.slice(text.indexOf(' ')).trim();
    await handleRobotQuery(chatId, query, message.message_id);
  } else if (text.includes('-bot')) {
    // Handle personality-based bot queries like "conspiracy-bot" or "liberal republican-bot"
    const match = text.match(/(.+?)-bot[,\s]/i);
    if (match) {
      const personality = match[1].toLowerCase();
      const query = text.replace(/.+?-bot[,\s]*/i, '').trim();
      await handleRobotQuery(chatId, query, message.message_id, personality);
    }
  } else {
    await saveUserMessage(chatId, message);
  }
}

/**
 * Handle when the bot is added to a new chat
 * 
 * @param {string|number} chatId - The chat ID
 * @param {Object} chat - The chat object with details about the group
 * @returns {Promise<void>}
 */
export async function handleBotAddedToChat(chatId, chat) {
  try {
    Logger.log(`Sending introduction message to chat ${chatId} (${chat.title || 'Unknown'})`);
    
    const introMessage = `👋 Hello everyone! I'm @LetMeCheckThatBot, your intelligent AI assistant.

🔍 **What I can do:**
• Analyze images, videos, GIFs, and voice messages
• Fact-check claims and provide research
• Answer questions with web search capabilities
• Summarize conversations and extract insights

🗣️ **How to use me:**
• Start messages with "robot," or "robot " to ask questions
• Send media files for automatic analysis
• Use personality modes like "conspiracy-bot," or "liberal-bot," 

🎯 **Examples:**
• "robot, is this claim about climate change accurate?"
• "conservative-bot, what are the benefits of renewable energy?"
• Just send me an image, video, or voice note for analysis!

Type "robot, help" anytime for more information. Ready to help with factual, evidence-based responses! 🤖`;

    const sentMessage = await TelegramAPI.sendMessage(chatId, introMessage);
    if (sentMessage) {
      await saveBotMessage(chatId, sentMessage);
      Logger.log(`Introduction sent successfully to chat ${chatId}`);
    }
  } catch (error) {
    Logger.log(`Error sending introduction to chat ${chatId}: ${error.message}`, 'error');
  }
}

/**
 * Handle a query to the Robot
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string} query - The user's query text
 * @param {string|number} request_message_id - The message ID of the request
 * @param {string} personality - Optional personality for the bot (e.g., "bro", "republican")
 * @returns {Promise<void>}
 */
export async function handleRobotQuery(chatId, query, request_message_id, personality = null) {
  if (!chatId || !query) {
    Logger.log('Invalid input parameters for handleRobotQuery', 'error');
    return;
  }

  // Initialize variables
  let fetchingMessage;
  let accumulatedContext = '';
  let finalResponse = null;
  let messagesSent = false;
  let loopCount = 0;
    
  try {
    fetchingMessage = await TelegramAPI.sendMessage(
      chatId,
      'Processing your question...',
      { reply_to_message_id: request_message_id }
    );

    const messages = await getMessagesFromLastNhours(chatId, 24);
    const conversation = JSON.stringify(messages);

    // Get agent configuration
    const tools = getAgentTools();
    const { MAX_LOOPS, MAX_TOOL_USAGE, DEFAULT_TOOL_COUNTS } = TOOL_USAGE_CONFIG;
    const toolUsageCount = { ...DEFAULT_TOOL_COUNTS };
      {
        type: 'function',
        function: {
          name: 'get_older_messages',
          description: 'Retrieve older messages from multiple days ago or the oldest messages in the chat',
          parameters: {
            type: 'object',
            properties: {
              timeframe: {
                type: 'string',
                enum: ['days', 'oldest', 'date_range'],
                description: 'Type of timeframe: "days" for last N days, "oldest" for earliest messages, "date_range" for specific date range'
              },
              value: {
                type: 'integer',
                description: 'Number of days (for "days" timeframe) or number of messages (for "oldest" timeframe)'
              },
              start_date: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format (only for "date_range" timeframe)'
              },
              end_date: {
                type: 'string', 
                description: 'End date in YYYY-MM-DD format (only for "date_range" timeframe)'
              }
            },
            required: ['timeframe']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_chat_messages',
          description: 'Search for specific messages in the current chat conversation history',
          parameters: {
            type: 'object',
            properties: {
              search_term: {
                type: 'string',
                description: 'Term or phrase to search for in chat messages. Examples: "bitcoin", "meeting tomorrow", "vaccine discussion"'
              },
              max_results: {
                type: 'integer',
                description: 'Maximum number of search results to return (default: 20)'
              }
            },
            required: ['search_term']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_conversation_summary',
          description: 'Get a summary of conversation activity, participants, and topics for a time period',
          parameters: {
            type: 'object',
            properties: {
              hours: {
                type: 'integer',
                description: 'Number of hours to look back for conversation summary (default: 24)'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_images',
          description: 'Analyze images that were recently shared in the chat using AI vision. Can identify objects, read text, analyze content, describe scenes, etc.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'What to analyze about the images. Examples: "what products are shown", "identify any text or signs", "describe the scene", "is this accurate information", "what does this chart show"'
              },
              hours: {
                type: 'integer',
                description: 'Number of hours to look back for images (default: 24)'
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'extract_text_from_images',
          description: 'Extract and read text from images shared in the chat. Useful for OCR of screenshots, documents, signs, etc.',
          parameters: {
            type: 'object',
            properties: {
              hours: {
                type: 'integer',
                description: 'Number of hours to look back for images (default: 24)'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_url_content',
          description: 'Retrieve content from a specific URL',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to fetch content from'
              }
            },
            required: ['url']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'respond_to_user',
          description: "Send your response as 1-4 casual text messages. Write like you're texting a friend - natural, conversational, brief. RULES: 1) Maximum 4 messages total. 2) Write like text messages - short, casual, readable. 3) Only ONE message can contain links. 4) No formal language or structure.",
          parameters: {
            type: 'object',
            properties: {
              messages: {
                type: 'array',
                items: {
                  type: 'string'
                },
                maxItems: 4,
                description: "1-4 casual text messages. Write like you're texting - natural, brief, conversational. Example: ['Yeah Biden won with 306 electoral votes', 'All states certified it', 'Multiple recounts confirmed everything', 'Sources: [AP](url) [Reuters](url)'] NOT formal essay style."
              }
            },
            required: ['messages']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'calculate_math',
          description: 'Perform mathematical calculations and evaluations using math expressions',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: "Mathematical expression to evaluate (e.g., '2+2', 'sqrt(16)', 'sin(pi/2)', '5!')"
              }
            },
            required: ['expression']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_accommodation',
          description: 'Search for hotels and accommodation options',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'Location to search (city, country, address)'
              },
              checkin: {
                type: 'string',
                description: 'Check-in date in YYYY-MM-DD format'
              },
              checkout: {
                type: 'string',
                description: 'Check-out date in YYYY-MM-DD format'
              },
              adults: {
                type: 'number',
                description: 'Number of adults (default: 2)'
              },
              rooms: {
                type: 'number',
                description: 'Number of rooms (default: 1)'
              }
            },
            required: ['location', 'checkin', 'checkout']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_images',
          description: 'Search for images related to a topic. Use specific, descriptive queries for best results',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: "Specific image search query. Examples: 'iPhone 15 Pro official photos', 'Biden meeting Ukraine president 2024', 'Tesla Model Y interior dashboard'. Be descriptive and specific."
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_videos',
          description: 'Search for videos related to a topic. Focuses on YouTube and video platforms for tutorials, news, reviews',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: "Specific video search query. Examples: 'iPhone 15 review MKBHD', 'Ukraine war explained 2024', 'how to fix car engine tutorial'. Include 'tutorial', 'review', 'explained', 'news' for better results."
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_news',
          description: 'Search for current news articles and breaking news. Best for recent events, current affairs, and latest developments.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: "News search query. Examples: 'Biden election 2024', 'Ukraine war latest', 'Apple iPhone release', 'climate change COP28'. Include recent years or 'latest' for current events."
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_reddit',
          description: 'Search Reddit discussions for public opinion and alternative perspectives on topics',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: "Search query for Reddit discussions. Examples: 'Tesla stock opinions', 'Biden policy discussions', 'iPhone 15 user experiences'"
              },
              subreddit: {
                type: 'string',
                description: 'Specific subreddit to search (optional). Popular ones: news, politics, technology, worldnews, AskReddit, explainlikeimfive'
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_reddit_posts',
          description: 'Get top posts from specific Reddit communities for trending topics and discussions',
          parameters: {
            type: 'object',
            properties: {
              subreddit: {
                type: 'string',
                description: 'Subreddit name without r/ prefix. Examples: news, politics, technology, worldnews, stocks, cryptocurrency'
              },
              timeframe: {
                type: 'string',
                enum: ['hour', 'day', 'week', 'month', 'year', 'all'],
                description: 'Time period for top posts (default: day)'
              }
            },
            required: ['subreddit']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_alternative_sources',
          description: 'Search alternative and niche sources for diverse perspectives beyond mainstream media. Searches Medium, Substack, Hacker News, Ars Technica, Techdirt, Slashdot, and other independent sources.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for alternative sources. Will search Medium, Substack, Hacker News, Ars Technica, and other independent publications'
              }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'summarize_content',
          description: 'Summarize large amounts of text or research data into key points. Example: After gathering multiple search results about climate change, use this to extract 3-5 key findings into bullet points.',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: "Content to summarize. Example: 'Scientists report that global temperatures have risen 1.1°C since 1880. The IPCC found that human activities are the main driver. Recent studies show accelerating ice loss in Antarctica...'"
              },
              maxPoints: {
                type: 'number',
                description: 'Maximum number of key points to extract (default: 5). Example: 3 for concise summary, 7 for detailed'
              }
            },
            required: ['content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'filter_data',
          description: "Filter arrays of data based on criteria. Example: Filter Reddit posts to only show recent ones with 'contains:vaccine' or 'score:>10'.",
          parameters: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object'
                },
                description: 'Array of data to filter. Example: Reddit posts, search results, news articles array'
              },
              criteria: {
                type: 'string',
                description: "Filter criteria examples: 'contains:biden' (items containing biden), 'date:recent' (last 24 hours), 'score:>100' (score above 100), 'length:>50' (text longer than 50 chars)"
              }
            },
            required: ['data', 'criteria']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'sort_data',
          description: "Sort arrays of data by any field. Example: Sort Reddit posts by 'ups' desc to see most upvoted first, or news by 'date' desc for newest first.",
          parameters: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object'
                },
                description: 'Array of data to sort. Example: Reddit posts, news articles, search results'
              },
              sortBy: {
                type: 'string',
                description: "Field to sort by. Examples: 'ups' (Reddit upvotes), 'date' (publication date), 'score' (relevance), 'title' (alphabetical)"
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: "Sort order: 'desc' for highest first (newest/most upvoted), 'asc' for lowest first (oldest/least upvoted)"
              }
            },
            required: ['data', 'sortBy']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_data',
          description: "Analyze and aggregate data to extract insights. Examples: 'count' operation on 'subreddit' field to see post distribution, 'average' on 'ups' to find avg upvotes, 'group' by 'source' to categorize news.",
          parameters: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object'
                },
                description: 'Array of data to analyze. Example: Reddit posts, news articles, search results'
              },
              operation: {
                type: 'string',
                enum: ['count', 'average', 'sum', 'group', 'trends'],
                description: "Analysis examples: 'count' (count items), 'average' ups (avg upvotes), 'sum' scores (total), 'group' by source (categorize), 'trends' over time"
              },
              field: {
                type: 'string',
                description: "Field to analyze. Examples: 'ups' (upvotes), 'subreddit' (group by sub), 'date' (for trends), 'source' (news sources)"
              }
            },
            required: ['data', 'operation']
          }
        }
      }
    ];

    while (!finalResponse && !messagesSent && loopCount < MAX_LOOPS) {
      // Check for cancellation before each tool execution
      if (isCancellationRequested(chatId)) {
        Logger.log(`Cancellation detected for chat ${chatId}, stopping tool loop`);
        clearCancellationRequest(chatId);
                
        // Update the message to indicate cancellation
        await safeEditMessage(chatId, fetchingMessage?.message_id, '🛑 Operation cancelled by user request.');
        messagesSent = true; // Prevent fallback execution
        return;
      }
            
      loopCount++;
      Logger.log(`Tool selection loop iteration ${loopCount}`);

      // Call OpenAI API with tools
      const response = await openai.chat.completions.create({
        model: CONFIG.GPT_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant in a Telegram group chat. Your goal is to answer user queries accurately and concisely based on the provided conversation history and web search results.
                        
${personality ? `CRITICAL: Adopt the personality and speaking style of a ${personality}. Never announce your persona - simply BE that character naturally. Keep responses brief and conversational, letting the ${personality} personality come through in word choice, tone, and perspective without explicitly stating it.` : ''}
                        
                        Research effectively to provide accurate answers:
                        
                        RESEARCH PATTERNS:
                        
                        **For Fact-Checking/Controversial Topics:**
                        1. search_web: "X fact check snopes 2024" 
                        2. search_news: "X latest verification debunked"
                        3. search_reddit: Check r/news, r/politics for public reaction
                        4. search_alternative_sources: Get diverse perspectives
                        
                        **For Current Events:**
                        1. search_news: "X breaking news today January 2025"
                        2. search_web: "X latest updates verified sources"
                        3. search_reddit: r/worldnews, r/news for real-time discussion
                        
                        **For Deep Research (conspiracies, complex topics):**
                        1. search_web: Multiple angles - official stance, criticism, evidence
                        2. search_reddit: r/conspiracy, r/explainlikeimfive for different views
                        3. search_alternative_sources: Independent journalists, Medium articles
                        4. search_news: Recent developments and investigations
                        
                        **For Products/Reviews:**
                        1. search_web: "X review 2024 specs price"
                        2. search_reddit: r/technology, specific product subreddits for user opinions
                        3. search_videos: "X review MKBHD unboxing"
                        
                        **For Historical/Political Questions:**
                        1. search_web: Official sources, academic sources
                        2. search_alternative_sources: Different political perspectives
                        3. search_reddit: Political subreddits for current opinions
                        
                        TOOL USAGE:
                        • search_web: Primary factual research, verification
                        • search_news: Breaking news, recent developments  
                        • search_reddit: Public opinion, user experiences, alternative viewpoints
                        • search_alternative_sources: Independent journalism, diverse perspectives
                        • get_reddit_posts: Trending topics, community sentiment
                        • search_videos: Reviews, explanations, tutorials
                        • summarize_content: Distill large amounts of research into key points
                        • filter_data: Narrow down results (contains:keyword, date:recent, score:>5)
                        • sort_data: Organize results by date, score, relevance
                        • analyze_data: Extract insights (count, average, trends, grouping)
                        • respond_to_user: **FINAL ANSWER ONLY** Send 1-4 casual text messages like texting a friend. Max 4 messages. Only 1 can have links.
                        
                        IMPORTANT: Use tools efficiently - gather enough information to answer accurately, then respond. Quality over quantity. 
                        If a link directly supports your answer or fulfills the user's request (e.g., they asked for a link), include it in your final response using Markdown format [link text](URL). Only include a link if it adds significant value and is directly relevant.
                        Accumulated context from previous tool calls: ${accumulatedContext}`
          },
          {
            role: 'user',
            content: `Conversation History (last 24 hours): ${conversation}\n\nUser Query: ${query}`
          }
        ],
        tools: tools,
        tool_choice: 'auto',
      });

      const responseMessage = response.choices[0].message;

      // Check if a tool call was made
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        Logger.log(`Tool selected: ${functionName}`);
                
        // Check tool usage limits to prevent infinite loops
        if (toolUsageCount[functionName] !== undefined) {
          if (toolUsageCount[functionName] >= MAX_TOOL_USAGE) {
            Logger.log(`Tool ${functionName} usage limit (${MAX_TOOL_USAGE}) reached, forcing final response`);
            accumulatedContext += `\n[Note: Reached usage limit for ${functionName} tool - proceeding with available information]\n`;
            // Force final response generation
            break;
          }
          toolUsageCount[functionName]++;
          Logger.log(`Tool ${functionName} usage count: ${toolUsageCount[functionName]}/${MAX_TOOL_USAGE}`);
        }

        // Handle different tool calls
        if (functionName === 'search_web') {
          const searchQuery = functionArgs.query;
          Logger.log(`Performing web search for: ${searchQuery}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching the web for: "${searchQuery}"...`);

          try {
            // Execute the search
            const [googleResults, braveResults] = await Promise.all([
              performGoogleSearch(searchQuery),
              performBraveSearch(searchQuery)
            ]);

            // Add to accumulated context
            accumulatedContext += `\nWeb Search Results for "${searchQuery}":\n${googleResults}\n\nBrave Search Results:\n${braveResults}\n`;

            Logger.log('Search completed and results added to context');
          } catch (error) {
            Logger.log(`Search tool error: ${error.message}`, 'error');
            accumulatedContext += `\nSearch for "${searchQuery}" failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'get_message_history') {
          const hours = functionArgs.hours;
          Logger.log(`Message history requested for the last ${hours} hours`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Retrieving message history from the last ${hours} hours...`);

          try {
            // Get messages from the specified time period
            const historyMessages = await getMessagesFromLastNhours(chatId, hours);

            // Format messages into a transcript
            let historyTranscript = `\nChat history from the last ${hours} hours (${historyMessages.length} messages):\n`;
            historyMessages.forEach(msg => {
              const sender = msg.message_from || 'Unknown';
              const text = msg.message_text || '[No text content]';
              const time = msg.timestamp?.friendly || 'Unknown time';
              historyTranscript += `(${time}) ${sender}: ${text}\n`;
            });

            // Add formatted transcript to accumulated context
            accumulatedContext += historyTranscript;

            Logger.log(`Retrieved and formatted ${historyMessages.length} messages from the last ${hours} hours`);
          } catch (error) {
            Logger.log(`Message history fetch error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to fetch message history for the last ${hours} hours: ${error.message}\n`;
          }
        }
        else if (functionName === 'get_older_messages') {
          const timeframe = functionArgs.timeframe;
          const value = functionArgs.value;
          const startDate = functionArgs.start_date;
          const endDate = functionArgs.end_date;
          
          Logger.log(`Older messages requested: ${timeframe} with value ${value}`);
          
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Retrieving older messages (${timeframe})...`);

          try {
            let olderMessages = [];
            let description = '';
            
            if (timeframe === 'days' && value) {
              olderMessages = await getMessagesFromLastNdays(chatId, value);
              description = `last ${value} days`;
            } else if (timeframe === 'oldest' && value) {
              olderMessages = await getOldestMessages(chatId, value);
              description = `oldest ${value} messages`;
            } else if (timeframe === 'date_range' && startDate && endDate) {
              olderMessages = await getMessagesFromDateRange(chatId, startDate, endDate);
              description = `${startDate} to ${endDate}`;
            }

            // Format messages into a transcript
            let historyTranscript = `\nOlder messages (${description}) - ${olderMessages.length} messages:\n`;
            olderMessages.forEach(msg => {
              const sender = msg.message_from || 'Unknown';
              const text = msg.message_text || '[No text content]';
              const time = msg.timestamp?.friendly || 'Unknown time';
              historyTranscript += `(${time}) ${sender}: ${text}\n`;
            });

            // Add formatted transcript to accumulated context
            accumulatedContext += historyTranscript;

            Logger.log(`Retrieved and formatted ${olderMessages.length} older messages (${description})`);
          } catch (error) {
            Logger.log(`Older messages fetch error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to fetch older messages (${timeframe}): ${error.message}\n`;
          }
        }
        else if (functionName === 'search_chat_messages') {
          const searchTerm = functionArgs.search_term;
          const maxResults = functionArgs.max_results || 20;
          
          Logger.log(`Chat message search requested: "${searchTerm}"`);
          
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching chat messages for: "${searchTerm}"...`);

          try {
            const searchResults = await searchChatMessages(chatId, searchTerm, maxResults);
            
            // Add search results to accumulated context
            accumulatedContext += `\n${searchResults}\n`;

            Logger.log(`Chat message search completed for: "${searchTerm}"`);
          } catch (error) {
            Logger.log(`Chat message search error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to search chat messages for "${searchTerm}": ${error.message}\n`;
          }
        }
        else if (functionName === 'get_conversation_summary') {
          const hours = functionArgs.hours || 24;
          
          Logger.log(`Conversation summary requested for last ${hours} hours`);
          
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Generating conversation summary for last ${hours} hours...`);

          try {
            const summary = await getConversationSummary(chatId, hours);
            
            // Add summary to accumulated context
            accumulatedContext += `\n${summary}\n`;

            Logger.log(`Conversation summary generated for last ${hours} hours`);
          } catch (error) {
            Logger.log(`Conversation summary error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to generate conversation summary: ${error.message}\n`;
          }
        }
        else if (functionName === 'analyze_images') {
          const query = functionArgs.query;
          const hours = functionArgs.hours || 24;
          
          Logger.log(`Image analysis requested: "${query}" for last ${hours} hours`);
          
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Analyzing images from last ${hours} hours...`);

          try {
            const analysisResults = await analyzeRecentImages(chatId, query, hours);
            
            // Add analysis results to accumulated context
            accumulatedContext += `\n${analysisResults}\n`;

            Logger.log(`Image analysis completed for query: "${query}"`);
          } catch (error) {
            Logger.log(`Image analysis error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to analyze images: ${error.message}\n`;
          }
        }
        else if (functionName === 'extract_text_from_images') {
          const hours = functionArgs.hours || 24;
          
          Logger.log(`Text extraction from images requested for last ${hours} hours`);
          
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Extracting text from images in last ${hours} hours...`);

          try {
            const extractionResults = await extractTextFromRecentImages(chatId, hours);
            
            // Add extraction results to accumulated context
            accumulatedContext += `\n${extractionResults}\n`;

            Logger.log(`Text extraction from images completed`);
          } catch (error) {
            Logger.log(`Text extraction error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to extract text from images: ${error.message}\n`;
          }
        }
        else if (functionName === 'get_url_content') {
          const url = functionArgs.url;
          Logger.log(`URL content requested for: ${url}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Fetching content from: ${url}...`);

          try {
            // Fetch content from the URL
            const urlContent = await fetchUrlContent(url);

            // Add to accumulated context
            accumulatedContext += `\nURL Content from ${url}:\n${urlContent}\n`;

            Logger.log('URL content fetched and added to context');
          } catch (error) {
            Logger.log(`URL content fetch error: ${error.message}`, 'error');
            accumulatedContext += `\nFailed to fetch content from ${url}: ${error.message}\n`;
          }
        }
        else if (functionName === 'calculate_math') {
          const expression = functionArgs.expression;
          Logger.log(`Math calculation requested: ${expression}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Calculating: ${expression}...`);

          try {
            const mathResult = await performMathCalculation(expression);
            accumulatedContext += `\n${mathResult}\n`;
            Logger.log('Math calculation completed');
          } catch (error) {
            Logger.log(`Math calculation error: ${error.message}`, 'error');
            accumulatedContext += `\nMath calculation failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'search_accommodation') {
          const location = functionArgs.location;
          const checkin = functionArgs.checkin;
          const checkout = functionArgs.checkout;
          const adults = functionArgs.adults || 2;
          const rooms = functionArgs.rooms || 1;
          Logger.log(`Accommodation search requested: ${location}, ${checkin} to ${checkout}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching for accommodation in ${location}...`);

          try {
            const accommodationResults = await searchAccommodation(location, checkin, checkout, adults, rooms);
            accumulatedContext += `\n${accommodationResults}\n`;
            Logger.log('Accommodation search completed');
          } catch (error) {
            Logger.log(`Accommodation search error: ${error.message}`, 'error');
            accumulatedContext += `\nAccommodation search failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'search_images') {
          const query = functionArgs.query;
          Logger.log(`Image search requested: ${query}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching for images: "${query}"...`);

          try {
            const imageResults = await performImageSearch(query);
            accumulatedContext += `\n${imageResults}\n`;
            Logger.log('Image search completed');
          } catch (error) {
            Logger.log(`Image search error: ${error.message}`, 'error');
            accumulatedContext += `\nImage search failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'search_videos') {
          const query = functionArgs.query;
          Logger.log(`Video search requested: ${query}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching for videos: "${query}"...`);

          try {
            const videoResults = await performVideoSearch(query);
            accumulatedContext += `\n${videoResults}\n`;
            Logger.log('Video search completed');
          } catch (error) {
            Logger.log(`Video search error: ${error.message}`, 'error');
            accumulatedContext += `\nVideo search failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'search_news') {
          const query = functionArgs.query;
          Logger.log(`News search requested: ${query}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching news for: "${query}"...`);

          try {
            const newsResults = await performNewsSearch(query);
            accumulatedContext += `\n${newsResults}\n`;
            Logger.log('News search completed');
          } catch (error) {
            Logger.log(`News search error: ${error.message}`, 'error');
            accumulatedContext += `\nNews search failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'search_reddit') {
          const query = functionArgs.query;
          const subreddit = functionArgs.subreddit || 'all';
          Logger.log(`Reddit search requested: ${query} in r/${subreddit}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching Reddit discussions: "${query}"...`);

          try {
            const redditResults = await searchReddit(query, subreddit);
            accumulatedContext += `\n${redditResults}\n`;
            Logger.log('Reddit search completed');
          } catch (error) {
            Logger.log(`Reddit search error: ${error.message}`, 'error');
            accumulatedContext += `\nReddit search failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'get_reddit_posts') {
          const subreddit = functionArgs.subreddit;
          const timeframe = functionArgs.timeframe || 'day';
          Logger.log(`Reddit posts requested: r/${subreddit} for ${timeframe}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Getting top posts from r/${subreddit}...`);

          try {
            const redditPosts = await getRedditPosts(subreddit, timeframe);
            accumulatedContext += `\n${redditPosts}\n`;
            Logger.log('Reddit posts retrieval completed');
          } catch (error) {
            Logger.log(`Reddit posts error: ${error.message}`, 'error');
            accumulatedContext += `\nReddit posts retrieval failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'search_alternative_sources') {
          const query = functionArgs.query;
          Logger.log(`Alternative sources search requested: ${query}`);
                    
          // Update fetchingMessage with current operation
          await safeEditMessage(chatId, fetchingMessage?.message_id, `Searching alternative sources for: "${query}"...`);

          try {
            const altResults = await searchUnpopularSites(query);
            accumulatedContext += `\n${altResults}\n`;
            Logger.log('Alternative sources search completed');
          } catch (error) {
            Logger.log(`Alternative sources search error: ${error.message}`, 'error');
            accumulatedContext += `\nAlternative sources search failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'summarize_content') {
          const content = functionArgs.content;
          const maxPoints = functionArgs.maxPoints || 5;
          Logger.log(`Summarize content requested: ${content.length} chars`);
                    
          await safeEditMessage(chatId, fetchingMessage?.message_id, 'Summarizing content...');

          try {
            const summary = await summarizeContent(content, maxPoints);
            accumulatedContext += `\n${summary}\n`;
            Logger.log('Content summarization completed');
          } catch (error) {
            Logger.log(`Summarize error: ${error.message}`, 'error');
            accumulatedContext += `\nSummarization failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'filter_data') {
          const data = functionArgs.data;
          const criteria = functionArgs.criteria;
          Logger.log(`Filter data requested: ${data.length} items with criteria ${criteria}`);
                    
          await safeEditMessage(chatId, fetchingMessage?.message_id, 'Filtering data...');

          try {
            const filtered = await filterData(data, criteria);
            accumulatedContext += `\n${filtered}\n`;
            Logger.log('Data filtering completed');
          } catch (error) {
            Logger.log(`Filter error: ${error.message}`, 'error');
            accumulatedContext += `\nFiltering failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'sort_data') {
          const data = functionArgs.data;
          const sortBy = functionArgs.sortBy;
          const order = functionArgs.order || 'desc';
          Logger.log(`Sort data requested: ${data.length} items by ${sortBy} (${order})`);
                    
          await safeEditMessage(chatId, fetchingMessage?.message_id, 'Sorting data...');

          try {
            const sorted = await sortData(data, sortBy, order);
            accumulatedContext += `\n${sorted}\n`;
            Logger.log('Data sorting completed');
          } catch (error) {
            Logger.log(`Sort error: ${error.message}`, 'error');
            accumulatedContext += `\nSorting failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'analyze_data') {
          const data = functionArgs.data;
          const operation = functionArgs.operation;
          const field = functionArgs.field;
          Logger.log(`Analyze data requested: ${operation} on ${data.length} items`);
                    
          await safeEditMessage(chatId, fetchingMessage?.message_id, 'Analyzing data...');

          try {
            const analysis = await analyzeData(data, operation, field);
            accumulatedContext += `\n${analysis}\n`;
            Logger.log('Data analysis completed');
          } catch (error) {
            Logger.log(`Analysis error: ${error.message}`, 'error');
            accumulatedContext += `\nAnalysis failed: ${error.message}\n`;
          }
        }
        else if (functionName === 'respond_to_user') {
          // Get array of messages from the tool call
          let messages = functionArgs.messages || [];
                    
          // ENFORCE: Maximum 5 messages limit (buffer for 4 rule)
          if (messages.length > 5) {
            Logger.log(`WARNING: Bot tried to send ${messages.length} messages, limiting to 5`);
            messages = messages.slice(0, 5);
          }
                    
          Logger.log(`Sending ${messages.length} response messages`);
                    
          // Delete the "Processing..." message first
          if (fetchingMessage?.message_id) {
            try {
              await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id);
            } catch (deleteError) {
              Logger.log(`Failed to delete processing message: ${deleteError.message}`, 'warning');
            }
          }
                    
          // Send messages with staggered timing for natural feel
          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
                        
            // Check for cancellation before sending each message
            if (isCancellationRequested(chatId)) {
              Logger.log('Cancellation detected while sending messages, stopping');
              clearCancellationRequest(chatId);
              return;
            }
                        
            // Add typing delay based on PREVIOUS message length (so user has time to read it)
            if (i > 0) {
              const previousMessage = messages[i - 1];
              const readingDelay = Math.min(Math.max(previousMessage.length * 25, 800), 3000); // 25ms per char, min 0.8s, max 3s
              Logger.log(`Waiting ${readingDelay}ms before sending message ${i + 1}`);
              await new Promise(resolve => setTimeout(resolve, readingDelay));
            }
                        
            try {
              const sentMessage = await TelegramAPI.sendMessage(chatId, message);
              await saveBotMessage(chatId, sentMessage);
              Logger.log(`Sent message ${i + 1}/${messages.length}: ${message.substring(0, 50)}...`);
            } catch (sendError) {
              Logger.log(`Failed to send message ${i + 1}: ${sendError.message}`, 'error');
            }
          }
                    
          // Clear cancellation requests and mark messages as sent
          clearCancellationRequest(chatId);
          messagesSent = true; // This will break the while loop
          Logger.log('Messages sent via respond_to_user, marking as complete');
          return; // EXIT IMMEDIATELY - don't continue the loop
        }
      } else {
        // If no tool was selected but there's content, use it as the final response
        if (responseMessage.content) {
          finalResponse = responseMessage.content;
          Logger.log('Response generated without tool selection');
          // Break the loop since we have a final response
          break;
        }
      }
    }

    // If we hit max loops without a final response, use the accumulated context to generate one
    if (!finalResponse) {
      Logger.log(`Max loops (${MAX_LOOPS}) reached without final response, generating one now`);

      // Make a final call to generate a response based on accumulated context
      const finalCall = await openai.chat.completions.create({
        model: CONFIG.GPT_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant in a Telegram group chat. Based on the research and information gathered, provide a final answer to the user's question.
                        
${personality ? `CRITICAL: Adopt the personality and speaking style of a ${personality}. Never announce your persona - simply BE that character naturally. Keep responses brief and conversational, letting the ${personality} personality come through in word choice, tone, and perspective without explicitly stating it.` : ''}

Your task is to synthesize the information below into a clear, concise answer. Do NOT use any tools - just provide the final response based on the research already completed.

Keep your response brief and directly address the user's question. 
If a link directly supports your answer or fulfills the user's request, include it using Markdown format [link text](URL). Only include links that add significant value.

Research completed: ${accumulatedContext}`
          },
          {
            role: 'user', content: `Question: "${query}"
  
  past 24 hours of messages in the groupchat:
  ${conversation}
  
  Additional context gathered:\n${accumulatedContext}\n\n
  
  Based on ALL the information above, provide a FINAL answer to the original query: "${query}"`
          }
        ],
        temperature: 0.85,
        max_tokens: CONFIG.MAX_TOKENS
      });

      finalResponse = finalCall.choices[0].message.content;
    }

    // Check if we already sent messages via respond_to_user tool
    if (messagesSent) {
      Logger.log('Messages already sent via respond_to_user tool, exiting function');
      return;
    }

    // Update fetchingMessage with the final response instead of deleting it
    let sentMessage;
    if (fetchingMessage?.message_id) {
      try {
        sentMessage = await TelegramAPI.editMessageText(chatId, fetchingMessage.message_id, finalResponse);
      } catch (editError) {
        Logger.log(`Failed to edit final message: ${editError.message}`, 'warning');
        // Only send new message as absolute last resort
        sentMessage = await TelegramAPI.sendMessage(chatId, finalResponse);
      }
    } else {
      // Fallback in case fetchingMessage wasn't created properly
      sentMessage = await TelegramAPI.sendMessage(chatId, finalResponse);
    }
    await saveBotMessage(chatId, sentMessage);
        
    // Clear any pending cancellation requests for this chat
    clearCancellationRequest(chatId);
        
    // Ensure function ends after sending final message
    return;

  } catch (error) {
    Logger.log(`Robot query processing failed: ${error.message}`, 'error');
        
    // Don't send error message if we already sent messages via respond_to_user
    if (messagesSent) {
      Logger.log('Messages already sent, skipping error message');
      clearCancellationRequest(chatId);
      return;
    }
        
    const errorMessage = 'Sorry, I was unable to process your question at this time. Please try again later.';
    let sentMessage;
        
    if (fetchingMessage?.message_id) {
      // Update the fetchingMessage with the error message instead of deleting it
      try {
        sentMessage = await TelegramAPI.editMessageText(chatId, fetchingMessage.message_id, errorMessage);
      } catch (err) {
        Logger.log(`Failed to edit fetching message: ${err.message}`, 'error');
        // Don't send additional messages - just log the error
        Logger.log(`Error message not delivered: ${errorMessage}`, 'warning');
        return; // Exit without sending duplicate messages
      }
    } else {
      sentMessage = await TelegramAPI.sendMessage(chatId, errorMessage);
    }
        
    // Only save if a message was successfully sent or edited
    if (sentMessage) {
      await saveBotMessage(chatId, sentMessage);
    }
        
    // Clear any pending cancellation requests for this chat
    clearCancellationRequest(chatId);
        
    // Ensure function ends after error handling
    return;
  }
}