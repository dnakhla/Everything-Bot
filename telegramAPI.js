const axios = require('axios');
const { Logger } = require('./logger');
const { CONFIG } = require('./config');

const TelegramAPI = {
    deleteMessage: async (chatId, messageId) => {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/deleteMessage`;
        try {
            await axios.post(url, {
                chat_id: chatId,
                message_id: messageId,
            });
        } catch (error) {
            Logger.log(`Failed to delete message: ${error.message}`, 'error');
            throw error;
        }
    },
    sendMessage: async (chatId, text) => {
        const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
        try {
            const response = await axios.post(url, {
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown',
            });
            Logger.log(`Message sent to chat ID ${chatId}`);
            return response.data.result; // Return the message data
        } catch (error) {
            Logger.log(`Failed to send message: ${error.message}`, 'error');
            throw error;
        }
    },
};

module.exports = { TelegramAPI };