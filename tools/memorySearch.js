import * as MessageService from '../services/messageService.js';
import { createToolWrapper } from '../utils/toolWrapper.js';

// Create lightweight wrappers around message service functions
export const searchChatHistory = createToolWrapper(
  MessageService.searchChatMessages,
  {
    name: 'searchChatHistory',
    category: 'memory',
    description: 'Search through chat message history by keyword',
    formatResult: (results, params) => {
      const [chatId, searchTerm] = params;
      if (!results || results.length === 0) {
        return `🔍 No messages found containing "${searchTerm}" in this chat.`;
      }
      
      let summary = `🔍 Found ${results.length} messages containing "${searchTerm}":\n\n`;
      results.slice(0, 10).forEach((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleDateString();
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const preview = msg.content.length > 100 ? 
          msg.content.substring(0, 100) + '...' : msg.content;
        
        summary += `${index + 1}. ${date} ${time}\n   "${preview}"\n`;
        if (msg.user) summary += `   From: ${msg.user}\n`;
        summary += '\n';
      });
      
      return summary;
    }
  }
);

export const getRecentConversationSummary = createToolWrapper(
  MessageService.getConversationSummary,
  {
    name: 'getRecentConversationSummary',
    category: 'memory',
    description: 'Get conversation summary from recent messages',
    formatResult: (summary, params) => {
      const [chatId, hours = 24] = params;
      if (!summary || summary.trim() === '') {
        return `📝 No conversation activity found in the last ${hours} hours.`;
      }
      return `📝 Conversation Summary (last ${hours} hours):\n\n${summary}`;
    }
  }
);

export const getMessagesFromLastHours = createToolWrapper(
  async (chatId, hours) => {
    console.log(`[DEBUG] getMessagesFromLastHours called with chatId: ${chatId}, hours: ${hours}`);
    const result = await MessageService.getMessagesFromLastNhours(chatId, hours);
    console.log(`[DEBUG] getMessagesFromLastNhours returned:`, { 
      type: typeof result, 
      isArray: Array.isArray(result), 
      length: result?.length,
      sample: result?.slice(0, 2)
    });
    return result;
  },
  {
    name: 'getMessagesFromLastHours',
    category: 'memory',
    description: 'Get messages from the last N hours',
    formatResult: (messages, params) => {
      const [chatId, hours] = params;
      console.log(`[DEBUG] getMessagesFromLastHours formatResult:`, { 
        messages: messages ? `Array(${messages.length})` : messages, 
        chatId, 
        hours 
      });
      return formatMessagesResult(messages, `last ${hours} hours`);
    }
  }
);

export const getMessagesFromLastDays = createToolWrapper(
  MessageService.getMessagesFromLastNdays,
  {
    name: 'getMessagesFromLastDays',
    category: 'memory', 
    description: 'Get messages from the last N days',
    formatResult: (messages, params) => {
      const [chatId, days] = params;
      return formatMessagesResult(messages, `last ${days} days`);
    }
  }
);

// Specific image analysis tools with better context
export const analyzeImagesFromTimeframe = createToolWrapper(
  async (chatId, query, lookbackHours = 24) => {
    console.log(`[DEBUG] analyzeImagesFromTimeframe called with:`, { chatId, query, lookbackHours });
    const result = await MessageService.analyzeRecentImages(chatId, query, lookbackHours);
    console.log(`[DEBUG] analyzeRecentImages returned:`, { 
      type: typeof result, 
      length: result?.length,
      preview: result?.substring(0, 200)
    });
    return result;
  },
  {
    name: 'analyzeImagesFromTimeframe',
    category: 'memory',
    description: 'Analyze images shared within a specific timeframe',
    formatResult: (analysis, params) => {
      const [chatId, query, lookbackHours = 24] = params;
      console.log(`[DEBUG] analyzeImagesFromTimeframe formatResult:`, { 
        analysis: analysis ? `String(${analysis.length})` : analysis, 
        chatId, 
        query, 
        lookbackHours 
      });
      if (!analysis || analysis.trim() === '') {
        return `🖼️ No images found in the last ${lookbackHours} hours matching "${query}".`;
      }
      return `🖼️ Image Analysis (${lookbackHours}h lookback) for "${query}":\n\n${analysis}`;
    }
  }
);

export const extractTextFromImagesInTimeframe = createToolWrapper(
  MessageService.extractTextFromRecentImages,
  {
    name: 'extractTextFromImagesInTimeframe', 
    category: 'memory',
    description: 'Extract text from images shared within a specific timeframe',
    formatResult: (extractedText, params) => {
      const [chatId, lookbackHours = 24] = params;
      if (!extractedText || extractedText.trim() === '') {
        return `📄 No text found in images from the last ${lookbackHours} hours.`;
      }
      return `📄 Text from Images (${lookbackHours}h lookback):\n\n${extractedText}`;
    }
  }
);

// Enhanced image search by specific date
export const findImagesByDate = createToolWrapper(
  async (chatId, targetDate, query = '') => {
    // Parse date and create date range for that day
    const date = new Date(targetDate);
    const startDate = new Date(date.setHours(0, 0, 0, 0)).toISOString().split('T')[0];
    const endDate = new Date(date.setHours(23, 59, 59, 999)).toISOString().split('T')[0];
    
    const messages = await MessageService.getMessagesFromDateRange(chatId, startDate, endDate);
    const imageMessages = messages.filter(msg => 
      msg.attachments && msg.attachments.some(att => att.type === 'photo')
    );
    
    return { imageMessages, targetDate: startDate, query };
  },
  {
    name: 'findImagesByDate',
    category: 'memory',
    description: 'Find and analyze images shared on a specific date',
    formatResult: (result, params) => {
      const { imageMessages, targetDate, query } = result;
      const [chatId, date] = params;
      
      if (!imageMessages || imageMessages.length === 0) {
        return `🖼️ No images found on ${targetDate}.`;
      }
      
      let summary = `🖼️ Images found on ${targetDate} (${imageMessages.length} total):\n\n`;
      
      imageMessages.slice(0, 10).forEach((msg, index) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.message_from || 'Unknown';
        const caption = msg.message_text || '';
        const photoCount = msg.attachments.filter(att => att.type === 'photo').length;
        
        summary += `${index + 1}. ${time} - ${sender}\n`;
        if (caption && caption !== '[No text content]') {
          summary += `   Caption: "${caption}"\n`;
        }
        summary += `   Images: ${photoCount}\n\n`;
      });
      
      return summary;
    }
  }
);

// Search for specific image content/receipts/documents
export const searchForSpecificImages = createToolWrapper(
  async (chatId, searchQuery, lookbackDays = 30) => {
    const messages = await MessageService.getMessagesFromLastNdays(chatId, lookbackDays);
    const imageMessages = messages.filter(msg => 
      msg.attachments && msg.attachments.some(att => att.type === 'photo')
    );
    
    // Filter by caption or previous analysis if available
    const relevantImages = imageMessages.filter(msg => {
      const caption = (msg.message_text || '').toLowerCase();
      const hasRelevantCaption = caption.includes(searchQuery.toLowerCase());
      
      // Check if any image attachments have relevant descriptions
      const hasRelevantImage = msg.attachments.some(att => 
        att.type === 'photo' && 
        att.description && 
        att.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      return hasRelevantCaption || hasRelevantImage;
    });
    
    return { relevantImages, searchQuery, lookbackDays };
  },
  {
    name: 'searchForSpecificImages',
    category: 'memory', 
    description: 'Search for specific images by content (receipts, documents, etc.)',
    formatResult: (result, params) => {
      const { relevantImages, searchQuery, lookbackDays } = result;
      const [chatId, query] = params;
      
      if (!relevantImages || relevantImages.length === 0) {
        return `🔍 No images found matching "${searchQuery}" in the last ${lookbackDays} days.\n\nTry searching for:\n• "receipt" or "invoice"\n• "document" or "paper"\n• "screenshot" or "screen"\n• "photo" or "picture"`;
      }
      
      let summary = `🔍 Found ${relevantImages.length} images matching "${searchQuery}" (${lookbackDays} day search):\n\n`;
      
      relevantImages.slice(0, 10).forEach((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleDateString();
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.message_from || 'Unknown';
        const caption = msg.message_text || '';
        
        summary += `${index + 1}. ${date} ${time} - ${sender}\n`;
        if (caption && caption !== '[No text content]') {
          summary += `   Caption: "${caption}"\n`;
        }
        
        // Show relevant image descriptions if available
        const relevantAttachments = msg.attachments.filter(att => 
          att.type === 'photo' && att.description
        );
        
        if (relevantAttachments.length > 0) {
          relevantAttachments.forEach((att, i) => {
            summary += `   Image ${i + 1}: ${att.description.substring(0, 100)}...\n`;
          });
        }
        
        summary += '\n';
      });
      
      return summary;
    }
  }
);

// Helper function to format message results (DRY principle)
function formatMessagesResult(messages, description) {
  console.log(`[DEBUG] formatMessagesResult called with:`, { 
    messages: messages ? `Array(${messages.length})` : messages, 
    description 
  });
  
  if (!messages) {
    console.log(`[ERROR] formatMessagesResult: messages is undefined/null for ${description}`);
    return `📅 No messages data available for ${description}.`;
  }
  
  if (!Array.isArray(messages)) {
    console.log(`[ERROR] formatMessagesResult: messages is not an array for ${description}:`, typeof messages);
    return `📅 Invalid message data format for ${description}.`;
  }
  
  if (messages.length === 0) {
    return `📅 No messages found for ${description}.`;
  }
  
  let summary = `📅 Messages from ${description} (${messages.length} total):\n\n`;
  const recentMessages = messages.slice(-10);
  
  recentMessages.forEach((msg, index) => {
    const date = new Date(msg.timestamp).toLocaleDateString();
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const preview = msg.content.length > 80 ? 
      msg.content.substring(0, 80) + '...' : msg.content;
    
    summary += `${index + 1}. ${date} ${time}\n   "${preview}"\n`;
    if (msg.user) summary += `   From: ${msg.user}\n`;
    summary += '\n';
  });
  
  if (messages.length > 10) {
    summary += `... (showing last 10 of ${messages.length} messages)`;
  }
  
  return summary;
}