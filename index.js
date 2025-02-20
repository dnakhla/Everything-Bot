const { Logger } = require('./logger');
const { CONFIG } = require('./config');
const { S3Manager } = require('./S3Manager');
const moment = require('moment');
const {
    handleClearCommand,
    handleAddContextCommand,
    handleSettleCommand,
    handleRobotQuery
} = require('./commandHandlers');

exports.handler = async (event) => {
    try {
        Logger.log(`Received event: ${JSON.stringify(event)}`);

        const body = parseRequestBody(event);
        Logger.log(`Parsed body: ${JSON.stringify(body)}`);

        if (!body.message) {
            Logger.log('No message found in the incoming event.', 'error');
            return createResponse(200, { status: 'No action taken' });
        }

        const chatId = body.message.chat.id;
        const text = body.message.text || '';
        Logger.log(`Received message from chat ID ${chatId}: ${text}`);

        await handleMessage(chatId, text, body.message);

        return createResponse(200, { status: 'Success' });
    } catch (error) {
        Logger.log(`Lambda handler error: ${error.message}`, 'error');
        return createResponse(500, { status: 'Error', message: error.message });
    }
};

// Helper function to parse the request body
function parseRequestBody(event) {
    if (event.body) {
        return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }
    return event;
}

// Helper function to create an HTTP response
function createResponse(statusCode, body) {
    return {
        statusCode,
        body: JSON.stringify(body),
    };
}

// Main function to handle incoming messages
async function handleMessage(chatId, text, message) {
    if (text.startsWith('/clearmessages')) {
        await handleClearCommand(chatId, message.message_id);
    } else if (text.startsWith('/addcontext')) {
        await handleAddContextCommand(chatId, message.message_id);
    } else if (text.startsWith('/settlethis')) {
        await handleSettleCommand(chatId, message.message_id);
    } else if (text.toLowerCase().startsWith('robot,')) {
        const query = text.slice(6).trim(); // Remove 'robot,' and trim whitespace
        await handleRobotQuery(chatId, query, message.message_id);
    } else {
        await saveUserMessage(chatId, message);
    }
}

// Function to save a user's message to S3
async function saveUserMessage(chatId, message) {
    const senderName = message.from.first_name || 'A ROBOT';
    const userMessage = {
        message_from: senderName,
        message_text: message.text,
        messageId: message.message_id,
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
        isBot: false, // Indicate that this is a user message
    };

    const date = moment().format('YYYY-MM-DD');
    const key = `fact_checker_bot/groups/${chatId}.json`;

    try {
        const existingData =
            (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
        existingData.messages.push(userMessage);

        await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, existingData);
        Logger.log(`Message saved to S3 for chat ID ${chatId}`);
    } catch (error) {
        Logger.log(`Error saving message to S3: ${error.message}`, 'error');
        throw error;
    }
}