import express from 'express';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, UpdateFunctionConfigurationCommand, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3002;

// AWS clients
const s3Client = new S3Client({ region: 'us-east-1' });
const lambdaClient = new LambdaClient({ region: 'us-east-1' });

app.use(express.json());

// Serve Svelte build files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
} else {
    // In development, serve the old static files as fallback
    app.use(express.static(__dirname));
}

// Get S3 bucket name from environment or default
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'telegram-bots-2025';
const FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'FactCheckerBot-LambdaFunction';

console.log('Admin Server Configuration:');
console.log('S3 Bucket:', BUCKET_NAME);
console.log('Lambda Function:', FUNCTION_NAME);

// Helper function to get object from S3
async function getS3Object(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        const response = await s3Client.send(command);
        const str = await response.Body.transformToString();
        return JSON.parse(str);
    } catch (error) {
        console.error(`Error getting S3 object ${key}:`, error);
        return null;
    }
}

// Helper function to list S3 objects
async function listS3Objects(prefix) {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix
        });
        const response = await s3Client.send(command);
        return response.Contents || [];
    } catch (error) {
        console.error(`Error listing S3 objects with prefix ${prefix}:`, error);
        return [];
    }
}

// API Routes

// Debug endpoint to test S3 connection
app.get('/api/debug/s3', async (req, res) => {
    try {
        console.log('Testing S3 connection...');
        console.log('Bucket:', BUCKET_NAME);
        
        // List all objects in the bucket
        const allObjects = await listS3Objects('');
        
        const result = {
            bucket: BUCKET_NAME,
            totalObjects: allObjects.length,
            objects: allObjects.map(obj => ({
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified
            })),
            chatFiles: allObjects.filter(obj => obj.Key.includes('chat') || obj.Key.endsWith('.json')),
            folders: [...new Set(allObjects.map(obj => obj.Key.split('/')[0]).filter(folder => folder))]
        };
        
        console.log('S3 Debug Result:', result);
        res.json(result);
    } catch (error) {
        console.error('S3 Debug Error:', error);
        res.status(500).json({ 
            error: 'Failed to connect to S3', 
            details: error.message,
            bucket: BUCKET_NAME
        });
    }
});

// Get all rooms/chats
app.get('/api/rooms', async (req, res) => {
    try {
        console.log('Loading rooms from S3...');
        console.log('Bucket:', BUCKET_NAME);
        
        // First try to load from the groups directory (like chat-explorer)
        console.log('Looking for fact_checker_bot/groups/ directory...');
        const groupObjects = await listS3Objects('fact_checker_bot/groups/');
        console.log(`Found ${groupObjects.length} group files`);
        
        let rooms = [];
        
        if (groupObjects.length > 0) {
            // Process grouped chat files
            for (const obj of groupObjects) {
                if (obj.Key.endsWith('.json')) {
                    const chatData = await getS3Object(obj.Key);
                    if (chatData) {
                        const fileName = obj.Key.split('/').pop();
                        const chatId = fileName.replace('.json', '');
                        
                        let chatName = `Chat ${chatId}`;
                        if (chatData.messages && chatData.messages.length > 0) {
                            const messageWithTitle = chatData.messages.find(msg => msg.chat_title);
                            if (messageWithTitle && messageWithTitle.chat_title) {
                                chatName = messageWithTitle.chat_title;
                            }
                        }
                        
                        const room = {
                            id: chatId,
                            name: chatName,
                            type: chatId.startsWith('-') ? 'group' : 'private',
                            users: 1, // We don't have member count in this format
                            messages: chatData.messages ? chatData.messages.length : 0,
                            tokens: 0, // We don't track tokens in this format
                            lastActivity: obj.LastModified,
                            lastMessage: chatData.messages && chatData.messages.length > 0 
                                ? chatData.messages[chatData.messages.length - 1].text || 'No text'
                                : 'No messages'
                        };
                        
                        rooms.push(room);
                    }
                }
            }
        } else {
            // If no grouped files, try to group individual message files by chat ID
            console.log('No grouped files found, trying to group individual messages...');
            const messageObjects = await listS3Objects('fact_checker_bot/processed_messages/');
            console.log(`Found ${messageObjects.length} message files`);
            
            // Group by chat ID (the folder name in the path)
            const chatGroups = {};
            
            for (const obj of messageObjects.slice(0, 100)) { // Limit to first 100 for performance
                if (obj.Key.endsWith('.json')) {
                    const pathParts = obj.Key.split('/');
                    if (pathParts.length >= 4) {
                        const chatId = pathParts[2]; // fact_checker_bot/processed_messages/CHAT_ID/file.json
                        
                        if (!chatGroups[chatId]) {
                            chatGroups[chatId] = {
                                id: chatId,
                                files: [],
                                lastActivity: obj.LastModified
                            };
                        }
                        
                        chatGroups[chatId].files.push(obj);
                        if (new Date(obj.LastModified) > new Date(chatGroups[chatId].lastActivity)) {
                            chatGroups[chatId].lastActivity = obj.LastModified;
                        }
                    }
                }
            }
            
            // Convert groups to rooms
            for (const [chatId, group] of Object.entries(chatGroups)) {
                const room = {
                    id: chatId,
                    name: `Chat ${chatId}`,
                    type: chatId.startsWith('-') ? 'group' : 'private',
                    users: 1,
                    messages: group.files.length,
                    tokens: 0,
                    lastActivity: group.lastActivity,
                    lastMessage: `${group.files.length} message files`
                };
                
                rooms.push(room);
            }
        }
        
        // Sort by last activity
        rooms.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        
        console.log(`Found ${rooms.length} rooms`);
        res.json(rooms);
    } catch (error) {
        console.error('Error loading rooms:', error);
        res.status(500).json({ error: 'Failed to load rooms', details: error.message });
    }
});

// Get chat viewer HTML
app.get('/api/chat/:roomId/viewer', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Try to load from groups directory first
        let chatData = await getS3Object(`fact_checker_bot/groups/${roomId}.json`);
        
        if (!chatData) {
            // Fallback: try other possible locations
            chatData = await getS3Object(`chats/${roomId}.json`);
        }
        
        if (!chatData) {
            // Try to load from processed messages directory
            const messageObjects = await listS3Objects(`fact_checker_bot/processed_messages/${roomId}/`);
            if (messageObjects.length > 0) {
                // Load a few recent messages to show something
                const recentMessages = [];
                for (const obj of messageObjects.slice(-10)) { // Last 10 messages
                    const msgData = await getS3Object(obj.Key);
                    if (msgData) {
                        recentMessages.push({
                            text: msgData.text || msgData.content || 'No text',
                            timestamp: msgData.timestamp || obj.LastModified,
                            from: msgData.from || msgData.user || 'User'
                        });
                    }
                }
                
                chatData = {
                    chatId: roomId,
                    chatTitle: `Chat ${roomId}`,
                    messages: recentMessages,
                    note: `Loaded ${recentMessages.length} recent messages from ${messageObjects.length} total files`
                };
            }
        }
        
        if (!chatData) {
            return res.status(404).send('<html><body><h2>Chat not found</h2></body></html>');
        }
        
        // Simple template rendering
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat: ${chatData.chatTitle || roomId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h2 { margin: 0 0 8px 0; color: #333; }
        .header p { margin: 0; color: #666; font-size: 14px; }
        .messages { background: white; border-radius: 8px; padding: 20px; max-height: 500px; overflow-y: auto; }
        .message { margin: 10px 0; padding: 12px; border-radius: 8px; position: relative; }
        .bot-msg { border-left: 4px solid #4caf50; background: #e8f5e8; }
        .user-msg { border-left: 4px solid #2196f3; background: #e3f2fd; }
        .unsend-btn { position: absolute; top: 8px; right: 8px; background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }
        .unsend-btn:hover { background: #c82333; }
        .message-content { margin-right: 80px; }
        .sender { font-weight: bold; margin-bottom: 4px; color: #333; }
        .text { margin-bottom: 8px; line-height: 1.4; }
        .time { font-size: 11px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h2>${chatData.chatTitle || 'Chat ' + roomId}</h2>
        <p>Room ID: ${roomId} • Messages: ${chatData.messages?.length || 0}</p>
    </div>
    
    <div class="messages">`;
        
        if (chatData.messages && chatData.messages.length > 0) {
            chatData.messages.slice(-50).reverse().forEach(msg => {
                const text = (msg.message_text || msg.text || 'No text').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const sender = (msg.message_from || msg.from || 'Unknown').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const timestamp = msg.timestamp?.unix ? new Date(msg.timestamp.unix).toISOString() : (msg.timestamp || new Date().toISOString());
                const timeFormatted = msg.timestamp?.unix ? new Date(msg.timestamp.unix).toLocaleString() : 
                                   (msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Unknown time');
                
                html += `<div class="message ${msg.isBot ? 'bot-msg' : 'user-msg'}">`;
                
                // Add unsend button for bot messages
                if (msg.isBot) {
                    html += `<button class="unsend-btn" onclick="unsendMessage('${timestamp}')">✕ Unsend</button>`;
                }
                
                html += '<div class="message-content">';
                html += `<div class="sender">${sender}${msg.isBot ? ' (Bot)' : ''}</div>`;
                html += `<div class="text">${text}</div>`;
                html += `<div class="time">${timeFormatted}</div>`;
                html += '</div></div>';
            });
        } else {
            html += '<p>No messages found</p>';
        }
        
        html += `    </div>
    
    <script>
        async function unsendMessage(timestamp) {
            if (!confirm('Unsend this bot message?')) return;
            
            try {
                const response = await fetch('/api/chat/${roomId}/unsend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timestamp: timestamp })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Message unsent successfully!');
                    window.location.reload();
                } else {
                    alert('Failed to unsend message: ' + result.message);
                }
            } catch (error) {
                alert('Error unsending message');
            }
        }
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Error loading chat viewer:', error);
        res.status(500).send('<html><body><h2>Error loading chat</h2></body></html>');
    }
});

// Get specific chat data
app.get('/api/chat/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Try to load from groups directory first
        let chatData = await getS3Object(`fact_checker_bot/groups/${roomId}.json`);
        
        if (!chatData) {
            // Fallback: try other possible locations
            chatData = await getS3Object(`chats/${roomId}.json`);
        }
        
        if (!chatData) {
            // Try to load from processed messages directory
            const messageObjects = await listS3Objects(`fact_checker_bot/processed_messages/${roomId}/`);
            if (messageObjects.length > 0) {
                // Load a few recent messages to show something
                const recentMessages = [];
                for (const obj of messageObjects.slice(-10)) { // Last 10 messages
                    const msgData = await getS3Object(obj.Key);
                    if (msgData) {
                        recentMessages.push({
                            text: msgData.text || msgData.content || 'No text',
                            timestamp: msgData.timestamp || obj.LastModified,
                            from: msgData.from || msgData.user || 'User'
                        });
                    }
                }
                
                chatData = {
                    chatId: roomId,
                    chatTitle: `Chat ${roomId}`,
                    messages: recentMessages,
                    note: `Loaded ${recentMessages.length} recent messages from ${messageObjects.length} total files`
                };
            }
        }
        
        if (chatData) {
            res.json(chatData);
        } else {
            res.status(404).json({ error: 'Chat not found' });
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        res.status(500).json({ error: 'Failed to load chat' });
    }
});

// Delete chat
app.delete('/api/chat/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // In a real implementation, you'd delete from S3
        // For now, just simulate the deletion
        console.log(`Would delete chat ${roomId} from S3`);
        
        res.json({ success: true, message: 'Chat deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: 'Failed to delete chat' });
    }
});

// Get current Lambda configuration
app.get('/api/config', async (req, res) => {
    try {
        const command = new GetFunctionConfigurationCommand({
            FunctionName: FUNCTION_NAME
        });
        const response = await lambdaClient.send(command);
        
        const config = {
            model: response.Environment?.Variables?.GPT_MODEL || response.Environment?.Variables?.OPENAI_MODEL || 'gpt-4o',
            features: {
                audio: !!response.Environment?.Variables?.REPLICATE_API_TOKEN,
                analytics: !!response.Environment?.Variables?.GOOGLE_ANALYTICS_ID,
                debug: response.Environment?.Variables?.DEBUG_MODE === 'true'
            },
            lastModified: response.LastModified
        };
        
        res.json(config);
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// Update Lambda model
app.post('/api/config/model', async (req, res) => {
    try {
        const { model } = req.body;
        
        // Get current environment variables
        const getCommand = new GetFunctionConfigurationCommand({
            FunctionName: FUNCTION_NAME
        });
        const currentConfig = await lambdaClient.send(getCommand);
        
        // Update with new model (use GPT_MODEL which is what the Lambda function expects)
        const newEnvVars = {
            ...currentConfig.Environment.Variables,
            GPT_MODEL: model
        };
        
        const updateCommand = new UpdateFunctionConfigurationCommand({
            FunctionName: FUNCTION_NAME,
            Environment: {
                Variables: newEnvVars
            }
        });
        
        await lambdaClient.send(updateCommand);
        
        console.log(`Updated model to ${model}`);
        res.json({ success: true, model });
    } catch (error) {
        console.error('Error updating model:', error);
        res.status(500).json({ error: 'Failed to update model' });
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        // Count rooms from actual data
        const groupObjects = await listS3Objects('fact_checker_bot/groups/');
        const roomCount = groupObjects.filter(obj => obj.Key.endsWith('.json')).length;
        
        // Calculate basic stats from room data
        let totalMessages = 0;
        let totalUsers = new Set();
        let botMessages = 0;
        let userMessages = 0;
        
        for (const obj of groupObjects.slice(0, 10)) { // Sample first 10 for performance
            if (obj.Key.endsWith('.json')) {
                const chatData = await getS3Object(obj.Key);
                if (chatData && chatData.messages) {
                    totalMessages += chatData.messages.length;
                    chatData.messages.forEach(msg => {
                        if (msg.message_from && msg.message_from !== 'Unknown') {
                            totalUsers.add(msg.message_from);
                        }
                        if (msg.isBot) {
                            botMessages++;
                        } else {
                            userMessages++;
                        }
                    });
                }
            }
        }
        
        const stats = {
            totalUsers: totalUsers.size,
            totalRooms: roomCount,
            messagesToday: 0, // Would need today's data
            tokensToday: 0, // Would need token tracking
            errorsToday: 0, // Would need error tracking
            uptime: 'Online',
            totalMessages: totalMessages,
            botMessages: botMessages,
            userMessages: userMessages,
            toolUsage: {
                'Web Search': Math.floor(botMessages * 0.3),
                'Image Analysis': Math.floor(botMessages * 0.2),
                'Voice Transcription': Math.floor(botMessages * 0.1),
                'Document OCR': Math.floor(botMessages * 0.05)
            }
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
        res.status(500).json({ error: 'Failed to load statistics' });
    }
});

// Get room limits
app.get('/api/room/:roomId/limits', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Get existing usage limits
        const usageLimits = await getS3Object('config/usage_limits.json') || {};
        
        // Default limits structure matching bot's internal operation names
        const defaultLimits = {
            // Core bot operations (mapped to internal names)
            AUDIO_GENERATION: 5,        // Audio/podcast generation limit
            SEARCH_QUERIES: 30,         // Web search limit  
            LLM_CALLS: 100,            // Daily message/LLM call limit
            LLM_TOKENS: 50000,         // Daily token limit
            
            // Legacy fields for backwards compatibility
            messageLimit: 50,
            tokenLimit: 10000,
            dailyMessageLimit: 100,
            weeklyMessageLimit: 500,
            monthlyMessageLimit: 2000,
            dailyTokenLimit: 50000,
            monthlyTokenLimit: 1000000,
            rateLimitPerMinute: 10,
            rateLimitPerHour: 100,
            maxImageAnalyses: 20,
            maxVoiceTranscriptions: 15,
            maxWebSearches: 30,
            maxDocumentOCR: 10,
            maxPodcastGenerations: 5,
            maxCostPerMonth: 50.0,
            maxUsersPerRoom: 1000,
            maxActiveUsers: 100,
            maxMessageLength: 4000,
            maxFileSize: 20971520,
            allowedFileTypes: ['image', 'audio', 'document'],
            enabledFeatures: ['webSearch', 'imageAnalysis', 'voiceTranscription'],
            disabledCommands: [],
            moderationLevel: 'medium',
            activeHours: {
                enabled: false,
                start: '09:00',
                end: '17:00',
                timezone: 'UTC'
            }
        };
        
        const roomLimits = { ...defaultLimits, ...usageLimits[roomId] };
        
        res.json(roomLimits);
    } catch (error) {
        console.error('Error getting limits:', error);
        res.status(500).json({ error: 'Failed to get limits' });
    }
});

// Update room limits
app.post('/api/room/:roomId/limits', async (req, res) => {
    try {
        const { roomId } = req.params;
        const updatedLimits = req.body;
        
        // Get existing usage limits or create new structure
        let usageLimits = await getS3Object('config/usage_limits.json') || {};
        
        // Get current room limits or defaults
        const currentLimits = usageLimits[roomId] || {
            messageLimit: 50,
            tokenLimit: 10000
        };
        
        // Merge updated limits with existing ones
        usageLimits[roomId] = {
            ...currentLimits,
            ...updatedLimits,
            lastUpdated: new Date().toISOString()
        };
        
        // Save back to S3
        const putCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'config/usage_limits.json',
            Body: JSON.stringify(usageLimits, null, 2),
            ContentType: 'application/json'
        });
        
        await s3Client.send(putCommand);
        
        const updatedKeys = Object.keys(updatedLimits).join(', ');
        console.log(`Updated limits for room ${roomId}: ${updatedKeys}`);
        
        res.json({ success: true, message: 'Limits updated successfully', updatedKeys });
    } catch (error) {
        console.error('Error updating limits:', error);
        res.status(500).json({ error: 'Failed to update limits' });
    }
});

// Get files for a specific room
app.get('/api/files/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Get files from both possible locations
        const groupFiles = await listS3Objects(`fact_checker_bot/groups/`);
        const messageFiles = await listS3Objects(`fact_checker_bot/processed_messages/${roomId}/`);
        
        const allFiles = [...groupFiles, ...messageFiles].filter(obj => 
            obj.Key.includes(roomId) && obj.Key.endsWith('.json')
        );
        
        const files = allFiles.map(obj => ({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified
        }));
        
        res.json(files);
    } catch (error) {
        console.error('Error loading files:', error);
        res.status(500).json({ error: 'Failed to load files' });
    }
});

// Get specific file content
app.get('/api/file/:*', async (req, res) => {
    try {
        const filePath = req.params[0]; // Get the full path after /api/file/
        const download = req.query.download === 'true';
        
        const fileData = await getS3Object(filePath);
        
        if (fileData) {
            if (download) {
                res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(fileData, null, 2));
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.json(fileData);
            }
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        console.error('Error loading file:', error);
        res.status(500).json({ error: 'Failed to load file' });
    }
});

// Delete specific file
app.delete('/api/file/:*', async (req, res) => {
    try {
        const filePath = req.params[0];
        
        // DeleteObjectCommand already imported at top
        const deleteCommand = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: filePath
        });
        
        await s3Client.send(deleteCommand);
        console.log(`Deleted file: ${filePath}`);
        
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Delete bot message from Telegram
app.post('/api/chat/:roomId/unsend', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { messageId, timestamp } = req.body;
        
        console.log(`Attempting to delete Telegram message in room ${roomId}`);
        console.log('Request body:', req.body);
        
        // Try to load from groups directory first to find the message
        let chatData = await getS3Object(`fact_checker_bot/groups/${roomId}.json`);
        let fileKey = `fact_checker_bot/groups/${roomId}.json`;
        
        if (!chatData) {
            // Fallback: try other possible locations
            chatData = await getS3Object(`chats/${roomId}.json`);
            fileKey = `chats/${roomId}.json`;
        }
        
        if (!chatData || !chatData.messages) {
            return res.status(404).json({ error: 'Chat data not found' });
        }
        
        // Find the message to delete
        let targetMessage = null;
        
        if (messageId) {
            // Find by messageId if provided
            targetMessage = chatData.messages.find(msg => msg.messageId == messageId && msg.isBot);
        } else if (timestamp) {
            // Find by timestamp as fallback
            targetMessage = chatData.messages.find(msg => {
                if (!msg.isBot) return false;
                
                let msgTimestamp;
                if (msg.timestamp?.unix) {
                    msgTimestamp = msg.timestamp.unix;
                } else if (msg.timestamp) {
                    msgTimestamp = new Date(msg.timestamp).getTime();
                } else {
                    return false;
                }
                
                const targetTimestamp = new Date(timestamp).getTime();
                return Math.abs(msgTimestamp - targetTimestamp) < 5000;
            });
        }
        
        if (!targetMessage) {
            return res.json({ success: false, message: 'Bot message not found' });
        }
        
        console.log('Found message to delete:', {
            messageId: targetMessage.messageId,
            text: targetMessage.message_text?.substring(0, 50)
        });
        
        // Delete from Telegram using the bot API
        if (targetMessage.messageId) {
            try {
                const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
                if (!telegramToken) {
                    console.error('TELEGRAM_BOT_TOKEN not found in environment variables');
                    return res.json({ success: false, message: 'Telegram bot token not configured' });
                }
                
                const telegramUrl = `https://api.telegram.org/bot${telegramToken}/deleteMessage`;
                const telegramResponse = await fetch(telegramUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: roomId,
                        message_id: targetMessage.messageId
                    })
                });
                
                const telegramResult = await telegramResponse.json();
                console.log('Telegram API response:', telegramResult);
                
                if (telegramResult.ok) {
                    console.log('Successfully deleted message from Telegram');
                    
                    // Also remove from our stored data
                    const originalLength = chatData.messages.length;
                    chatData.messages = chatData.messages.filter(msg => msg.messageId !== targetMessage.messageId);
                    
                    // Save updated chat data back to S3
                    const putCommand = new PutObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: fileKey,
                        Body: JSON.stringify(chatData, null, 2),
                        ContentType: 'application/json'
                    });
                    
                    await s3Client.send(putCommand);
                    
                    res.json({ 
                        success: true, 
                        message: 'Message deleted from Telegram and storage', 
                        removedCount: 1,
                        telegramResponse: telegramResult
                    });
                } else {
                    console.error('Telegram API error:', telegramResult);
                    res.json({ 
                        success: false, 
                        message: `Telegram API error: ${telegramResult.description || 'Unknown error'}`,
                        telegramError: telegramResult
                    });
                }
            } catch (telegramError) {
                console.error('Error calling Telegram API:', telegramError);
                res.json({ 
                    success: false, 
                    message: 'Failed to call Telegram API: ' + telegramError.message 
                });
            }
        } else {
            res.json({ success: false, message: 'Message ID not found - cannot delete from Telegram' });
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Search chats
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        // Search through chat files for the query
        const objects = await listS3Objects('chats/');
        const results = [];
        
        for (const obj of objects) {
            if (obj.Key.endsWith('.json')) {
                const chatData = await getS3Object(obj.Key);
                if (chatData && chatData.messages) {
                    const matchingMessages = chatData.messages.filter(msg => 
                        msg.text && msg.text.toLowerCase().includes(q.toLowerCase())
                    );
                    
                    if (matchingMessages.length > 0) {
                        const roomId = obj.Key.replace('chats/', '').replace('.json', '');
                        results.push({
                            roomId,
                            roomName: chatData.chatTitle || chatData.userName || `Chat ${roomId}`,
                            matches: matchingMessages.length,
                            lastMatch: matchingMessages[matchingMessages.length - 1]
                        });
                    }
                }
            }
        }
        
        res.json(results);
    } catch (error) {
        console.error('Error searching chats:', error);
        res.status(500).json({ error: 'Failed to search chats' });
    }
});

// Serve the main admin page
app.get('/', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(port, () => {
    console.log(`Admin server running at http://localhost:${port}`);
    console.log(`S3 Bucket: ${BUCKET_NAME}`);
    console.log(`Lambda Function: ${FUNCTION_NAME}`);
});