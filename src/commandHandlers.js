import { OpenAI } from 'openai';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from '../services/s3Manager.js';
import { TelegramAPI } from '../services/telegramAPI.js';
import {
    saveBotMessage,
    getMessagesFromLastNhours,
    performGoogleSearch,
    performBraveSearch,
    fetchUrlContent
} from '../services/messageService.js';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: CONFIG.OPENAI_API_KEY,
});

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
        // Get existing messages
        const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };

        // Filter bot messages and delete them
        const botMessages = existingData.messages.filter((msg) => msg.isBot && msg.messageId);
        const deletePromises = botMessages.map(msg =>
            TelegramAPI.deleteMessage(chatId, msg.messageId)
                .catch(error => Logger.log(`Failed to delete message ${msg.messageId}: ${error.message}`, 'error'))
        );

        await Promise.allSettled(deletePromises);

        // Clear stored messages
        await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, { messages: [] });

        // Send confirmation message and delete it immediately
        const confirmMessageData = await TelegramAPI.sendMessage(chatId, 'Chat history cleared and bot messages deleted.');
        await TelegramAPI.deleteMessage(chatId, confirmMessageData.message_id);
        Logger.log(`Cleared chat history for chat ID ${chatId}`);
    } catch (error) {
        Logger.log(`Error in handleClearCommand: ${error.message}`, 'error');
        throw error;
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
 * Handle a query to the Robot
 * 
 * @param {string|number} chatId - The chat ID
 * @param {string} query - The user's query text
 * @param {string|number} request_message_id - The message ID of the request
 * @returns {Promise<void>}
 */
export async function handleRobotQuery(chatId, query, request_message_id) {
    if (!chatId || !query) {
        Logger.log('Invalid input parameters for handleRobotQuery', 'error');
        return;
    }

    let fetchingMessage;
    try {
        fetchingMessage = await TelegramAPI.sendMessage(
            chatId,
            'Processing your question...',
            { reply_to_message_id: request_message_id }
        );

        const messages = await getMessagesFromLastNhours(chatId, 24);
        const conversation = JSON.stringify(messages);

        // Initialize accumulated context
        let accumulatedContext = '';
        let finalResponse = null;
        let loopCount = 0;
        const MAX_LOOPS = 8; // Safety limit to prevent infinite loops

        // Define available tools for the AI
        const tools = [
            {
                type: "function",
                function: {
                    name: "search_web",
                    description: "Search the web for information to answer the user's query",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Search query to find information on the web"
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_message_history",
                    description: "Retrieve messages from the chat history within a specified time period",
                    parameters: {
                        type: "object",
                        properties: {
                            hours: {
                                type: "integer",
                                description: "Number of hours to look back for messages"
                            }
                        },
                        required: ["hours"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_url_content",
                    description: "Retrieve content from a specific URL",
                    parameters: {
                        type: "object",
                        properties: {
                            url: {
                                type: "string",
                                description: "URL to fetch content from"
                            }
                        },
                        required: ["url"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "respond_to_user",
                    description: "Send a final response to the user's query",
                    parameters: {
                        type: "object",
                        properties: {
                            answer: {
                                type: "string",
                                description: "Final answer to send to the user"
                            }
                        },
                        required: ["answer"]
                    }
                }
            }
        ];

        while (!finalResponse && loopCount < MAX_LOOPS) {
            loopCount++;
            Logger.log(`Tool selection loop iteration ${loopCount}`);

            // Call OpenAI API with tools
            const response = await openai.chat.completions.create({
                model: CONFIG.GPT_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful assistant in a Telegram group chat. Your goal is to answer user queries accurately and concisely based on the provided conversation history and web search results. 
                        Use the available tools to gather information or respond. 
                        1. Use 'search_web' to find current information if the history is insufficient.
                        2. Use 'get_message_history' to access past messages if needed.
                        3. Use 'get_url_content' to fetch details from a specific webpage.
                        4. Use 'respond_to_user' to provide the final answer.
                        Keep your responses brief and directly address the user's question. 
                        If a link directly supports your answer or fulfills the user's request (e.g., they asked for a link), include it in your final response using Markdown format [link text](URL). Only include a link if it adds significant value and is directly relevant.
                        Accumulated context from previous tool calls: ${accumulatedContext}`
                    },
                    {
                        role: "user",
                        content: `Conversation History (last 24 hours): ${conversation}\n\nUser Query: ${query}`
                    }
                ],
                tools: tools,
                tool_choice: "auto",
            });

            const responseMessage = response.choices[0].message;

            // Check if a tool call was made
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                const toolCall = responseMessage.tool_calls[0];
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                Logger.log(`Tool selected: ${functionName}`);

                // Handle different tool calls
                if (functionName === 'search_web') {
                    const searchQuery = functionArgs.query;
                    Logger.log(`Performing web search for: ${searchQuery}`);
                    
                    // Update fetchingMessage with current operation
                    if (fetchingMessage?.message_id) {
                        await TelegramAPI.editMessageText(
                            chatId,
                            fetchingMessage.message_id,
                            `Searching the web for: "${searchQuery}"...`
                        );
                    }

                    try {
                        // Execute the search
                        const googleResults = await performGoogleSearch(searchQuery);
                        const braveResults = await performBraveSearch(searchQuery);

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
                    if (fetchingMessage?.message_id) {
                        await TelegramAPI.editMessageText(
                            chatId,
                            fetchingMessage.message_id,
                            `Retrieving message history from the last ${hours} hours...`
                        );
                    }

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
                else if (functionName === 'get_url_content') {
                    const url = functionArgs.url;
                    Logger.log(`URL content requested for: ${url}`);
                    
                    // Update fetchingMessage with current operation
                    if (fetchingMessage?.message_id) {
                        await TelegramAPI.editMessageText(
                            chatId,
                            fetchingMessage.message_id,
                            `Fetching content from: ${url}...`
                        );
                    }

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
                else if (functionName === 'respond_to_user') {
                    // Final response selected
                    finalResponse = functionArgs.answer;
                    Logger.log('Final response generated');
                    
                    // Update fetchingMessage to indicate we're preparing the final response
                    if (fetchingMessage?.message_id) {
                        await TelegramAPI.editMessageText(
                            chatId,
                            fetchingMessage.message_id,
                            'Preparing your answer...'
                        );
                    }
                }
            } else {
                // If no tool was selected but there's content, use it as the final response
                if (responseMessage.content) {
                    finalResponse = responseMessage.content;
                    Logger.log('Response generated without tool selection');
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
                        content: `You are Robot, a knowledgeable and slightly sassy AI assistant in a friends' group chat of men born in the 80s and 90s. Your responses MUST be:
                          • Brief and mobile-friendly (2-8 concise sentences)
                          • Conversational and natural, as if texting a friend
                          • Fact-focused with personality (add appropriate humor men in their 30s-40s would appreciate)
                          • Plain text only (no bold, italics, or markdown)
                          • Specific to the question asked (don't ramble)
                          
                          When answering:
                          • IMPORTANT: ALWAYS search the web for factual information before answering any question
                          • Focus heavily on recent group context and conversations (past ~6 hours are most relevant)
                          • Fact-check claims and provide balanced perspectives with a slight lean toward traditional values
                          • Include source links ONLY when: 1) specifically asked, 2) for controversial claims, or 3) when sharing data/stats
                          • When including links: use full URLs (e.g., "Check this out: https://example.com/page") never hide URLs behind text
                          • Keep links at the end of sentences or paragraphs for better readability
                          • Use casual but mature language that resonates with men in their 30s-40s
                          • If you need more conversational context, use your tools to get it rather than saying you lack context
                          • If listing items, use simple dashes, not numbering or bullets
                          
                          Tool usage:
                          • ALWAYS use search_web for ANY factual questions, even if you think you know the answer
                          • Proactively search for verification of claims before responding
                          • Use get_message_history when you need deeper conversation history
                          • Use get_url_content for specific URLs mentioned
                          • Always use respond_to_user for your final answer`
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

        // Update fetchingMessage with the final response instead of deleting it
        let sentMessage;
        if (fetchingMessage?.message_id) {
            sentMessage = await TelegramAPI.editMessageText(chatId, fetchingMessage.message_id, finalResponse);
        } else {
            // Fallback in case fetchingMessage wasn't created properly
            sentMessage = await TelegramAPI.sendMessage(chatId, finalResponse);
        }
        await saveBotMessage(chatId, sentMessage);

    } catch (error) {
        Logger.log(`Robot query processing failed: ${error.message}`, 'error');
        const errorMessage = 'Sorry, I was unable to process your question at this time. Please try again later.';
        let sentMessage;
        
        if (fetchingMessage?.message_id) {
            // Update the fetchingMessage with the error message instead of deleting it
            try {
                sentMessage = await TelegramAPI.editMessageText(chatId, fetchingMessage.message_id, errorMessage);
            } catch (err) {
                Logger.log(`Failed to edit fetching message: ${err.message}`, 'error');
                // Fallback to sending a new message if edit fails
                sentMessage = await TelegramAPI.sendMessage(chatId, errorMessage);
            }
        } else {
            sentMessage = await TelegramAPI.sendMessage(chatId, errorMessage);
        }
        
        // Only save if a message was successfully sent or edited
        if (sentMessage) {
            await saveBotMessage(chatId, sentMessage);
        }
        
    }
}