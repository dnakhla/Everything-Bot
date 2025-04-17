const { TelegramAPI } = require('./telegramAPI');
const { Logger } = require('./logger');
const { CONFIG } = require('./config');
const { S3Manager } = require('./S3Manager');
const moment = require('moment');



// Handle /clear command
async function handleClearCommand(chatId, request_message_id) {
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



module.exports = {
    handleClearCommand,
    handleRobotQuery
};

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


async function handleRobotQuery(chatId, query, request_message_id) {
    if (!chatId || !query) {
        Logger.log('Invalid input parameters for handleRobotQuery', 'error');
        return;
    }

    try {
        const messages = await getRecentMessages(chatId, 5);
        const conversation = JSON.stringify(messages);

        const response = await openai.createChatCompletion({
            model: CONFIG.GPT_MODEL,
            messages: [{
                role: 'system',
                content: `You are a direct messaging assistant in a group chat for guy friends. Keep responses short and mobile-friendly:\n• Answer in 2-3 short sentences max\n• Use plain language\n• Include only essential facts\n• No formatting - just plain text\n• If listing items, use simple dashes\nadd brief source links at the end\nadd a little sass to the responses if appropriate\nRemember: Think "text message" length and style.`
            }, {
                role: 'user',
                content: `Question: "${query}"\n\nRecent messages in the groupchat:\n${conversation}`
            }],
            temperature: 0.85,
            max_tokens: CONFIG.MAX_TOKENS
        });

        const answer = response.data.choices[0].message.content;
        await TelegramAPI.sendMessage(
            chatId,
            answer, {
            reply_to_message_id: request_message_id
        });
    } catch (error) {
        Logger.log(`Robot query processing failed: ${error.message}`, 'error');
        await TelegramAPI.sendMessage(
            chatId,
            'Sorry, I was unable to process your question at this time. Please try again later.', {
            reply_to_message_id: request_message_id
        });
    }
}