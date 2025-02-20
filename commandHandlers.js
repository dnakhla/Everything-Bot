const { TelegramAPI } = require('./telegramAPI');
const { Logger } = require('./logger');
const { CONFIG } = require('./config');
const { S3Manager } = require('./S3Manager');
const moment = require('moment');
const {
    getRecentMessages,
    getMessagesFromLast24Hours,
    addContextToMessages,
    analyzeDebate,
    handleRobotQuery  // Import this
} = require('./messageProcessing');


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

async function handleAddContextCommand(chatId, request_message_id) {
    if (!chatId) {
        Logger.log('Invalid chat ID provided to handleAddContextCommand', 'error');
        return;
    }

    try {
        const messages = await getRecentMessages(chatId, 20);
        if (!messages || messages.length === 0) {
            const sentMessage = await TelegramAPI.sendMessage(chatId, 'No recent messages found to analyze.');
            return;
        }
        await addContextToMessages(chatId, messages, request_message_id);
    } catch (error) {
        Logger.log(`Error in handleAddContextCommand: ${error.message}`, 'error');
        throw error;
    }
}

async function handleSettleCommand(chatId, request_message_id) {
    if (!chatId) {
        Logger.log('Invalid chat ID provided to handleSettleCommand', 'error');
        return;
    }

    try {
        const messages = await getMessagesFromLast24Hours(chatId);
        if (!messages || messages.length === 0) {
            await TelegramAPI.sendMessage(chatId, 'No recent messages found to analyze.');
            return;
        }
        await analyzeDebate(chatId, messages, request_message_id);
    } catch (error) {
        Logger.log(`Error in handleSettleCommand: ${error.message}`, 'error');
        throw error;
    }
}

module.exports = {
    handleClearCommand,
    handleAddContextCommand,
    handleSettleCommand,
    handleRobotQuery   // Export this
};