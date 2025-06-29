import { S3Manager } from './s3Manager.js';
import { CONFIG } from '../config.js';
import { Logger } from '../utils/logger.js';
import { processVideo } from './videoProcessor.js';
import { Analytics } from './analytics.js';
import axios from 'axios';

/**
 * Fetch content from a URL
 * @param {string} url - The URL to fetch content from
 * @returns {Promise<string>} - The fetched content
 */
export async function fetchUrlContent(url) {
  try {
    Logger.log(`Fetching content from URL: ${url}`);
        
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FactCheckerBot/1.0)'
      },
      maxContentLength: 1024 * 1024 // 1MB limit
    });
        
    // Extract text content from HTML if needed
    let content = response.data;
    if (typeof content === 'string' && content.includes('<html')) {
      // Basic HTML tag removal for simple text extraction
      content = content
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
        
    // No content length limit - allow full page content for comprehensive analysis
        
    Logger.log(`Successfully fetched content from URL: ${url} (${content.length} chars)`);
    return content;
        
  } catch (error) {
    Logger.log(`Error fetching URL content: ${error.message}`, 'error');
    throw new Error(`Failed to fetch content from ${url}: ${error.message}`);
  }
}

/**
 * Perform a Google search using Serper API
 * @param {string} query - Search query
 * @returns {Promise<string>} - Search results
 */
export async function performGoogleSearch(query) {
  try {
    Logger.log(`Performing Google search: ${query}`);
        
    const response = await axios.post('https://google.serper.dev/search', {
      q: query,
      num: 5
    }, {
      headers: {
        'X-API-KEY': CONFIG.SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const results = response.data.organic || [];
    let resultSummary = `Google Search Results for "${query}":\n\n`;
        
    results.forEach((result, index) => {
      resultSummary += `${index + 1}. ${result.title}\n`;
      resultSummary += `   ${result.snippet}\n`;
      resultSummary += `   ${result.link}\n\n`;
    });

    return resultSummary;
  } catch (error) {
    Logger.log(`Google search error: ${error.message}`, 'error');
    return `Error performing Google search: ${error.message}`;
  }
}

/**
 * Perform a Brave search
 * @param {string} query - Search query  
 * @returns {Promise<string>} - Search results
 */
export async function performBraveSearch(query) {
  try {
    Logger.log(`Performing Brave search: ${query}`);
        
    if (!CONFIG.BRAVE_API_KEY) {
      return 'Brave Search is not configured (missing API key)';
    }
        
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: {
        q: query,
        count: 5
      },
      headers: {
        'X-Subscription-Token': CONFIG.BRAVE_API_KEY,
        'Accept': 'application/json'
      }
    });

    const results = response.data.web?.results || [];
    let resultSummary = `Brave Search Results for "${query}":\n\n`;
        
    results.forEach((result, index) => {
      resultSummary += `${index + 1}. ${result.title}\n`;
      resultSummary += `   ${result.description}\n`;
      resultSummary += `   ${result.url}\n\n`;
    });

    return resultSummary;
  } catch (error) {
    Logger.log(`Brave search error: ${error.message}`, 'error');
    return `Error performing Brave search: ${error.message}`;
  }
}

/**
 * Download and convert file to base64 using raw Telegram Bot API
 * @param {string} fileId - Telegram file ID
 * @param {string} fileName - Original filename
 * @returns {Promise<Object>} - File data with base64 content
 */
async function downloadAndEncodeFile(fileId, fileName) {
  try {
    Logger.log(`Getting file info for file_id: ${fileId}`);
    
    // Step 1: Get file info using raw API call
    const getFileUrl = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getFile`;
    const fileInfoResponse = await axios.post(getFileUrl, {
      file_id: fileId
    });
    
    if (!fileInfoResponse.data.ok) {
      throw new Error(`Failed to get file info: ${fileInfoResponse.data.description}`);
    }
    
    const fileInfo = fileInfoResponse.data.result;
    const filePath = fileInfo.file_path;
    const fileSize = fileInfo.file_size || 0;
    
    Logger.log(`Got file info: path=${filePath}, size=${fileSize} bytes`);
    
    // Step 2: Check file size limit (10MB for base64 storage)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      return {
        type: 'file_too_large',
        fileName: fileName,
        fileSize: fileSize,
        message: `File too large (${Math.round(fileSize / 1024 / 1024)}MB). Max size: 10MB`
      };
    }
    
    // Step 3: Download file content using the file URL
    const fileUrl = `https://api.telegram.org/file/bot${CONFIG.TELEGRAM_BOT_TOKEN}/${filePath}`;
    Logger.log(`Downloading file from: ${fileUrl}`);
    
    const response = await axios.get(fileUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });
    
    // Step 4: Convert to base64
    const base64Content = Buffer.from(response.data).toString('base64');
    
    // Step 5: Determine MIME type from file path or extension
    let mimeType = 'application/octet-stream';
    
    // First try to get MIME type from Telegram file path
    if (filePath) {
      const pathExtension = filePath.split('.').pop()?.toLowerCase();
      if (pathExtension) {
        const mimeTypes = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
          'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'txt': 'text/plain', 'csv': 'text/csv', 'json': 'application/json',
          'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
          'mp4': 'video/mp4', 'webm': 'video/webm'
        };
        mimeType = mimeTypes[pathExtension] || 'application/octet-stream';
      }
    }
    
    // Fallback to filename extension
    if (mimeType === 'application/octet-stream') {
      const extension = fileName.split('.').pop()?.toLowerCase();
      if (extension) {
        const mimeTypes = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
          'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'txt': 'text/plain', 'csv': 'text/csv', 'json': 'application/json',
          'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
          'mp4': 'video/mp4', 'webm': 'video/webm'
        };
        mimeType = mimeTypes[extension] || 'application/octet-stream';
      }
    }
    
    const actualFileSize = response.data.byteLength;
    Logger.log(`Downloaded and encoded file: ${fileName} (${actualFileSize} bytes, MIME: ${mimeType})`);
    
    return {
      type: 'file',
      fileName: fileName,
      fileSize: actualFileSize,
      mimeType: mimeType,
      base64Content: base64Content,
      dataUrl: `data:${mimeType};base64,${base64Content}`
    };
    
  } catch (error) {
    Logger.log(`Error downloading file ${fileId}: ${error.message}`, 'error');
    return {
      type: 'file_error',
      fileName: fileName,
      error: error.message
    };
  }
}

/**
 * Save a user message to S3 storage
 * @param {string|number} chatId - The chat ID
 * @param {Object} message - The message object from Telegram
 */
export async function saveUserMessage(chatId, message) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
        
    // Get existing messages
    const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
    
    // Check if this is a new conversation (first user message)
    const isNewConversation = existingData.messages.length === 0;
    
    // Track message received
    const messageType = message.voice ? 'voice' : 
                       message.video ? 'video' : 
                       message.animation ? 'gif' : 
                       message.photo ? 'photo' : 
                       message.document ? 'document' : 'text';
    const hasAttachments = !!(message.voice || message.video || message.animation || message.photo || message.document);
    Analytics.trackMessageReceived(chatId, messageType, hasAttachments);
        
    // Create base message entry
    const messageEntry = {
      messageId: message.message_id,
      message_from: message.from ? `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim() : 'Unknown',
      message_text: message.text || message.caption || '[No text content]',
      timestamp: {
        unix: Date.now(),
        friendly: new Date().toLocaleString()
      },
      isBot: false,
      chat_title: message.chat?.title || null,
      attachments: []
    };
    
    // Handle different message types with files
    const attachments = [];
    
    // Photos - analyze and save description only (not base64 to save tokens)
    if (message.photo && message.photo.length > 0) {
      try {
        Logger.log(`Processing photo for message ${message.message_id}`);
        // Use medium resolution instead of largest to reduce payload size
        const photos = message.photo;
        const mediumPhoto = photos.length >= 3 ? photos[photos.length - 2] : photos[photos.length - 1];
        Logger.log(`Selected photo file_id: ${mediumPhoto.file_id}, size: ${mediumPhoto.file_size} bytes`);
        
        // Download and analyze image
        const photoData = await downloadAndEncodeFile(mediumPhoto.file_id, `photo_${message.message_id}.jpg`);
        
        if (photoData.type === 'file_error' || photoData.type === 'file_too_large') {
          Logger.log(`Photo download failed: ${photoData.error || photoData.message}`, 'error');
          attachments.push({
            type: 'photo',
            width: mediumPhoto.width,
            height: mediumPhoto.height,
            description: 'Photo download failed',
            error: photoData.error || photoData.message
          });
        } else {
          Logger.log(`Photo downloaded: ${photoData.fileName} (${photoData.fileSize} bytes)`);
          
          // Analyze image with AI using correct OpenAI format
          const { OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
          
          Analytics.trackLLMCall("gpt-4.1-mini", "image_analysis");
          const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: "Describe this image in detail. What do you see? Include objects, people, animals, setting, colors, and any text visible."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: photoData.dataUrl,
                      detail: "low"
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          });
          
          const imageDescription = response.choices[0].message.content;
          Analytics.trackImageAnalysis('photo', 'general_description', true);
          Logger.log(`Image analyzed successfully for message ${message.message_id}`);
          
          // Save only the description (not the base64 data)
          attachments.push({
            type: 'photo',
            width: mediumPhoto.width,
            height: mediumPhoto.height,
            fileName: photoData.fileName,
            fileSize: photoData.fileSize,
            description: imageDescription,
            analyzed_at: new Date().toISOString()
          });
          
          Logger.log(`Saved photo description for message ${message.message_id}`);
        }
      } catch (photoError) {
        Logger.log(`Error processing photo for message ${message.message_id}: ${photoError.message}`, 'error');
        // Save basic info even if analysis fails
        attachments.push({
          type: 'photo',
          width: message.photo[message.photo.length - 1].width,
          height: message.photo[message.photo.length - 1].height,
          description: 'Image analysis failed',
          error: photoError.message
        });
      }
    }
    
    // Animations/GIFs
    if (message.animation) {
      try {
        Logger.log(`Processing animation/GIF for message ${message.message_id}`);
        const animation = message.animation;
        const fileName = animation.file_name || `animation_${message.message_id}.gif`;
        
        const animationData = await downloadAndEncodeFile(animation.file_id, fileName);
        
        if (animationData.type === 'file_error' || animationData.type === 'file_too_large') {
          Logger.log(`Animation download failed: ${animationData.error || animationData.message}`, 'error');
          attachments.push({
            type: 'animation',
            width: animation.width,
            height: animation.height,
            duration: animation.duration,
            description: 'Animation download failed',
            error: animationData.error || animationData.message
          });
        } else {
          // For GIFs, we can also analyze them with vision API
          try {
            const { OpenAI } = await import('openai');
            const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
            
            // Create a temporary buffer from base64 for file upload
            const base64Data = animationData.base64Content;
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Process video/animation with frame extraction
            let animationDescription;
            if (animationData.mimeType === 'video/mp4' || animationData.mimeType === 'image/gif') {
              try {
                Logger.log(`Processing ${animationData.mimeType} with video processor`);
                
                // Use the video processor for frame-by-frame analysis
                animationDescription = await processVideo(
                  buffer, 
                  animation, 
                  animationData.mimeType, 
                  openai
                );
                
                Logger.log(`Video processing completed for ${animationData.fileName}`);
                
              } catch (videoProcessingError) {
                Logger.log(`Video processing failed: ${videoProcessingError.message}`, 'error');
                
                // Fallback to basic analysis for GIFs
                if (animationData.mimeType === 'image/gif') {
                  try {
                    const response = await openai.chat.completions.create({
                      model: "gpt-4.1-mini",
                      messages: [
                        {
                          role: "user",
                          content: [
                            {
                              type: "text",
                              text: `Analyze this ${animation.duration}s GIF animation. This is likely a meme, reaction GIF, or animated content. Describe what's happening, any text visible, the emotional context or humor, and any movement or changes you can observe. If it appears to be a meme, explain the likely meaning or context.`
                            },
                            {
                              type: "image_url",
                              image_url: {
                                url: animationData.mimeType === 'image/gif' ? animationData.dataUrl : `data:image/gif;base64,${animationData.base64Content}`,
                                detail: "high"
                              }
                            }
                          ]
                        }
                      ],
                      max_tokens: 300
                    });
                    
                    animationDescription = `GIF Analysis (fallback method): ${response.choices[0].message.content}`;
                  } catch (fallbackError) {
                    Logger.log(`Fallback GIF analysis failed: ${fallbackError.message}`, 'error');
                    animationDescription = `GIF analysis failed: ${fallbackError.message}`;
                  }
                } else {
                  // MP4 fallback
                  animationDescription = `MP4 video (${animation.duration}s, ${animation.width}x${animation.height}) - Frame extraction failed: ${videoProcessingError.message}`;
                }
              }
            } else {
              // For other animation formats, provide basic info
              animationDescription = `Animation file (${animation.duration}s, ${animationData.mimeType}) with dimensions ${animation.width}x${animation.height}. File format not supported for frame-by-frame analysis.`;
            }
            
            attachments.push({
              type: 'animation',
              width: animation.width,
              height: animation.height,
              duration: animation.duration,
              fileName: animationData.fileName,
              fileSize: animationData.fileSize,
              description: animationDescription,
              analyzed_at: new Date().toISOString()
            });
            
            Logger.log(`Saved animation with AI description for message ${message.message_id}`);
          } catch (analysisError) {
            Logger.log(`Animation analysis failed: ${analysisError.message}`, 'error');
            attachments.push({
              type: 'animation',
              width: animation.width,
              height: animation.height,
              duration: animation.duration,
              fileName: animationData.fileName,
              fileSize: animationData.fileSize,
              description: 'Animation analysis failed',
              error: analysisError.message
            });
          }
        }
      } catch (animationError) {
        Logger.log(`Error processing animation for message ${message.message_id}: ${animationError.message}`, 'error');
        attachments.push({
          type: 'animation',
          description: 'Animation processing failed',
          error: animationError.message
        });
      }
    }
    
    // Documents
    if (message.document) {
      try {
        const doc = message.document;
        const fileName = doc.file_name || `document_${message.message_id}`;
        const docData = await downloadAndEncodeFile(doc.file_id, fileName);
        
        if (docData.type === 'file_error' || docData.type === 'file_too_large') {
          attachments.push({
            type: 'document',
            fileName: fileName,
            description: 'Document download failed',
            error: docData.error || docData.message
          });
        } else {
          attachments.push({
            type: 'document',
            fileName: docData.fileName,
            fileSize: docData.fileSize,
            mimeType: docData.mimeType,
            description: `Document: ${fileName} (${Math.round(docData.fileSize / 1024)}KB)`
          });
        }
        Logger.log(`Saved document attachment: ${fileName}`);
      } catch (docError) {
        Logger.log(`Error processing document: ${docError.message}`, 'error');
        attachments.push({
          type: 'document',
          description: 'Document processing failed',
          error: docError.message
        });
      }
    }
    
    // Audio files
    if (message.audio) {
      try {
        const audio = message.audio;
        const fileName = audio.file_name || `audio_${message.message_id}.mp3`;
        const audioData = await downloadAndEncodeFile(audio.file_id, fileName);
        
        if (audioData.type === 'file_error' || audioData.type === 'file_too_large') {
          attachments.push({
            type: 'audio',
            duration: audio.duration,
            title: audio.title,
            performer: audio.performer,
            description: 'Audio download failed',
            error: audioData.error || audioData.message
          });
        } else {
          attachments.push({
            type: 'audio',
            duration: audio.duration,
            title: audio.title,
            performer: audio.performer,
            fileName: audioData.fileName,
            fileSize: audioData.fileSize,
            description: `Audio: ${audio.title || fileName} (${Math.floor(audio.duration / 60)}:${(audio.duration % 60).toString().padStart(2, '0')})`
          });
        }
        Logger.log(`Saved audio attachment: ${fileName}`);
      } catch (audioError) {
        Logger.log(`Error processing audio: ${audioError.message}`, 'error');
        attachments.push({
          type: 'audio',
          description: 'Audio processing failed',
          error: audioError.message
        });
      }
    }
    
    // Voice messages
    if (message.voice) {
      try {
        const voice = message.voice;
        const fileName = `voice_${message.message_id}.ogg`;
        const voiceData = await downloadAndEncodeFile(voice.file_id, fileName);
        
        if (voiceData.type === 'file_error' || voiceData.type === 'file_too_large') {
          attachments.push({
            type: 'voice',
            duration: voice.duration,
            description: 'Voice message download failed',
            error: voiceData.error || voiceData.message
          });
        } else {
          // Transcribe voice message using file upload
          try {
            const { OpenAI } = await import('openai');
            const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
            
            // Create a buffer from base64 for file upload
            const base64Data = voiceData.base64Content;
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Write buffer to a temporary file-like object that OpenAI SDK will accept
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');
            
            const tempFileName = path.join(os.tmpdir(), voiceData.fileName);
            await fs.promises.writeFile(tempFileName, buffer);
            
            const transcription = await openai.audio.transcriptions.create({
              file: fs.createReadStream(tempFileName),
              model: "gpt-4o-transcribe",
            });
            
            // Clean up temp file
            fs.promises.unlink(tempFileName).catch(() => {});
            
            const transcriptionText = transcription.text;
            
            attachments.push({
              type: 'voice',
              duration: voice.duration,
              fileName: voiceData.fileName,
              fileSize: voiceData.fileSize,
              description: `Voice message (${voice.duration}s)`,
              transcription: transcriptionText
            });
            
            Logger.log(`Transcribed voice message: ${transcriptionText}`);
          } catch (transcriptionError) {
            Logger.log(`Voice transcription failed: ${transcriptionError.message}`, 'error');
            attachments.push({
              type: 'voice',
              duration: voice.duration,
              fileName: voiceData.fileName,
              fileSize: voiceData.fileSize,
              description: `Voice message (${voice.duration}s) - transcription failed`,
              error: transcriptionError.message
            });
          }
        }
        Logger.log(`Saved voice message attachment`);
      } catch (voiceError) {
        Logger.log(`Error processing voice message: ${voiceError.message}`, 'error');
        attachments.push({
          type: 'voice',
          description: 'Voice message processing failed',
          error: voiceError.message
        });
      }
    }
    
    // Video files
    if (message.video) {
      try {
        const video = message.video;
        const fileName = video.file_name || `video_${message.message_id}.mp4`;
        const videoData = await downloadAndEncodeFile(video.file_id, fileName);
        
        if (videoData.type === 'file_error' || videoData.type === 'file_too_large') {
          attachments.push({
            type: 'video',
            duration: video.duration,
            width: video.width,
            height: video.height,
            description: 'Video download failed',
            error: videoData.error || videoData.message
          });
        } else {
          attachments.push({
            type: 'video',
            duration: video.duration,
            width: video.width,
            height: video.height,
            fileName: videoData.fileName,
            fileSize: videoData.fileSize,
            description: `Video: ${fileName} (${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}, ${video.width}x${video.height})`
          });
        }
        Logger.log(`Saved video attachment: ${fileName}`);
      } catch (videoError) {
        Logger.log(`Error processing video: ${videoError.message}`, 'error');
        attachments.push({
          type: 'video',
          description: 'Video processing failed',
          error: videoError.message
        });
      }
    }
    
    // Video notes (circular videos)
    if (message.video_note) {
      try {
        const videoNote = message.video_note;
        const fileName = `video_note_${message.message_id}.mp4`;
        const videoNoteData = await downloadAndEncodeFile(videoNote.file_id, fileName);
        
        if (videoNoteData.type === 'file_error' || videoNoteData.type === 'file_too_large') {
          attachments.push({
            type: 'video_note',
            duration: videoNote.duration,
            length: videoNote.length,
            description: 'Video note download failed',
            error: videoNoteData.error || videoNoteData.message
          });
        } else {
          attachments.push({
            type: 'video_note',
            duration: videoNote.duration,
            length: videoNote.length,
            fileName: videoNoteData.fileName,
            fileSize: videoNoteData.fileSize,
            description: `Video note (${videoNote.duration}s, circular)`
          });
        }
        Logger.log(`Saved video note attachment`);
      } catch (videoNoteError) {
        Logger.log(`Error processing video note: ${videoNoteError.message}`, 'error');
        attachments.push({
          type: 'video_note',
          description: 'Video note processing failed',
          error: videoNoteError.message
        });
      }
    }
    
    // Stickers
    if (message.sticker) {
      try {
        const sticker = message.sticker;
        const fileName = `sticker_${message.message_id}.webp`;
        const stickerData = await downloadAndEncodeFile(sticker.file_id, fileName);
        
        if (stickerData.type === 'file_error' || stickerData.type === 'file_too_large') {
          attachments.push({
            type: 'sticker',
            emoji: sticker.emoji,
            setName: sticker.set_name,
            description: 'Sticker download failed',
            error: stickerData.error || stickerData.message
          });
        } else {
          attachments.push({
            type: 'sticker',
            emoji: sticker.emoji,
            setName: sticker.set_name,
            fileName: stickerData.fileName,
            fileSize: stickerData.fileSize,
            description: `Sticker: ${sticker.emoji || 'emoji'} from ${sticker.set_name || 'unknown set'}`
          });
        }
        Logger.log(`Saved sticker attachment`);
      } catch (stickerError) {
        Logger.log(`Error processing sticker: ${stickerError.message}`, 'error');
        attachments.push({
          type: 'sticker',
          description: 'Sticker processing failed',
          error: stickerError.message
        });
      }
    }
    
    // Add attachments to message entry
    messageEntry.attachments = attachments;
    
    // Update message text to include attachment info
    if (attachments.length > 0) {
      const attachmentDescriptions = attachments.map(att => {
        if (att.type === 'file_too_large') return `[ATTACHMENT: ${att.fileName} - File too large]`;
        if (att.type === 'file_error') return `[ATTACHMENT: ${att.fileName} - Error: ${att.error}]`;
        return `[ATTACHMENT: ${att.type} file]`;
      });
      
      messageEntry.message_text = `${messageEntry.message_text} ${attachmentDescriptions.join(' ')}`.trim();
    }
        
    // Add to messages array
    existingData.messages.push(messageEntry);
        
    // Save back to S3
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, existingData);
        
    Logger.log(`Saved user message from chat ${chatId}, message ID: ${message.message_id || 'unknown'} with ${attachments.length} attachments`);
    
    // Notify admin if this is a new conversation
    if (isNewConversation) {
      Analytics.trackNewConversation(chatId, message.chat.type);
      await notifyAdminNewConversation(chatId, message);
    }
  } catch (error) {
    Logger.log(`Error saving user message: ${error.message}`, 'error');
  }
}

/**
 * Notify admin when a new conversation starts
 * @param {string|number} chatId - The chat ID  
 * @param {Object} message - The first message from the user
 */
async function notifyAdminNewConversation(chatId, message) {
  try {
    const { TelegramAPI } = await import('../services/telegramAPI.js');
    
    const userName = message.from ? `${message.from.first_name || 'Unknown'} ${message.from.last_name || ''}`.trim() : 'Unknown';
    const chatType = message.chat.type === 'private' ? 'Private Message' : 'Group Message';
    const firstMessage = message.text || message.caption || '[Media/File]';
    
    const notificationMessage = `💬 **New Conversation Started!**

👤 **User Details:**
• **Name**: ${userName}
• **Username**: ${message.from?.username ? `@${message.from.username}` : 'None'}
• **ID**: \`${message.from?.id || 'Unknown'}\`
• **Chat ID**: \`${chatId}\`
• **Type**: ${chatType}
• **Time**: ${new Date().toLocaleString()}

📝 **First Message:**
"${firstMessage.length > 200 ? firstMessage.substring(0, 200) + '...' : firstMessage}"

🤖 _Bot is ready to respond!_`;

    await TelegramAPI.sendMessage(CONFIG.ADMIN_CHAT_ID, notificationMessage, {
      parse_mode: 'Markdown'
    });
    
    Logger.log(`Admin notification sent for new conversation from ${userName} (${chatId})`);
  } catch (error) {
    Logger.log(`Failed to send admin notification for new conversation ${chatId}: ${error.message}`, 'warn');
  }
}

/**
 * Save a bot message to S3 storage
 * @param {string|number} chatId - The chat ID
 * @param {Object} sentMessage - The sent message object from Telegram API
 */
export async function saveBotMessage(chatId, sentMessage) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
        
    // Get existing messages
    const existingData = (await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key)) || { messages: [] };
        
    // Create message entry
    const messageEntry = {
      messageId: sentMessage.message_id,
      message_from: 'Bot',
      message_text: sentMessage.text || '[Bot message]',
      timestamp: {
        unix: Date.now(),
        friendly: new Date().toLocaleString()
      },
      isBot: true,
      chat_title: sentMessage.chat?.title || null
    };
        
    // Add to messages array
    existingData.messages.push(messageEntry);
        
    // Save back to S3
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, existingData);
        
    Logger.log(`Saved bot message to chat ${chatId}, message ID: ${sentMessage.message_id}`);
  } catch (error) {
    Logger.log(`Error saving bot message: ${error.message}`, 'error');
  }
}

/**
 * Get messages from the last N hours
 * @param {string|number} chatId - The chat ID
 * @param {number} hours - Number of hours to look back
 * @returns {Promise<Array>} - Array of messages from the last N hours
 */
export async function getMessagesFromLastNhours(chatId, hours) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
        
    // Get existing messages
    const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    if (!existingData || !existingData.messages) {
      return [];
    }
        
    // Calculate time threshold
    const now = Date.now();
    const hoursInMs = hours * 60 * 60 * 1000;
    const threshold = now - hoursInMs;
        
    // Filter messages from last N hours
    const recentMessages = existingData.messages.filter(msg => {
      return msg.timestamp && msg.timestamp.unix && msg.timestamp.unix > threshold;
    });
        
    Logger.log(`Retrieved ${recentMessages.length} messages from last ${hours} hours for chat ${chatId}`);
    return recentMessages;
        
  } catch (error) {
    Logger.log(`Error getting messages from last ${hours} hours: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Get messages from last N days
 * @param {string|number} chatId - The chat ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} - Array of messages from the last N days
 */
export async function getMessagesFromLastNdays(chatId, days) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
    
    // Get existing messages
    const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    if (!existingData || !existingData.messages) {
      return [];
    }
    
    // Calculate time threshold
    const now = Date.now();
    const daysInMs = days * 24 * 60 * 60 * 1000;
    const threshold = now - daysInMs;
    
    // Filter messages from last N days
    const recentMessages = existingData.messages.filter(msg => {
      return msg.timestamp && msg.timestamp.unix && msg.timestamp.unix > threshold;
    });
    
    Logger.log(`Retrieved ${recentMessages.length} messages from last ${days} days for chat ${chatId}`);
    return recentMessages;
    
  } catch (error) {
    Logger.log(`Error getting messages from last ${days} days: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Get oldest messages from the chat
 * @param {string|number} chatId - The chat ID
 * @param {number} count - Number of oldest messages to retrieve (default: 50)
 * @returns {Promise<Array>} - Array of oldest messages
 */
export async function getOldestMessages(chatId, count = 50) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
    
    // Get existing messages
    const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    if (!existingData || !existingData.messages) {
      return [];
    }
    
    // Sort by timestamp and take the oldest ones
    const sortedMessages = existingData.messages
      .filter(msg => msg.timestamp && msg.timestamp.unix)
      .sort((a, b) => a.timestamp.unix - b.timestamp.unix)
      .slice(0, count);
    
    Logger.log(`Retrieved ${sortedMessages.length} oldest messages for chat ${chatId}`);
    return sortedMessages;
    
  } catch (error) {
    Logger.log(`Error getting oldest messages: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Get messages from a specific date range
 * @param {string|number} chatId - The chat ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} - Array of messages from the date range
 */
export async function getMessagesFromDateRange(chatId, startDate, endDate) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
    
    // Get existing messages
    const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    if (!existingData || !existingData.messages) {
      return [];
    }
    
    // Parse dates
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime() + (24 * 60 * 60 * 1000); // Include full end day
    
    // Filter messages in date range
    const rangeMessages = existingData.messages.filter(msg => {
      if (!msg.timestamp || !msg.timestamp.unix) return false;
      return msg.timestamp.unix >= startTime && msg.timestamp.unix <= endTime;
    });
    
    Logger.log(`Retrieved ${rangeMessages.length} messages from ${startDate} to ${endDate} for chat ${chatId}`);
    return rangeMessages;
    
  } catch (error) {
    Logger.log(`Error getting messages from date range: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Search messages in the current chat
 * @param {string|number} chatId - The chat ID
 * @param {string} searchTerm - Term to search for
 * @param {number} maxResults - Maximum number of results (default: 20)
 * @returns {Promise<string>} - Formatted search results
 */
export async function searchChatMessages(chatId, searchTerm, maxResults = 20) {
  try {
    const key = `fact_checker_bot/groups/${chatId}.json`;
    
    // Get existing messages
    const existingData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    if (!existingData || !existingData.messages) {
      return `No messages found in this chat.`;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const matchingMessages = existingData.messages
      .filter(msg => msg.message_text && msg.message_text.toLowerCase().includes(searchLower))
      .slice(-maxResults) // Get most recent matches
      .reverse(); // Show newest first
    
    if (matchingMessages.length === 0) {
      return `🔍 No messages found containing "${searchTerm}" in this chat.`;
    }
    
    let resultSummary = `🔍 Search Results for "${searchTerm}" (${matchingMessages.length} matches):\n\n`;
    
    matchingMessages.forEach((msg, index) => {
      const timestamp = msg.timestamp?.friendly || 'Unknown time';
      const sender = msg.message_from || 'Unknown';
      const text = msg.message_text;
      const isBot = msg.isBot ? '🤖' : '👤';
      
      // Highlight search term in context
      const highlightedText = text.replace(
        new RegExp(searchTerm, 'gi'), 
        `**${searchTerm.toUpperCase()}**`
      );
      
      resultSummary += `${index + 1}. ${timestamp} ${isBot} ${sender}\n`;
      resultSummary += `   ${highlightedText.substring(0, 200)}${highlightedText.length > 200 ? '...' : ''}\n\n`;
    });
    
    Logger.log(`Found ${matchingMessages.length} messages containing "${searchTerm}" in chat ${chatId}`);
    return resultSummary;
    
  } catch (error) {
    Logger.log(`Error searching chat messages: ${error.message}`, 'error');
    return `Error searching messages: ${error.message}`;
  }
}

/**
 * Get conversation summary for a time period
 * @param {string|number} chatId - The chat ID
 * @param {number} hours - Hours to look back (default: 24)
 * @returns {Promise<string>} - Formatted conversation summary
 */
export async function getConversationSummary(chatId, hours = 24) {
  try {
    const messages = await getMessagesFromLastNhours(chatId, hours);
    
    if (messages.length === 0) {
      return `No conversation activity in the last ${hours} hours.`;
    }
    
    // Count participants
    const participants = new Set();
    const userMessages = messages.filter(msg => !msg.isBot);
    const botMessages = messages.filter(msg => msg.isBot);
    
    userMessages.forEach(msg => participants.add(msg.message_from));
    
    // Find most active participants
    const activityCount = {};
    userMessages.forEach(msg => {
      const user = msg.message_from || 'Unknown';
      activityCount[user] = (activityCount[user] || 0) + 1;
    });
    
    const topUsers = Object.entries(activityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Recent topics (extract from recent messages)
    const recentTopics = messages
      .slice(-10)
      .map(msg => msg.message_text)
      .filter(text => text && text.length > 10)
      .map(text => text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    
    let summary = `📊 Conversation Summary (Last ${hours} hours):\n\n`;
    summary += `💬 Total Messages: ${messages.length} (${userMessages.length} users + ${botMessages.length} bot)\n`;
    summary += `👥 Active Participants: ${participants.size}\n\n`;
    
    if (topUsers.length > 0) {
      summary += `🏆 Most Active Users:\n`;
      topUsers.forEach(([user, count], index) => {
        summary += `   ${index + 1}. ${user}: ${count} messages\n`;
      });
      summary += '\n';
    }
    
    if (recentTopics.length > 0) {
      summary += `💭 Recent Topics:\n`;
      recentTopics.slice(-5).forEach(topic => {
        summary += `   • ${topic}\n`;
      });
    }
    
    Logger.log(`Generated conversation summary for last ${hours} hours in chat ${chatId}`);
    return summary;
    
  } catch (error) {
    Logger.log(`Error generating conversation summary: ${error.message}`, 'error');
    return `Error generating summary: ${error.message}`;
  }
}

/**
 * Analyze images in recent messages using OpenAI Vision
 * @param {string|number} chatId - The chat ID
 * @param {string} query - What to analyze about the images
 * @param {number} lookbackHours - Hours to look back for images (default: 24)
 * @returns {Promise<string>} - Analysis results
 */
export async function analyzeRecentImages(chatId, query, lookbackHours = 24) {
  try {
    Logger.log(`[DEBUG] analyzeRecentImages starting: chatId=${chatId}, query="${query}", lookbackHours=${lookbackHours}`);
    
    // Get recent messages with images
    const messages = await getMessagesFromLastNhours(chatId, lookbackHours);
    Logger.log(`[DEBUG] analyzeRecentImages: getMessagesFromLastNhours returned`, { 
      type: typeof messages, 
      isArray: Array.isArray(messages), 
      length: messages?.length 
    });
    
    if (!messages || !Array.isArray(messages)) {
      Logger.log(`[ERROR] analyzeRecentImages: messages is not an array: ${typeof messages}`, 'error');
      return `Error: Could not retrieve messages from the last ${lookbackHours} hours.`;
    }
    
    const imageMessages = messages.filter(msg => 
      msg.attachments && msg.attachments.some(att => att.type === 'photo')
    );
    
    if (imageMessages.length === 0) {
      return `No images found in the last ${lookbackHours} hours to analyze.`;
    }
    
    Logger.log(`Found ${imageMessages.length} messages with images for analysis`);
    
    // Import OpenAI
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
    
    let analysisResults = `📸 Image Analysis Results for: "${query}"\n`;
    analysisResults += `Found ${imageMessages.length} messages with images in the last ${lookbackHours} hours\n\n`;
    
    for (let i = 0; i < Math.min(imageMessages.length, 5); i++) { // Limit to 5 images
      const msg = imageMessages[i];
      const sender = msg.message_from || 'Unknown User';
      const timestamp = msg.timestamp?.friendly || 'Unknown time';
      const messageText = msg.message_text || '';
      
      const photoAttachments = msg.attachments.filter(att => att.type === 'photo');
      
      analysisResults += `👤 **${sender}** (${timestamp})\n`;
      if (messageText && messageText !== '[No text content]') {
        analysisResults += `💬 Caption: "${messageText}"\n`;
      }
      
      for (let j = 0; j < photoAttachments.length; j++) {
        const photo = photoAttachments[j];
        
        if (photo.type === 'file_error' || photo.type === 'file_too_large') {
          analysisResults += `❌ Could not analyze image: ${photo.error || photo.message}\n\n`;
          continue;
        }
        
        try {
          // Check if we have a stored description instead of trying to re-analyze
          if (photo.description) {
            const analysis = `Previous analysis: ${photo.description}`;
            
            if (photoAttachments.length > 1) {
              analysisResults += `🖼️ Image ${j + 1} of ${photoAttachments.length}:\n`;
            } else {
              analysisResults += `🖼️ Image Analysis:\n`;
            }
            analysisResults += `${analysis}\n\n`;
            
            Logger.log(`Used stored analysis for image from ${sender} (message ${msg.messageId})`);
            continue;
          }
          
          // If no stored description and no dataUrl, we can't analyze
          if (!photo.dataUrl) {
            if (photoAttachments.length > 1) {
              analysisResults += `🖼️ Image ${j + 1} of ${photoAttachments.length}:\n`;
            } else {
              analysisResults += `🖼️ Image Analysis:\n`;
            }
            analysisResults += `❌ Image data not available for re-analysis\n\n`;
            continue;
          }
          
          const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: `User "${sender}" shared this image with caption: "${messageText}". Analyze this image in the context of: "${query}". Provide a detailed description of what you see and how it relates to the query. Include who shared it in your analysis.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: photo.dataUrl
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          });
          
          const analysis = response.choices[0].message.content;
          
          if (photoAttachments.length > 1) {
            analysisResults += `🖼️ Image ${j + 1} of ${photoAttachments.length}:\n`;
          } else {
            analysisResults += `🖼️ Image Analysis:\n`;
          }
          analysisResults += `${analysis}\n\n`;
          
          Logger.log(`Successfully analyzed image from ${sender} (message ${msg.messageId})`);
          
        } catch (error) {
          Logger.log(`Error analyzing image from ${sender} (message ${msg.messageId}): ${error.message}`, 'error');
          analysisResults += `❌ Error analyzing image: ${error.message}\n\n`;
        }
      }
      
      analysisResults += `${'─'.repeat(50)}\n\n`;
    }
    
    if (imageMessages.length > 5) {
      analysisResults += `... and ${imageMessages.length - 5} more images (showing first 5)\n`;
    }
    
    return analysisResults;
    
  } catch (error) {
    Logger.log(`Error in image analysis: ${error.message}`, 'error');
    return `Error analyzing images: ${error.message}`;
  }
}

/**
 * Extract text from images using OCR capabilities
 * @param {string|number} chatId - The chat ID
 * @param {number} lookbackHours - Hours to look back for images (default: 24)
 * @returns {Promise<string>} - Extracted text results
 */
export async function extractTextFromRecentImages(chatId, lookbackHours = 24) {
  try {
    // Get recent messages with images
    const messages = await getMessagesFromLastNhours(chatId, lookbackHours);
    const imageMessages = messages.filter(msg => 
      msg.attachments && msg.attachments.some(att => att.type === 'photo')
    );
    
    if (imageMessages.length === 0) {
      return `No images found in the last ${lookbackHours} hours to extract text from.`;
    }
    
    Logger.log(`Found ${imageMessages.length} messages with images for text extraction`);
    
    // Import OpenAI
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
    
    let extractionResults = `📝 Text Extraction Results\n`;
    extractionResults += `Found ${imageMessages.length} messages with images in the last ${lookbackHours} hours\n\n`;
    
    for (let i = 0; i < Math.min(imageMessages.length, 5); i++) { // Limit to 5 images
      const msg = imageMessages[i];
      const sender = msg.message_from || 'Unknown User';
      const timestamp = msg.timestamp?.friendly || 'Unknown time';
      const messageText = msg.message_text || '';
      
      const photoAttachments = msg.attachments.filter(att => att.type === 'photo');
      
      extractionResults += `👤 **${sender}** (${timestamp})\n`;
      if (messageText && messageText !== '[No text content]') {
        extractionResults += `💬 Caption: "${messageText}"\n`;
      }
      
      for (let j = 0; j < photoAttachments.length; j++) {
        const photo = photoAttachments[j];
        
        if (photo.type === 'file_error' || photo.type === 'file_too_large') {
          extractionResults += `❌ Could not extract text from image: ${photo.error || photo.message}\n\n`;
          continue;
        }
        
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: `This image was shared by user "${sender}" with caption: "${messageText}". Extract ALL text visible in this image. Include any text in signs, documents, screenshots, or any written content. If there's no text, say 'No text found'. Mention who shared the image in your response.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: photo.dataUrl
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          });
          
          const extractedText = response.choices[0].message.content;
          
          if (photoAttachments.length > 1) {
            extractionResults += `📄 Text from Image ${j + 1} of ${photoAttachments.length}:\n`;
          } else {
            extractionResults += `📄 Extracted Text:\n`;
          }
          extractionResults += `${extractedText}\n\n`;
          
          Logger.log(`Successfully extracted text from image by ${sender} (message ${msg.messageId})`);
          
        } catch (error) {
          Logger.log(`Error extracting text from image by ${sender} (message ${msg.messageId}): ${error.message}`, 'error');
          extractionResults += `❌ Error extracting text from image: ${error.message}\n\n`;
        }
      }
      
      extractionResults += `${'─'.repeat(50)}\n\n`;
    }
    
    if (imageMessages.length > 5) {
      extractionResults += `... and ${imageMessages.length - 5} more images (showing first 5)\n`;
    }
    
    return extractionResults;
    
  } catch (error) {
    Logger.log(`Error in text extraction: ${error.message}`, 'error');
    return `Error extracting text from images: ${error.message}`;
  }
}

/**
 * Check if a message has already been processed using S3 for persistence.
 * 
 * @param {string|number} chatId - The chat ID.
 * @param {string|number} messageId - The message ID.
 * @returns {Promise<boolean>} - True if the message has been processed, false otherwise.
 */
export async function isMessageProcessed(chatId, messageId) {
  const key = `fact_checker_bot/processed_messages/${chatId}/${messageId}.json`;
  try {
    const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    return data !== null;
  } catch (error) {
    Logger.log(`Error checking if message ${chatId}:${messageId} was processed: ${error.message}`, 'error');
    return false; // Assume not processed on error to avoid blocking
  }
}

/**
 * Mark a message as processed by saving its ID to S3.
 * 
 * @param {string|number} chatId - The chat ID.
 * @param {string|number} messageId - The message ID.
 * @returns {Promise<void>}
 */
export async function markMessageAsProcessed(chatId, messageId) {
  const key = `fact_checker_bot/processed_messages/${chatId}/${messageId}.json`;
  try {
    await S3Manager.saveToS3(CONFIG.S3_BUCKET_NAME, key, { processed: true, timestamp: Date.now() });
  } catch (error) {
    Logger.log(`Error marking message ${chatId}:${messageId} as processed: ${error.message}`, 'error');
    // Do not rethrow, processing should continue even if marking fails
  }
}

/**
 * Clear all messages for a specific chat by deleting them from S3
 * 
 * @param {string|number} chatId - The chat ID to clear messages for
 * @returns {Promise<number>} - Number of messages deleted
 */
export async function clearMessagesForChat(chatId) {
  try {
    Logger.log(`Clearing all messages for chat ${chatId}`);
    
    const prefix = `messages/chat-${chatId}/`;
    
    // List all objects with the chat prefix
    const listResult = await S3Manager.listObjects(prefix);
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      Logger.log(`No messages found for chat ${chatId}`);
      return 0;
    }
    
    // Delete all message files
    const deletePromises = listResult.Contents.map(async (object) => {
      try {
        await S3Manager.deleteObject(CONFIG.S3_BUCKET_NAME, object.Key);
        return true;
      } catch (error) {
        Logger.log(`Error deleting ${object.Key}: ${error.message}`, 'error');
        return false;
      }
    });
    
    const results = await Promise.all(deletePromises);
    const deletedCount = results.filter(success => success).length;
    
    Logger.log(`Successfully deleted ${deletedCount}/${listResult.Contents.length} messages for chat ${chatId}`);
    return deletedCount;
    
  } catch (error) {
    Logger.log(`Error clearing messages for chat ${chatId}: ${error.message}`, 'error');
    throw error;
  }
}