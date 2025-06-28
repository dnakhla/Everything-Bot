/**
 * Image Analysis Tool - AI-powered image analysis with organized S3 storage
 * 
 * Provides image analysis capabilities using GPT-4.1-mini vision model
 * with proper chat-based S3 organization
 */

import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from '../services/s3Manager.js';
import { createToolWrapper } from '../utils/toolWrapper.js';

/**
 * Analyze an image using GPT-4.1-mini vision model
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} instruction - Specific instruction for analysis
 * @param {string} chatId - Chat ID for S3 organization
 * @param {string} filename - Optional filename
 * @returns {Promise<string>} Analysis result
 */
export const analyzeImage = createToolWrapper(
  async (imageData, instruction = 'analyze this image', chatId = null, filename = null) => {
    try {
      Logger.log(`Analyzing image with instruction: "${instruction}"`);
      
      // Import OpenAI
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: CONFIG.OPENAI_API_KEY,
      });
      
      let base64Image;
      let imageBuffer;
      
      // Handle different input formats
      if (Buffer.isBuffer(imageData)) {
        imageBuffer = imageData;
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string') {
        // Assume it's base64
        base64Image = imageData.replace(/^data:image\/[^;]+;base64,/, '');
        imageBuffer = Buffer.from(base64Image, 'base64');
      } else {
        throw new Error('Invalid image data format. Expected Buffer or base64 string.');
      }
      
      // Save to S3 with organized structure if chatId provided
      let s3Location = null;
      if (chatId && imageBuffer) {
        const timestamp = Date.now();
        const fileExtension = filename?.split('.').pop() || 'png';
        const s3Key = `fact_checker_bot/groups/${chatId}/images/${timestamp}.${fileExtension}`;
        
        try {
          await S3Manager.uploadBuffer(
            CONFIG.S3_BUCKET_NAME, 
            s3Key, 
            imageBuffer, 
            `image/${fileExtension}`
          );
          s3Location = s3Key;
          Logger.log(`Image saved to S3: ${s3Key}`);
        } catch (s3Error) {
          Logger.log(`Failed to save image to S3: ${s3Error.message}`, 'warn');
          // Continue with analysis even if S3 save fails
        }
      }
      
      // Analyze with GPT-4.1-mini vision
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini', // Use 4.1-mini for consistency with content analysis
        messages: [
          {
            role: 'system',
            content: 'You are an image analysis expert. Provide detailed, accurate descriptions and analysis of images. Be specific and helpful.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: instruction
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high' // Use high detail for better analysis
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });
      
      const analysis = response.choices[0].message.content;
      Logger.log(`Image analysis completed: ${analysis.substring(0, 100)}...`);
      
      let result = `🖼️ **Image Analysis:**\n\n${analysis}`;
      
      if (s3Location) {
        result += `\n\n📁 *Saved to: ${s3Location}*`;
      }
      
      return result;
      
    } catch (error) {
      Logger.log(`Image analysis error: ${error.message}`, 'error');
      
      if (error.message.includes('rate limit')) {
        return '⏳ Rate limit reached for image analysis. Please try again in a moment.';
      } else if (error.message.includes('content_policy')) {
        return '🚫 Image content violates policy and cannot be analyzed.';
      } else {
        return `❌ Error analyzing image: ${error.message}`;
      }
    }
  },
  {
    name: 'analyzeImage',
    category: 'vision',
    description: 'AI-powered image analysis using GPT-4.1-mini vision model',
    formatResult: (result) => result
  }
);

/**
 * Extract text from an image using OCR analysis
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} chatId - Chat ID for S3 organization
 * @param {string} filename - Optional filename
 * @returns {Promise<string>} Extracted text
 */
export const extractTextFromImage = createToolWrapper(
  async (imageData, chatId = null, filename = null) => {
    const instruction = 'Extract all text from this image. Transcribe it exactly as it appears, maintaining formatting and structure. If no text is visible, say "No text detected".';
    
    const result = await analyzeImage(imageData, instruction, chatId, filename);
    
    // Format the result specifically for text extraction
    return result.replace('🖼️ **Image Analysis:**', '📝 **Text Extraction:**');
  },
  {
    name: 'extractTextFromImage',
    category: 'vision',
    description: 'Extract text from images using OCR analysis',
    formatResult: (result) => result
  }
);

/**
 * Analyze an image for specific content (receipts, documents, charts, etc.)
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} contentType - Type of content to analyze (receipt, document, chart, etc.)
 * @param {string} chatId - Chat ID for S3 organization
 * @param {string} filename - Optional filename
 * @returns {Promise<string>} Specialized analysis result
 */
export const analyzeImageContent = createToolWrapper(
  async (imageData, contentType = 'document', chatId = null, filename = null) => {
    const instructions = {
      receipt: 'Analyze this receipt. Extract: business name, date, total amount, payment method, and itemized list if visible. Format as structured information.',
      document: 'Analyze this document. Identify the type of document, extract key information, dates, names, and important details.',
      chart: 'Analyze this chart or graph. Describe the type of visualization, extract data points, trends, and key insights.',
      screenshot: 'Analyze this screenshot. Describe what application or website is shown, identify key UI elements, and extract any important information.',
      photo: 'Describe this photo in detail. Identify objects, people, settings, activities, and any text or signage visible.',
      code: 'Analyze this code image. Identify the programming language, explain what the code does, and highlight any issues or important patterns.',
      meme: 'Analyze this meme or social media image. Describe the visual elements, text, and explain the humor or message.',
      medical: 'Analyze this medical image or document. Extract key information while being careful about medical accuracy. Note: This is not medical advice.',
      form: 'Analyze this form. Identify the type of form, extract filled information, and note any missing or important fields.',
      map: 'Analyze this map image. Identify locations, routes, landmarks, and extract any relevant geographic or directional information.'
    };
    
    const instruction = instructions[contentType.toLowerCase()] || 
      `Analyze this ${contentType} image. Provide detailed analysis of its content, structure, and key information.`;
    
    const result = await analyzeImage(imageData, instruction, chatId, filename);
    
    // Format the result with the specific content type
    const emoji = {
      receipt: '🧾',
      document: '📄',
      chart: '📊',
      screenshot: '📱',
      photo: '📸',
      code: '💻',
      meme: '😄',
      medical: '🏥',
      form: '📋',
      map: '🗺️'
    };
    
    const resultEmoji = emoji[contentType.toLowerCase()] || '🖼️';
    
    return result.replace('🖼️ **Image Analysis:**', `${resultEmoji} **${contentType.charAt(0).toUpperCase() + contentType.slice(1)} Analysis:**`);
  },
  {
    name: 'analyzeImageContent',
    category: 'vision',
    description: 'Specialized image analysis for specific content types (receipts, documents, etc.)',
    formatResult: (result) => result
  }
);

/**
 * Compare two images and highlight differences or similarities
 * @param {Buffer|string} image1 - First image
 * @param {Buffer|string} image2 - Second image
 * @param {string} compareType - Type of comparison: 'differences', 'similarities', 'changes'
 * @param {string} chatId - Chat ID for S3 organization
 * @returns {Promise<string>} Comparison result
 */
export const compareImages = createToolWrapper(
  async (image1, image2, compareType = 'differences', chatId = null) => {
    try {
      Logger.log(`Comparing two images for ${compareType}`);
      
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: CONFIG.OPENAI_API_KEY,
      });
      
      // Process both images
      let base64Image1, base64Image2;
      
      if (Buffer.isBuffer(image1)) {
        base64Image1 = image1.toString('base64');
      } else {
        base64Image1 = image1.replace(/^data:image\/[^;]+;base64,/, '');
      }
      
      if (Buffer.isBuffer(image2)) {
        base64Image2 = image2.toString('base64');
      } else {
        base64Image2 = image2.replace(/^data:image\/[^;]+;base64,/, '');
      }
      
      const compareInstructions = {
        differences: 'Compare these two images and identify all visible differences. List specific changes, additions, or removals.',
        similarities: 'Compare these two images and identify what is similar or identical between them.',
        changes: 'Analyze these two images as before/after shots. Describe what changed between them and the significance of those changes.'
      };
      
      const instruction = compareInstructions[compareType] || 'Compare these two images and describe their relationship.';
      
      // Save both images to S3 if chatId provided
      if (chatId) {
        const timestamp = Date.now();
        const s3Key1 = `fact_checker_bot/groups/${chatId}/images/compare_${timestamp}_1.png`;
        const s3Key2 = `fact_checker_bot/groups/${chatId}/images/compare_${timestamp}_2.png`;
        
        try {
          await Promise.all([
            S3Manager.uploadBuffer(CONFIG.S3_BUCKET_NAME, s3Key1, Buffer.from(base64Image1, 'base64'), 'image/png'),
            S3Manager.uploadBuffer(CONFIG.S3_BUCKET_NAME, s3Key2, Buffer.from(base64Image2, 'base64'), 'image/png')
          ]);
          Logger.log(`Comparison images saved to S3: ${s3Key1}, ${s3Key2}`);
        } catch (s3Error) {
          Logger.log(`Failed to save comparison images to S3: ${s3Error.message}`, 'warn');
        }
      }
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an image comparison expert. Provide detailed analysis of similarities and differences between images.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${instruction}\n\nFirst image:`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image1}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: 'Second image:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image2}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });
      
      const comparison = response.choices[0].message.content;
      
      return `🔍 **Image Comparison (${compareType}):**\n\n${comparison}`;
      
    } catch (error) {
      Logger.log(`Image comparison error: ${error.message}`, 'error');
      return `❌ Error comparing images: ${error.message}`;
    }
  },
  {
    name: 'compareImages',
    category: 'vision',
    description: 'Compare two images for differences, similarities, or changes',
    formatResult: (result) => result
  }
);

/**
 * Get S3 path for chat images
 * @param {string} chatId - Chat ID
 * @returns {string} S3 path for images
 */
export function getChatImagePath(chatId) {
  return `fact_checker_bot/groups/${chatId}/images/`;
}

/**
 * List recent images for a chat
 * @param {string} chatId - Chat ID
 * @param {number} limit - Maximum number of images to return
 * @returns {Promise<Array>} Array of image metadata
 */
export const listChatImages = createToolWrapper(
  async (chatId, limit = 10) => {
    try {
      const imagePath = getChatImagePath(chatId);
      
      // List objects in S3 with the chat's image prefix
      const response = await S3Manager.listObjects(imagePath);
      const objects = response.Contents || [];
      
      if (!objects || objects.length === 0) {
        return `📁 No images found for this chat.`;
      }
      
      // Sort by last modified (newest first) and limit
      const recentImages = objects
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
        .slice(0, limit);
      
      let result = `📁 **Recent Images (${recentImages.length}):**\n\n`;
      
      recentImages.forEach((image, index) => {
        const date = new Date(image.LastModified).toLocaleDateString();
        const time = new Date(image.LastModified).toLocaleTimeString();
        const sizeKB = Math.round(image.Size / 1024);
        const filename = image.Key.split('/').pop();
        
        result += `${index + 1}. **${filename}**\n`;
        result += `   📅 ${date} ${time}\n`;
        result += `   📏 ${sizeKB}KB\n`;
        result += `   🔗 ${image.Key}\n\n`;
      });
      
      return result;
      
    } catch (error) {
      Logger.log(`Error listing chat images: ${error.message}`, 'error');
      return `❌ Error listing images: ${error.message}`;
    }
  },
  {
    name: 'listChatImages',
    category: 'vision',
    description: 'List recent images stored for a chat',
    formatResult: (result) => result
  }
);

/**
 * Image Analysis Toolkit for agent integration
 */
export const IMAGE_ANALYSIS_TOOLKIT = {
  analyzeImage: {
    name: 'analyzeImage',
    description: 'AI-powered image analysis using GPT-4.1-mini vision',
    examples: [
      'analyzeImage(imageBuffer, "describe what you see", chatId)',
      'analyzeImage(base64Image, "extract all text from this image", chatId)',
      'analyzeImage(imageData, "identify the brand and model of this device", chatId)'
    ],
    use_cases: [
      'General image description and analysis',
      'Object and scene recognition',
      'Reading text in images',
      'Identifying products, brands, or landmarks',
      'Understanding charts and diagrams'
    ]
  },
  
  extractTextFromImage: {
    name: 'extractTextFromImage', 
    description: 'OCR text extraction from images',
    examples: [
      'extractTextFromImage(imageBuffer, chatId)',
      'extractTextFromImage(screenshotData, chatId, "screenshot.png")'
    ],
    use_cases: [
      'Reading text from photos',
      'Extracting text from screenshots',
      'Digitizing handwritten notes',
      'Reading signs and documents'
    ]
  },
  
  analyzeImageContent: {
    name: 'analyzeImageContent',
    description: 'Specialized analysis for specific content types',
    examples: [
      'analyzeImageContent(imageData, "receipt", chatId)',
      'analyzeImageContent(imageData, "document", chatId)',
      'analyzeImageContent(imageData, "chart", chatId)'
    ],
    content_types: ['receipt', 'document', 'chart', 'screenshot', 'photo', 'code', 'meme', 'medical', 'form', 'map'],
    use_cases: [
      'Receipt analysis for expense tracking',
      'Document processing and extraction',
      'Chart and graph interpretation',
      'Screenshot analysis for troubleshooting'
    ]
  }
};