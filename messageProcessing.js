const moment = require('moment');
const { Configuration, OpenAIApi } = require('openai');
const { Logger } = require('./logger');
const { CONFIG } = require('./config');
const { S3Manager } = require('./S3Manager');
const { TelegramAPI } = require('./telegramAPI');
const axios =  require('axios');

const openai = new OpenAIApi(new Configuration({ apiKey: CONFIG.OPENAI_API_KEY }));

// Save bot message to S3
async function saveBotMessage(chatId, messageData) {
    const date = moment().format('YYYY-MM-DD');
    const key = `fact_checker_bot/groups/${chatId}.json`;
    const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
    existingData.messages.push({
        isBot: true,
        message_from:'Robot',
        messageId: messageData.message_id,
        message_text: messageData.text,
        timestamp: {
            unix: Date.now(),
            friendly: new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            })
        },
    });
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, existingData);
}

// Get recent messages
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

// Get messages from the last 24 hours
async function getMessagesFromLast24Hours(chatId) {
    try {
        const key = `fact_checker_bot/groups/${chatId}.json`;
        const cutoffTime = moment().subtract(24, 'hours').valueOf();
        
        Logger.log(`Fetching messages for chat ${chatId} from the last 24 hours`);
        
        const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
        
        // Filter messages from the last 24 hours using the new timestamp structure
        const recentMessages = (data?.messages ?? []).filter(msg => {
            return msg.timestamp?.unix >= cutoffTime;
        });
        
        Logger.log(`Found ${recentMessages.length} messages within the time range`);
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

// Fact-check messages
async function addContextToMessages(chatId, messages, request_message_id) {
    if (!chatId || !messages || !Array.isArray(messages)) {
        Logger.log('Invalid input parameters for addContextToMessages', 'error');
        return;
    }

    if (!messages.length) {
        const sentMessage = await TelegramAPI.sendMessage(chatId, 'No messages to fact-check.');
        await saveBotMessage(chatId, sentMessage);
        return;
    }

    let fetchingMessage;
    try {
        fetchingMessage = await TelegramAPI.sendMessage(
            chatId,
            `On it. getting context..`,
            { reply_to_message_id: request_message_id }
        );

        const conversation = JSON.stringify(messages);
        const searchQuery = await extractSearchQuery(conversation);
        if (!searchQuery) {
            throw new Error('Failed to extract search query from conversation');
        }

        const webSearchResults = await performDuckDuckGoSearch(searchQuery);
        if (!webSearchResults) {
            throw new Error('No search results found');
        }

        const response = await openai.createChatCompletion({
            model: CONFIG.GPT_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `embody Jamie Vernon, assistant to Joe Rogan on the JRE podcast but more concise! 
                        Your task is to provide expert context and analysis:
                        • Focus on the most recent or prominent topic only
                        • Only use highly credible sources such as:
                          - Reuters, Associated Press (AP)
                          - BBC News, The Wall Street Journal
                          - Academic journals and peer-reviewed research
                          - Government databases and official statistics
                          - The Free Press
                        • Avoid sources with known political bias or sensationalist content
                        • Include relevant statistics or research when available
                        • Add links to authoritative sources when appropriate
                        • Be objective and evidence-based
                        • Format response with bullet points for readability
                        • Use emojis strategically for emphasis
                        • Keep responses concise and telegram-friendly
                        • Cite sources clearly but briefly
                        Remember: Be direct, factual, and engaging without being verbose.`
                },
                { role: 'user', content: `past 24 hours of messages in the groupchat:\n${conversation}\n\nWeb Search Results:\n${webSearchResults}` },
            ],
            temperature: 0.7,
            max_tokens: CONFIG.MAX_TOKENS,
        });

        if (!response?.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from OpenAI');
        }

        const report = response.data.choices[0].message.content;
        if (fetchingMessage?.message_id) {
            await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id);
        }

        const sentMessage = await TelegramAPI.sendMessage(chatId, `Context:\n${report}`);
        await saveBotMessage(chatId, sentMessage);
    } catch (error) {
        Logger.log(`Context analysis failed: ${error.message}`, 'error');
        if (fetchingMessage?.message_id) {
            await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id).catch(err => 
                Logger.log(`Failed to delete fetching message: ${err.message}`, 'error')
            );
        }
        const errorMessage = 'Unable to analyze context at this time. Please try again later.';
        const sentMessage = await TelegramAPI.sendMessage(chatId, errorMessage);
        await saveBotMessage(chatId, sentMessage);
    }
}


async function extractSearchQuery(conversation) {
    const functions = [
        {
            name: "extract_search_query",
            description: "Extract a focused, relevant search query from the conversation that captures the key claims, facts, or topics being discussed. Prioritize recent, verifiable claims and specific facts over opinions or general discussion.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "A precise search query optimized for fact-checking and verification from trusted sources"
                    }
                },
                required: ["query"]
            }
        }
    ];

    const response = await openai.createChatCompletion({
        model: CONFIG.GPT_MODEL,
        messages: [
            { 
                role: "system", 
                content: `As a precise query extractor, I create focused search queries that:
                    1. Target highly credible sources:
                       - Reuters and Associated Press
                       - BBC News and Wall Street Journal
                       - Academic journals and research papers
                       - Government databases and statistics
                       - The Free Press
                    2. Exclude potentially biased or unreliable sources
                    3. Focus on the most recent or prominent factual claim
                    4. Prioritize verifiable statements over opinions
                    5. Include relevant dates, numbers, or specific details
                    6. Use quotes for exact phrases when appropriate
                    Format queries to find authoritative, fact-based sources.`
            },
            { 
                role: "user", 
                content: `Extract a focused search query from this conversation that will help verify the key claims being discussed: "${conversation}"` 
            }
        ],
        functions: functions,
        function_call: { name: "extract_search_query" }
    });

    const functionCall = response.data.choices[0].message.function_call;
    const extractedQuery = JSON.parse(functionCall.arguments).query;
    console.log(`Searching: ${extractedQuery}`)
    return extractedQuery;
}


async function performDuckDuckGoSearch(query) {
    const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://google.serper.dev/search?q=${encodeURIComponent(query)}&apiKey=06e3dc92178b41f85750ef66bb59e9d91e453fb6`,
        headers: {}
    };

    try {
        Logger.log(`Performing Google search for query: "${query}"`);

        const response = await axios.request(config);
        const data = response.data;

        // Prepare response string
        let resultSummary = '';

        // Knowledge Graph
        if (data.knowledgeGraph) {
            const kg = data.knowledgeGraph;
            resultSummary += `💡 *Knowledge Graph*\n`;
            resultSummary += `- **Title:** ${kg.title}\n`;
            resultSummary += `- **Type:** ${kg.type}\n`;
            resultSummary += `- **Description:** ${kg.description}\n`;
            resultSummary += `- **Source:** [${kg.descriptionSource}](${kg.descriptionLink})\n\n`;
        }

        // Organic Results
        if (data.organic && data.organic.length > 0) {
            resultSummary += `🌐 *Top Organic Results*\n`;
            data.organic.slice(0, 10).forEach((result, index) => {
                resultSummary += `${index + 1}. **${result.title}**\n   ${result.link}\n   _${result.snippet}_\n`;
            });
            resultSummary += '\n';
        }

        // People Also Ask
        if (data.peopleAlsoAsk && data.peopleAlsoAsk.length > 0) {
            resultSummary += `🤔 *People Also Ask*\n`;
            data.peopleAlsoAsk.slice(0, 5).forEach((question, index) => {
                resultSummary += `${index + 1}. **${question.question}**\n   _${question.snippet}_\n   [Read More](${question.link})\n`;
            });
            resultSummary += '\n';
        }

        // Related Searches
        if (data.relatedSearches && data.relatedSearches.length > 0) {
            resultSummary += `🔍 *Related Searches*\n`;
            resultSummary += data.relatedSearches.slice(0, 5).map(rs => `- ${rs.query}`).join('\n');
        }

        return resultSummary || 'No relevant context found from Google.';
    } catch (error) {
        Logger.log(`Google search failed: ${error.message}`, 'error');
        return 'Failed to retrieve context from Google.';
    }
}

// Delete bot messages
async function deleteMessages(chatId, messageIds) {
    for (const messageId of messageIds) {
        try {
            await TelegramAPI.deleteMessage(chatId, messageId);
            Logger.log(`Deleted message with ID ${messageId} in chat ${chatId}`);
        } catch (error) {
            Logger.log(`Failed to delete message ${messageId}: ${error.message}`, 'error');
        }
    }
}

async function analyzeDebate(chatId, messages, request_message_id) {
    if (!messages.length) {
        const sentMessage = await TelegramAPI.sendMessage(chatId, 'No debate messages to analyze.');
        await saveBotMessage(chatId, sentMessage);
        return;
    }

    const fetchingMessage = await TelegramAPI.sendMessage(
        chatId,
        `Analyzing the debate...`,
        {
            reply_to_message_id: request_message_id,
        }
    );

    const conversation = JSON.stringify(messages);
    try {
        const searchQuery = await extractSearchQuery(conversation);
        const webSearchResults = await performDuckDuckGoSearch(searchQuery);

        const response = await openai.createChatCompletion({
            model: CONFIG.GPT_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `I am an expert debate judge with years of experience analyzing arguments and discussions. 
                        When I analyze conversations, I look for:
                        1. Quality of arguments (logic, reasoning)
                        2. Use of evidence and facts
                        3. Effectiveness of rebuttals
                        4. Clarity and persuasiveness

                        I carefully review the web search results to validate claims. 
                        I identify the main participants and their key arguments.
                        
                        I provide my verdict in this format:
                        🎯 TOPIC: [main debate topic]
                        🏆 WINNER: [winner's name] (or "Tie" if applicable with confidence score of who won)
                        📊 REASON: [brief explanation of my decision]
                        🔑 KEY POINTS: [2-3 bullet points of strongest arguments]
                        
                        I keep my analysis concise and clear for Telegram.
                        I use emojis sparingly for readability.
                        I include relevant facts from my research to support my verdict. 
                        I share my thoughts on the participants and their arguments.`,
                },
                { role: 'user', content: `past 24 hours of messages in the groupchat:\n${conversation}\n\nWeb Search Results:\n${webSearchResults}` },
            ],
            temperature: 0.9,
            max_tokens: CONFIG.MAX_TOKENS,
        });

        const verdict = response.data.choices[0].message.content;
        await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id);
        const sentMessage = await TelegramAPI.sendMessage(chatId, `Debate Analysis:\n${verdict}`);
        await saveBotMessage(chatId, sentMessage);
    } catch (error) {
        Logger.log(`Debate analysis failed: ${error.message}`, 'error');
        const sentMessage = await TelegramAPI.sendMessage(chatId, 'Unable to analyze the debate at this time.');
        await saveBotMessage(chatId, sentMessage);
    }
}

async function handleRobotQuery(chatId, query, request_message_id) {
    if (!chatId || !query) {
        Logger.log('Invalid input parameters for handleRobotQuery', 'error');
        return;
    }

    let fetchingMessage;
    try {
        fetchingMessage = await TelegramAPI.sendMessage(
            chatId,
            `Processing your question...`,
            { reply_to_message_id: request_message_id }
        );

        const messages = await getMessagesFromLast24Hours(chatId);
        const conversation = JSON.stringify(messages);
        const webSearchResults = await performDuckDuckGoSearch(query);

        const response = await openai.createChatCompletion({
            model: CONFIG.GPT_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You are a direct messaging assistant in a group chat for guy friends. Keep responses short and mobile-friendly:
                        • Answer in 2-3 short sentences max
                        • Use plain language
                        • Include only essential facts
                        • No formatting - just plain text
                        • If listing items, use simple dashes
                         add brief source links at the end
                         add a little sass to the responses if appropriate
                        Remember: Think "text message" length and style.`
                },
                { role: 'user', content: `Question: "${query}"

past 24 hours of messages in the groupchat:
${conversation}

Web Search Results:
${webSearchResults}` }
            ],
            temperature: 0.85,
            max_tokens: CONFIG.MAX_TOKENS
        });

        if (!response?.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from OpenAI');
        }

        const answer = response.data.choices[0].message.content;
        if (fetchingMessage?.message_id) {
            await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id);
        }

        const sentMessage = await TelegramAPI.sendMessage(chatId, answer);
        await saveBotMessage(chatId, sentMessage);
    } catch (error) {
        Logger.log(`Robot query processing failed: ${error.message}`, 'error');
        if (fetchingMessage?.message_id) {
            await TelegramAPI.deleteMessage(chatId, fetchingMessage.message_id).catch(err => 
                Logger.log(`Failed to delete fetching message: ${err.message}`, 'error')
            );
        }
        const errorMessage = 'Sorry, I was unable to process your question at this time. Please try again later.';
        const sentMessage = await TelegramAPI.sendMessage(chatId, errorMessage);
        await saveBotMessage(chatId, sentMessage);
    }
}

module.exports = {
    saveBotMessage,
    getRecentMessages,
    deleteMessages,
    getMessagesFromLast24Hours,
    addContextToMessages,
    analyzeDebate,
    handleRobotQuery
};