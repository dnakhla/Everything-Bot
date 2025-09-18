/**
 * Message Search Tool - Agent integration wrapper
 * Self-contained message search functionality for bot memory
 */

import { Logger } from '../../utils/logger.js';
import { S3Manager } from '../../services/s3Manager.js';
import { CONFIG } from '../../config.js';

/**
 * Core message search implementation
 */
async function searchMessages(options = {}) {
  try {
    const {
      chat_id = null,
      query = '',
      user_filter = null,
      date_range = null,
      message_types = ['text'],
      limit = 50,
      include_context = false
    } = options;

    Logger.log(`Searching messages: query="${query}", chat_id=${chat_id}, user_filter="${user_filter}"`);

    if (!query && !user_filter && !date_range) {
      return '❌ Please provide search criteria (query, user_filter, or date_range)';
    }

    const searchLimit = Math.min(limit, 200);
    let searchResults = [];
    let totalScanned = 0;

    // Get list of conversation files from S3
    const prefix = chat_id ? `fact_checker_bot/groups/${chat_id}/` : 'fact_checker_bot/groups/';
    const s3Objects = await S3Manager.listObjects(prefix);

    if (!s3Objects.Contents || s3Objects.Contents.length === 0) {
      return chat_id ?
        `📭 No conversation history found for chat ${chat_id}` :
        '📭 No conversation history found';
    }

    // Sort by last modified (newest first) and process conversation files
    const conversationFiles = s3Objects.Contents
      .filter(obj => obj.Key.endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

    Logger.log(`Found ${conversationFiles.length} conversation files to search`);

    // Search through conversation files (limit to prevent timeouts)
    for (const file of conversationFiles.slice(0, 20)) {
      try {
        const conversationData = await S3Manager.getObject(file.Key);
        const conversation = JSON.parse(conversationData);

        if (!conversation.messages || !Array.isArray(conversation.messages)) {
          continue;
        }

        // Search through messages
        for (let i = 0; i < conversation.messages.length; i++) {
          const message = conversation.messages[i];
          totalScanned++;

          if (searchResults.length >= searchLimit) break;

          // Apply filters
          if (!matchesFilters(message, query, user_filter, date_range, message_types)) {
            continue;
          }

          // Create result object with comprehensive file info
          const result = {
            chat_id: conversation.chat_id || 'unknown',
            message_id: message.message_id,
            date: message.date,
            user: {
              id: message.from?.id,
              username: message.from?.username,
              first_name: message.from?.first_name
            },
            text: message.text || '',
            caption: message.caption || '',
            type: getMessageType(message),
            file_path: file.Key,
            // Add comprehensive file information
            attachments: extractAttachmentInfo(message),
            analyzed_content: message.analyzed_content || null
          };

          // Add context if requested
          if (include_context) {
            result.context = {
              before: conversation.messages.slice(Math.max(0, i - 2), i).map(formatContextMessage),
              after: conversation.messages.slice(i + 1, i + 3).map(formatContextMessage)
            };
          }

          searchResults.push(result);
        }

        if (searchResults.length >= searchLimit) break;
      } catch (fileError) {
        Logger.log(`Error processing file ${file.Key}: ${fileError.message}`, 'warn');
      }
    }

    // Format results
    if (searchResults.length === 0) {
      return `🔍 **No messages found** (searched ${totalScanned} messages)`;
    }

    let result = `🔍 **Search Results** (${searchResults.length}/${totalScanned} messages)\n\n`;

    searchResults.slice(0, 20).forEach((msg, index) => {
      const userName = msg.user.username ? `@${msg.user.username}` :
                      (msg.user.first_name || 'Unknown');
      const date = new Date(msg.date * 1000).toLocaleDateString();
      const time = new Date(msg.date * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      result += `**${index + 1}.** ${userName} • ${date} ${time}\n`;

      // Show message text/caption
      if (msg.text) {
        result += `📝 ${msg.text}\n`;
      }

      if (msg.caption) {
        result += `💬 Caption: ${msg.caption}\n`;
      }

      // Show comprehensive file information
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach(att => {
          switch (att.type) {
            case 'document':
              result += `📄 **${att.file_name}** (${Math.round(att.file_size/1024)}KB, ${att.mime_type})\n`;
              result += `   🆔 File ID: ${att.file_id}\n`;
              break;
            case 'photo':
              result += `🖼️ **Image** ${att.width}×${att.height} (${Math.round(att.file_size/1024)}KB)\n`;
              result += `   🆔 File ID: ${att.file_id}\n`;
              break;
            case 'voice':
              result += `🎤 **Voice** ${att.duration}s (${Math.round(att.file_size/1024)}KB)\n`;
              if (att.transcription) {
                result += `   📝 Transcription: "${att.transcription}"\n`;
              }
              result += `   🆔 File ID: ${att.file_id}\n`;
              break;
            case 'video':
              result += `🎬 **${att.file_name}** ${att.width}×${att.height}, ${att.duration}s (${Math.round(att.file_size/1024)}KB)\n`;
              result += `   🆔 File ID: ${att.file_id}\n`;
              break;
            case 'audio':
              result += `🎵 **${att.file_name}** ${att.duration}s (${Math.round(att.file_size/1024)}KB)\n`;
              result += `   🆔 File ID: ${att.file_id}\n`;
              break;
          }
        });
      }

      // Show analyzed content if available
      if (msg.analyzed_content) {
        result += `🔍 **Analyzed:**\n`;
        if (msg.analyzed_content.ocr_text) {
          result += `   📖 OCR: "${msg.analyzed_content.ocr_text}"\n`;
        }
        if (msg.analyzed_content.description) {
          result += `   👁️ Description: "${msg.analyzed_content.description}"\n`;
        }
        if (msg.analyzed_content.summary) {
          result += `   📋 Summary: "${msg.analyzed_content.summary}"\n`;
        }
      }

      result += `🗂️ Chat: ${msg.chat_id}\n\n`;
    });

    if (searchResults.length > 20) {
      result += `\n⚠️ Showing first 20 results. Total found: ${searchResults.length}`;
    }

    return result;

  } catch (error) {
    Logger.log(`Message search error: ${error.message}`, 'error');
    return `❌ Search error: ${error.message}`;
  }
}

/**
 * Get recent messages from a chat
 */
async function getRecentMessages(chat_id, limit = 20, message_types = ['text']) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return await searchMessages({
    chat_id,
    query: '', // Empty query to get all messages
    date_range: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    message_types,
    limit: Math.min(limit, 100)
  });
}

/**
 * Get messages from a specific user
 */
async function getUserMessages(username, limit = 30, days_back = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days_back);

  return await searchMessages({
    query: '',
    user_filter: username,
    date_range: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    limit,
    message_types: ['text', 'image', 'document', 'voice', 'video']
  });
}

// Helper functions
function matchesFilters(message, query, user_filter, date_range, message_types) {
  // Query filter - search in multiple places
  if (query && query.trim()) {
    const searchQuery = query.toLowerCase();
    const messageText = (message.text || '').toLowerCase();
    const caption = (message.caption || '').toLowerCase();

    // Extract searchable content from file attachments and analyzed data
    let fileContent = '';
    let analyzedContent = '';

    // Search in document filenames
    if (message.document?.file_name) {
      fileContent += message.document.file_name.toLowerCase() + ' ';
    }

    // Search in photo captions and filenames
    if (message.photo && message.photo[0]?.file_name) {
      fileContent += message.photo[0].file_name.toLowerCase() + ' ';
    }

    // Search in voice transcriptions
    if (message.voice?.transcription) {
      analyzedContent += message.voice.transcription.toLowerCase() + ' ';
    }

    // Search in analyzed content (OCR, etc.)
    if (message.analyzed_content) {
      if (message.analyzed_content.ocr_text) {
        analyzedContent += message.analyzed_content.ocr_text.toLowerCase() + ' ';
      }
      if (message.analyzed_content.description) {
        analyzedContent += message.analyzed_content.description.toLowerCase() + ' ';
      }
      if (message.analyzed_content.summary) {
        analyzedContent += message.analyzed_content.summary.toLowerCase() + ' ';
      }
    }

    // Check all content sources
    const allContent = messageText + ' ' + caption + ' ' + fileContent + ' ' + analyzedContent;
    if (!allContent.includes(searchQuery)) {
      return false;
    }
  }

  // User filter
  if (user_filter) {
    const userStr = user_filter.toLowerCase();
    const username = (message.from?.username || '').toLowerCase();
    const firstName = (message.from?.first_name || '').toLowerCase();
    const userId = (message.from?.id || '').toString();
    if (!username.includes(userStr) && !firstName.includes(userStr) && userId !== userStr) {
      return false;
    }
  }

  // Date range filter
  if (date_range && (date_range.start || date_range.end)) {
    const messageDate = new Date(message.date * 1000);
    if (date_range.start && messageDate < new Date(date_range.start)) return false;
    if (date_range.end) {
      const endDate = new Date(date_range.end);
      endDate.setHours(23, 59, 59, 999);
      if (messageDate > endDate) return false;
    }
  }

  // Message type filter
  const messageType = getMessageType(message);
  if (!message_types.includes(messageType)) {
    return false;
  }

  return true;
}

function getMessageType(message) {
  if (message.photo) return 'image';
  if (message.document) return 'document';
  if (message.voice) return 'voice';
  if (message.video) return 'video';
  if (message.audio) return 'audio';
  return 'text';
}

function formatContextMessage(message) {
  const userName = message.from?.username ? `@${message.from.username}` :
                  (message.from?.first_name || 'Unknown');
  const text = (message.text || getMessageType(message)).substring(0, 50);
  return `${userName}: ${text}${text.length >= 50 ? '...' : ''}`;
}

function extractAttachmentInfo(message) {
  const attachments = [];

  // Document attachments
  if (message.document) {
    attachments.push({
      type: 'document',
      file_name: message.document.file_name || 'unknown',
      file_size: message.document.file_size || 0,
      mime_type: message.document.mime_type || 'unknown',
      file_id: message.document.file_id
    });
  }

  // Photo attachments
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1]; // Get largest size
    attachments.push({
      type: 'photo',
      file_name: largest.file_name || 'image.jpg',
      file_size: largest.file_size || 0,
      width: largest.width,
      height: largest.height,
      file_id: largest.file_id
    });
  }

  // Voice attachments
  if (message.voice) {
    attachments.push({
      type: 'voice',
      duration: message.voice.duration || 0,
      file_size: message.voice.file_size || 0,
      mime_type: message.voice.mime_type || 'audio/ogg',
      file_id: message.voice.file_id,
      transcription: message.voice.transcription || null
    });
  }

  // Video attachments
  if (message.video) {
    attachments.push({
      type: 'video',
      file_name: message.video.file_name || 'video.mp4',
      file_size: message.video.file_size || 0,
      duration: message.video.duration || 0,
      width: message.video.width,
      height: message.video.height,
      file_id: message.video.file_id
    });
  }

  // Audio attachments
  if (message.audio) {
    attachments.push({
      type: 'audio',
      file_name: message.audio.file_name || 'audio.mp3',
      file_size: message.audio.file_size || 0,
      duration: message.audio.duration || 0,
      mime_type: message.audio.mime_type || 'audio/mpeg',
      file_id: message.audio.file_id
    });
  }

  return attachments;
}

/**
 * Agent tool implementations
 */
export async function executeSearchMessages(params) {
  try {
    const {
      query = '',
      user_filter = null,
      days_back = 7,
      message_types = ['text'],
      limit = 20,
      include_context = false,
      chat_id = null
    } = params;

    // Convert days_back to date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days_back);

    const searchOptions = {
      chat_id,
      query: query.trim(),
      user_filter,
      date_range: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      message_types,
      limit: Math.min(limit, 100),
      include_context
    };

    return await searchMessages(searchOptions);

  } catch (error) {
    Logger.log(`Error in executeSearchMessages: ${error.message}`, 'error');
    return `❌ Message search error: ${error.message}`;
  }
}


/**
 * Message search toolkit for agent executor
 */
export const messageSearchToolkit = {
  search_messages: executeSearchMessages
};