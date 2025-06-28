import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Logger } from '../utils/logger.js';

// Set ffmpeg paths for Lambda layer
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // serverlesspub FFmpeg layer stores binaries in /opt/bin/
  const ffmpegPath = '/opt/bin/ffmpeg';
  const ffprobePath = '/opt/bin/ffprobe';
  
  if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    Logger.log(`FFmpeg configured: ${ffmpegPath} and ${ffprobePath}`);
  } else {
    Logger.log(`FFmpeg binaries not found - ffmpeg: ${fs.existsSync(ffmpegPath)}, ffprobe: ${fs.existsSync(ffprobePath)}`, 'error');
    
    // List contents of /opt/ for debugging
    try {
      const optContents = fs.readdirSync('/opt');
      Logger.log(`/opt contents: ${optContents.join(', ')}`);
      
      if (optContents.includes('bin')) {
        const binContents = fs.readdirSync('/opt/bin');
        Logger.log(`/opt/bin contents: ${binContents.join(', ')}`);
      }
    } catch (e) {
      Logger.log(`Error listing /opt contents: ${e.message}`, 'error');
    }
  }
} else {
  Logger.log('Running locally - FFmpeg paths not set');
}

/**
 * Extract keyframes from a video/GIF buffer
 * @param {Buffer} buffer - Video/GIF file buffer
 * @param {number} duration - Duration in seconds
 * @param {string} mimeType - File MIME type
 * @returns {Promise<{frames: Buffer[], metadata: Object}>} - Array of frame buffers and metadata
 */
export async function extractVideoFrames(buffer, duration, mimeType) {
  return new Promise((resolve) => {
    try {
      // Create temporary files with unique timestamp
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const inputFile = path.join(tempDir, `input_${timestamp}.${mimeType === 'video/mp4' ? 'mp4' : 'gif'}`);
      const outputPrefix = `frame_${timestamp}`;
      const outputPattern = path.join(tempDir, `${outputPrefix}_%03d.jpg`);
      
      // Write buffer to temporary file
      fs.writeFileSync(inputFile, buffer);
      
      // Calculate frame extraction settings
      // Extract 1 frame per second, maximum 8 frames for analysis
      const maxFrames = Math.min(8, Math.max(2, Math.ceil(duration)));
      const frameRate = maxFrames / duration;
      
      Logger.log(`Extracting frames: duration=${duration}s, maxFrames=${maxFrames}, frameRate=${frameRate}fps`);
      
      const extractedFrames = [];
      
      ffmpeg(inputFile)
        .outputOptions([
          '-vf', `fps=${frameRate}:round=up`, // Extract frames at calculated rate
          '-vframes', maxFrames.toString(), // Limit number of frames
          '-q:v', '3', // Good quality (scale 1-31, lower is better)
          '-s', '640x480' // Resize for faster processing
        ])
        .output(outputPattern)
        .on('start', (commandLine) => {
          Logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          Logger.log(`Processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          try {
            Logger.log('Frame extraction completed');
            
            // Read extracted frames
            const files = fs.readdirSync(tempDir).filter(file => 
              file.startsWith(outputPrefix) && file.endsWith('.jpg')
            );
            
            files.sort(); // Ensure correct chronological order
            Logger.log(`Found ${files.length} extracted frames`);
            
            for (const file of files) {
              const framePath = path.join(tempDir, file);
              if (fs.existsSync(framePath)) {
                const frameBuffer = fs.readFileSync(framePath);
                extractedFrames.push(frameBuffer);
                // Clean up frame file immediately
                fs.unlinkSync(framePath);
              }
            }
            
            // Clean up input file
            if (fs.existsSync(inputFile)) {
              fs.unlinkSync(inputFile);
            }
            
            resolve({
              frames: extractedFrames,
              metadata: {
                originalDuration: duration,
                extractedFrames: extractedFrames.length,
                frameRate: frameRate,
                mimeType: mimeType
              }
            });
          } catch (readError) {
            Logger.log(`Error reading extracted frames: ${readError.message}`, 'error');
            resolve({ frames: [], metadata: { error: readError.message } });
          }
        })
        .on('error', (err) => {
          Logger.log(`FFmpeg extraction error: ${err.message}`, 'error');
          
          // Clean up files on error
          try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            
            // Clean up any frame files that might have been created
            const files = fs.readdirSync(tempDir).filter(file => 
              file.startsWith(outputPrefix) && file.endsWith('.jpg')
            );
            files.forEach(file => {
              try {
                fs.unlinkSync(path.join(tempDir, file));
              } catch (e) {
                // Ignore cleanup errors
              }
            });
          } catch (cleanupError) {
            Logger.log(`Cleanup error: ${cleanupError.message}`, 'error');
          }
          
          resolve({ 
            frames: [], 
            metadata: { 
              error: err.message,
              ffmpegAvailable: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'yes' : 'unknown'
            } 
          });
        })
        .run();
        
    } catch (error) {
      Logger.log(`Video processing setup error: ${error.message}`, 'error');
      resolve({ frames: [], metadata: { error: error.message } });
    }
  });
}

/**
 * Analyze video frames using OpenAI Vision API
 * @param {Buffer[]} frames - Array of frame buffers
 * @param {Object} metadata - Video metadata
 * @param {Object} openai - OpenAI client instance
 * @returns {Promise<string>} - Analysis description
 */
export async function analyzeVideoFrames(frames, metadata, openai) {
  try {
    if (frames.length === 0) {
      return `Video frame extraction failed: ${metadata.error || 'Unknown error'}`;
    }
    
    Logger.log(`Analyzing ${frames.length} video frames`);
    
    // Analyze each frame and create a comprehensive description
    const frameAnalyses = [];
    
    for (let i = 0; i < frames.length; i++) {
      const frameBase64 = frames[i].toString('base64');
      const frameDataUrl = `data:image/jpeg;base64,${frameBase64}`;
      
      try {
        const frameResponse = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Describe this frame from a ${metadata.originalDuration}s ${metadata.mimeType === 'video/mp4' ? 'video' : 'GIF'} (frame ${i + 1}/${frames.length}). ${metadata.mimeType === 'image/gif' ? 'This is likely a meme, reaction GIF, or animated content. Look for text, emotional expressions, humor, or meme elements.' : ''} Focus on key visual elements, actions, objects, people, and any text visible.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: frameDataUrl,
                    detail: "low" // Use low detail for faster processing
                  }
                }
              ]
            }
          ],
          max_tokens: 120
        });
        
        const frameDescription = frameResponse.choices[0].message.content;
        frameAnalyses.push(`Frame ${i + 1}: ${frameDescription}`);
        
        Logger.log(`Frame ${i + 1} analyzed successfully`);
        
      } catch (frameError) {
        Logger.log(`Frame ${i + 1} analysis failed: ${frameError.message}`, 'error');
        frameAnalyses.push(`Frame ${i + 1}: Analysis failed - ${frameError.message}`);
      }
    }
    
    // Create comprehensive analysis
    const mediaType = metadata.mimeType === 'video/mp4' ? 'Video' : 'GIF';
    const memeContext = metadata.mimeType === 'image/gif' ? ' (Likely meme/reaction content)' : '';
    const analysisHeader = `${mediaType} Analysis${memeContext} (${metadata.originalDuration}s, ${frames.length} frames extracted):`;
    const frameDescriptions = frameAnalyses.join('\n\n');
    
    return `${analysisHeader}\n\n${frameDescriptions}`;
    
  } catch (error) {
    Logger.log(`Video analysis error: ${error.message}`, 'error');
    return `Video analysis failed: ${error.message}`;
  }
}

/**
 * Process video/GIF and return analysis
 * @param {Buffer} buffer - Video file buffer
 * @param {Object} videoInfo - Video information (duration, width, height, etc.)
 * @param {string} mimeType - File MIME type
 * @param {Object} openai - OpenAI client instance
 * @returns {Promise<string>} - Complete video analysis
 */
export async function processVideo(buffer, videoInfo, mimeType, openai) {
  try {
    Logger.log(`Processing ${mimeType} video: ${videoInfo.duration}s, ${videoInfo.width}x${videoInfo.height}`);
    
    // Extract frames from video
    const { frames, metadata } = await extractVideoFrames(buffer, videoInfo.duration, mimeType);
    
    if (frames.length === 0) {
      return `${mimeType === 'video/mp4' ? 'Video' : 'GIF'} processing failed: ${metadata.error || 'Could not extract frames'}`;
    }
    
    // Analyze extracted frames
    const analysis = await analyzeVideoFrames(frames, metadata, openai);
    
    return analysis;
    
  } catch (error) {
    Logger.log(`Video processing error: ${error.message}`, 'error');
    return `Video processing failed: ${error.message}`;
  }
}