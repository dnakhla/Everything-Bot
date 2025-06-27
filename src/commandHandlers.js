/**
 * Command Handlers - Simplified with Agent Toolkit
 * 
 * This module handles Telegram bot commands using the simplified agent toolkit
 * architecture. It provides a clean, maintainable interface for AI agent interactions.
 */

import { OpenAI } from 'openai';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { TelegramAPI } from '../services/telegramAPI.js';
import {
  saveUserMessage,
  saveBotMessage,
  getMessagesFromLastNhours
} from '../services/messageService.js';

// Import agent configuration and execution
import { getAgentTools, getAgentSystemPrompt, TOOL_USAGE_CONFIG } from './agentConfig.js';
import { executeAgentTool, getToolExecutionDescription } from './agentExecutor.js';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
  timeout: 60000,
});

// Cancellation tracking
const cancellationRequests = new Set();

export function requestCancellation(chatId) {
  cancellationRequests.add(chatId);
  Logger.log(`Cancellation requested for chat ${chatId}`);
}

function isCancellationRequested(chatId) {
  return cancellationRequests.has(chatId);
}

function clearCancellationRequest(chatId) {
  cancellationRequests.delete(chatId);
}

// Utility function to safely edit messages
async function safeEditMessage(chatId, messageId, text, options = {}) {
  if (!messageId) return null;
  
  try {
    return await TelegramAPI.editMessageText(chatId, messageId, text, options);
  } catch (error) {
    Logger.log(`Failed to edit message ${messageId}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Handle robot/AI query with simplified agent toolkit
 * @param {string} chatId - Chat ID
 * @param {string} user_query - User's question
 * @param {string} personality - Optional personality 
 * @param {number} request_message_id - Message ID to reply to
 */
export async function handleRobotQuery(chatId, user_query, personality = '', request_message_id = null) {
  // Validate inputs
  if (!chatId || !user_query) {
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
    // Send initial processing message
    fetchingMessage = await TelegramAPI.sendMessage(
      chatId,
      'Processing your question...',
      { reply_to_message_id: request_message_id }
    );

    // Get recent conversation context
    const messages = await getMessagesFromLastNhours(chatId, 24);
    const conversation = JSON.stringify(messages);

    // Get agent configuration
    const tools = getAgentTools();
    Logger.log(`Loaded ${tools.length} tools: ${tools.map(t => t.function.name).join(', ')}`);
    const { MAX_LOOPS, MAX_TOOL_USAGE, DEFAULT_TOOL_COUNTS } = TOOL_USAGE_CONFIG;
    const toolUsageCount = { ...DEFAULT_TOOL_COUNTS };

    // Main agent loop
    while (!finalResponse && !messagesSent && loopCount < MAX_LOOPS) {
      // Check for cancellation
      if (isCancellationRequested(chatId)) {
        Logger.log(`Cancellation detected for chat ${chatId}, stopping tool loop`);
        clearCancellationRequest(chatId);
        await safeEditMessage(chatId, fetchingMessage?.message_id, '🛑 Operation cancelled by user request.');
        return;
      }
            
      loopCount++;
      Logger.log(`Agent loop iteration ${loopCount}`);

      try {
        // Log the tools being passed to OpenAI for debugging
        Logger.log(`Calling OpenAI with ${tools.length} tools, model: ${CONFIG.GPT_MODEL}`);
        
        // Validate tools array structure
        const isValidTools = Array.isArray(tools) && tools.every(tool => 
          tool && tool.type === 'function' && tool.function && tool.function.name
        );
        Logger.log(`Tools validation: ${isValidTools}`);
        
        if (!isValidTools) {
          throw new Error('Invalid tools array structure');
        }
        
        // Call OpenAI API with tools
        const response = await openai.chat.completions.create({
          model: CONFIG.GPT_MODEL,
          messages: [
            {
              role: 'system',
              content: getAgentSystemPrompt(personality)
            },
            {
              role: 'user',
              content: `Question: ${user_query}\n\nRecent conversation context:\n${conversation}\n\nAccumulated research context:\n${accumulatedContext}`
            }
          ],
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 3000
        });

        const responseMessage = response.choices[0].message;

        // Check if a tool call was made
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          const toolCall = responseMessage.tool_calls[0];
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          Logger.log(`Tool selected: ${functionName}`);
                
          // Check tool usage limits
          if (toolUsageCount[functionName] !== undefined) {
            if (toolUsageCount[functionName] >= MAX_TOOL_USAGE) {
              Logger.log(`Tool ${functionName} usage limit (${MAX_TOOL_USAGE}) reached, forcing final response`);
              accumulatedContext += `\n[Note: Reached usage limit for ${functionName} tool - proceeding with available information]\n`;
              break;
            }
            toolUsageCount[functionName]++;
            Logger.log(`Tool ${functionName} usage count: ${toolUsageCount[functionName]}/${MAX_TOOL_USAGE}`);
          }

          // Update user with current operation
          const operationDescription = getToolExecutionDescription(functionName, functionArgs);
          await safeEditMessage(chatId, fetchingMessage?.message_id, operationDescription);

          try {
            // Execute the tool using the agent executor
            const toolResult = await executeAgentTool(functionName, functionArgs, chatId);
            
            // Check if this is a send_messages response (messages already sent)
            if (toolResult && typeof toolResult === 'object' && toolResult.__MESSAGES_SENT__) {
              Logger.log(`Messages already sent (${toolResult.count}), ending loop`);
              messagesSent = true;
              break; // End the loop immediately - no need to send again
            }
            
            // Add result to accumulated context
            accumulatedContext += `\n${functionName} result:\n${toolResult}\n`;
            Logger.log(`Tool ${functionName} completed successfully`);
            
          } catch (error) {
            Logger.log(`Tool ${functionName} error: ${error.message}`, 'error');
            accumulatedContext += `\n${functionName} failed: ${error.message}\n`;
          }

        } else if (responseMessage.content) {
          // AI provided final response
          finalResponse = responseMessage.content;
          Logger.log('AI provided final response');
        } else {
          Logger.log('Unexpected response format from OpenAI', 'warn');
          break;
        }

      } catch (apiError) {
        Logger.log(`OpenAI API error: ${apiError.message}`, 'error');
        Logger.log(`Error stack: ${apiError.stack}`, 'error');
        Logger.log(`Error name: ${apiError.name}`, 'error');
        Logger.log(`Full error object:`, apiError);
        await safeEditMessage(chatId, fetchingMessage?.message_id, 
          'Sorry, I encountered an error while processing your request. Please try again.');
        return;
      }
    }

    // Handle final response or timeout
    if (finalResponse && !messagesSent) {
      await sendFinalMessages(chatId, finalResponse, fetchingMessage, request_message_id);
      messagesSent = true;
    } else if (!messagesSent) {
      Logger.log(`Maximum loops (${MAX_LOOPS}) reached without final response`);
      await safeEditMessage(chatId, fetchingMessage?.message_id, 
        'I was unable to complete your request within the time limit. Please try a simpler question.');
    }

    // Save interaction to message history
    await saveUserMessage(chatId, user_query, 'user');
    if (finalResponse) {
      await saveBotMessage(chatId, finalResponse, 'assistant');
    }

  } catch (error) {
    Logger.log(`Error in handleRobotQuery: ${error.message}`, 'error');
    Logger.log(error.stack, 'error');
    
    try {
      await safeEditMessage(chatId, fetchingMessage?.message_id, 
        'Sorry, I encountered an unexpected error. Please try again later.');
    } catch (editError) {
      Logger.log(`Failed to send error message: ${editError.message}`, 'error');
    }
  }
}

/**
 * Send final messages - accepts string or array of messages with staggered delivery
 */
async function sendFinalMessages(chatId, messages, fetchingMessage, replyToMessageId) {
  try {
    // Convert single string to array and split if needed
    let messageArray;
    if (Array.isArray(messages)) {
      // Already an array - split any long messages
      messageArray = messages.flatMap(msg => splitResponse(msg));
    } else {
      // Single string - split if needed
      messageArray = splitResponse(messages);
    }
    
    // Enforce 4 message limit for messaging platform UX
    if (messageArray.length > 4) {
      Logger.log(`Warning: ${messageArray.length} messages exceeds limit, truncating to 4`);
      messageArray = messageArray.slice(0, 4);
    }
    
    Logger.log(`Sending ${messageArray.length} response messages`);

    for (let i = 0; i < messageArray.length; i++) {
      const message = messageArray[i];
      
      if (i === 0 && fetchingMessage) {
        // Edit the first message
        await safeEditMessage(chatId, fetchingMessage.message_id, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        });
      } else {
        // Send additional messages with staggered timing
        await TelegramAPI.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_to_message_id: replyToMessageId,
          disable_web_page_preview: false
        });
      }
      
      // Stagger messages with increasing delay for natural conversation feel
      if (i < messageArray.length - 1) {
        const delay = Math.min(500 + (i * 200), 2000); // 500ms to 2s max
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

  } catch (error) {
    Logger.log(`Error sending final messages: ${error.message}`, 'error');
    
    // Fallback: send plain text without formatting
    try {
      const fallbackMessage = Array.isArray(messages) ? messages.join(' ') : messages;
      const plainResponse = fallbackMessage.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove markdown links
      await safeEditMessage(chatId, fetchingMessage?.message_id, plainResponse);
    } catch (fallbackError) {
      Logger.log(`Fallback response failed: ${fallbackError.message}`, 'error');
    }
  }
}

/**
 * Split long responses into multiple messages
 */
function splitResponse(response) {
  const maxLength = 4000; // Leave room for markdown formatting
  
  if (response.length <= maxLength) {
    return [response];
  }
  
  const messages = [];
  let currentMessage = '';
  const lines = response.split('\n');
  
  for (const line of lines) {
    if (currentMessage.length + line.length + 1 > maxLength) {
      if (currentMessage) {
        messages.push(currentMessage.trim());
        currentMessage = line;
      } else {
        // Single line is too long, split it
        messages.push(line.substring(0, maxLength));
        currentMessage = line.substring(maxLength);
      }
    } else {
      currentMessage += (currentMessage ? '\n' : '') + line;
    }
  }
  
  if (currentMessage) {
    messages.push(currentMessage.trim());
  }
  
  return messages;
}

/**
 * Handle help command
 */
export async function handleHelpCommand(chatId) {
  const helpText = `🤖 **Everything Bot Help**

**Basic Usage:**
• Start messages with \`robot\` or \`x-bot\` to ask questions
• I can search the web, analyze images, do math, and much more!

**Examples:**
• \`robot what's the weather like?\`
• \`x-bot analyze the image I just sent\`
• \`robot calculate 15% tip on $87.50\`
• \`x-bot summarize our chat from yesterday\`

**Features:**
🔍 **Search** - Web, news, Reddit, images, videos, places
💬 **Chat Memory** - Remember conversations and find old messages  
🖼️ **Image Analysis** - OCR text extraction, visual analysis
🔢 **Calculations** - Math, statistics, data analysis
📊 **Data Processing** - Summarization, filtering, analysis

**Personalities:**
Add personality hints like:
• \`robot as a scientist, explain quantum computing\`
• \`x-bot as a chef, what's a good pasta recipe?\`

The bot remembers context and can reference previous conversations. Just ask naturally!`;

  await TelegramAPI.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

/**
 * Handle unknown commands
 */
export async function handleUnknownCommand(chatId, command) {
  await TelegramAPI.sendMessage(chatId, 
    `Unknown command: ${command}\n\nUse /help to see available commands or start your message with 'robot' or 'x-bot' to ask questions.`
  );
}

/**
 * Handle incoming messages and route to appropriate handlers
 * @param {string|number} chatId - The chat ID
 * @param {string} text - The message text
 * @param {object} message - The complete message object
 */
export async function handleMessage(chatId, text, message) {
  // Ignore messages from bots (including our own bot)
  if (message.from && message.from.is_bot) {
    Logger.log(`Ignoring message from bot: ${message.from.first_name || 'Unknown'}`);
    return;
  }
    
  if (text.startsWith('/help')) {
    await handleHelpCommand(chatId);
  } else if (text.startsWith('/cancel')) {
    requestCancellation(chatId);
    await TelegramAPI.sendMessage(chatId, '🛑 Cancellation requested. The bot will stop processing after the current operation.', { 
      reply_to_message_id: message.message_id 
    });
  } else if (text.toLowerCase().startsWith('robot,') || text.toLowerCase().startsWith('robot ')) {
    const query = text.slice(text.indexOf(' ')).trim();
    await handleRobotQuery(chatId, query, '', message.message_id);
  } else if (text.match(/\w+[\s]*-[\s]*bot/i)) {
    // Handle personality-based bot queries: "scientist-bot", "chef -bot", "detective- bot", "anything - bot", etc.
    const match = text.match(/(.+?)[\s]*-[\s]*bot[\s,]*/i);
    if (match) {
      const personality = match[1].toLowerCase().trim();
      const query = text.replace(/(.+?)[\s]*-[\s]*bot[\s,]*/i, '').trim();
      await handleRobotQuery(chatId, query, personality, message.message_id);
    }
  } else {
    // Save regular user messages for context
    await saveUserMessage(chatId, message);
  }
}

/**
 * Handle when the bot is added to a new chat
 * @param {string|number} chatId - The chat ID
 * @param {Object} chat - The chat object with details about the group
 */
export async function handleBotAddedToChat(chatId, chat) {
  try {
    Logger.log(`Sending introduction message to chat ${chatId} (${chat.title || 'Unknown'})`);
    
    const introMessage = `👋 Hello everyone! I'm @LetMeCheckThatBot, your intelligent AI assistant.

🔍 **What I can do:**
• Search the web, news, Reddit, images, and videos
• Analyze chat history and find specific messages
• Process images with OCR and visual analysis
• Perform calculations and data analysis
• Provide summaries and insights

🗣️ **How to use me:**
• Start messages with "robot," or "robot " to ask questions
• Use personality modes like "conspiracy-bot," or "scientist-bot,"
• Send /help for detailed usage instructions

🎯 **Examples:**
• "robot, what's the latest news on AI?"
• "conservative-bot, what are the benefits of renewable energy?"
• "robot analyze the images I shared yesterday"
• "robot calculate 15% tip on $87.50"

Ready to help with factual, evidence-based responses! 🤖`;

    await TelegramAPI.sendMessage(chatId, introMessage);
    Logger.log(`Introduction sent successfully to chat ${chatId}`);
  } catch (error) {
    Logger.log(`Error sending introduction to chat ${chatId}: ${error.message}`, 'error');
  }
}
