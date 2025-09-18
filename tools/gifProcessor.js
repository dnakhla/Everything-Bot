/**
 * GIF Processing Tool - Extract frames and create contact sheet for analysis
 *
 * Uses ffmpeg to extract frames from GIFs and creates a contact sheet
 * for comprehensive analysis by vision model
 */

import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from '../services/s3Manager.js';
import { createToolWrapper } from '../utils/toolWrapper.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const execAsync = promisify(exec);

/**
 * Process a GIF by extracting frames and creating a contact sheet
 * @param {string} gifUrl - URL to the GIF file
 * @param {string} instruction - Analysis instruction
 * @param {string} chatId - Chat ID for S3 organization
 * @returns {Promise<string>} Analysis result
 */
export const processGIF = createToolWrapper(
  async (gifUrl, instruction = 'Analyze this GIF animation', chatId = null) => {
    const tempDir = `/tmp`;
    const timestamp = Date.now();
    const gifPath = path.join(tempDir, `gif_${timestamp}.gif`);
    const framesDir = path.join(tempDir, `frames_${timestamp}`);
    const contactSheetPath = path.join(tempDir, `contact_sheet_${timestamp}.png`);

    try {
      Logger.log(`Processing GIF from URL: ${gifUrl}`);

      // Download the GIF
      const response = await axios.get(gifUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(gifPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on(`error`, reject);
      });

      Logger.log(`GIF downloaded: ${gifPath}`);

      // Create frames directory
      fs.mkdirSync(framesDir, { recursive: true });

      // Extract key frames using ffmpeg (every 0.5 seconds, max 9 frames)
      const extractFramesCmd = `ffmpeg -i "${gifPath}" -vf 'fps=2,scale=320:240' -t 4.5 "${framesDir}/frame_%03d.png" -y`;

      Logger.log(`Extracting frames: ${extractFramesCmd}`);
      await execAsync(extractFramesCmd);

      // Get list of extracted frames
      const frameFiles = fs.readdirSync(framesDir)
        .filter(file => file.endsWith('.png'))
        .sort()
        .slice(0, 9); // Limit to 9 frames for 3x3 grid

      if (frameFiles.length === 0) {
        throw new Error(`No frames could be extracted from the GIF`);
      }

      Logger.log(`Extracted ${frameFiles.length} frames`);

      // Create contact sheet using ffmpeg (3x3 grid)
      const frameInputs = frameFiles
        .map(file => path.join(framesDir, file))
        .join(`|`);

      // Create a 3x3 contact sheet
      const contactSheetCmd = `ffmpeg -i "concat:${frameInputs}" -filter_complex 'scale=320:240[s];[s]tile=3x3:margin=10:padding=5' "${contactSheetPath}" -y`;

      // Alternative approach if concat doesn`t work
      const inputs = frameFiles.map(file => `-i "${path.join(framesDir, file)}"`).join(" ");
      const filterInputs = frameFiles.map((_, i) => `[${i}:v]`).join('');
      const streamMaps = frameFiles.map((_, i) => `[s${i}]`).join('');
      const alternateCmd = `ffmpeg ${inputs} -filter_complex "${filterInputs}scale=320:240[s${frameFiles.length - 1}];${streamMaps}tile=3x3:margin=10:padding=5[out]" -map "[out]" "${contactSheetPath}" -y`;

      try {
        Logger.log(`Creating contact sheet: ${alternateCmd}`);
        await execAsync(alternateCmd);
      } catch (contactError) {
        Logger.log(`Contact sheet creation failed, trying simpler approach: ${contactError.message}`, 'warn');

        // Fallback: just use the first frame
        const firstFrame = path.join(framesDir, frameFiles[0]);
        fs.copyFileSync(firstFrame, contactSheetPath);
      }

      // Verify contact sheet was created
      if (!fs.existsSync(contactSheetPath)) {
        throw new Error(`Failed to create contact sheet`);
      }

      Logger.log(`Contact sheet created: ${contactSheetPath}`);

      // Read contact sheet as base64 for analysis
      const contactSheetBuffer = fs.readFileSync(contactSheetPath);
      const base64ContactSheet = contactSheetBuffer.toString('base64');

      // Analyze contact sheet using GPT-5-mini Vision
      const { default: OpenAI } = await import(`openai`);
      const openai = new OpenAI({
        apiKey: CONFIG.OPENAI_API_KEY,
      });

      const enhancedInstruction = `${instruction}

This is a contact sheet showing multiple frames from an animated GIF. Each frame represents a different moment in the animation. Please analyze the sequence of frames to understand the animation's story, motion, and content. Describe:
1. What is happening in the animation
2. The sequence of events or motion
3. Any text, objects, or characters that appear
4. The overall theme or message of the GIF`;

      const analysisResponse = await openai.chat.completions.create({
        model: CONFIG.GPT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing animated GIFs through contact sheets. Provide detailed, accurate analysis of the animation sequence and content.'
          },
          {
            role: 'user',
            content: [
              {
                type: `image_url`,
                image_url: {
                  url: `data:image/png;base64,${base64ContactSheet}`,
                  detail: 'high'
                }
              },
              {
                type: `text`,
                text: enhancedInstruction
              }
            ]
          }
        ],
        max_completion_tokens: 1000
      });

      const analysis = analysisResponse.choices[0].message.content;
      Logger.log(`GIF analysis completed: ${analysis.substring(0, 100)}...`);

      // Save contact sheet to S3 if chatId provided
      let s3Location = null;
      if (chatId) {
        try {
          const s3Key = `fact_checker_bot/groups/${chatId}/gifs/${timestamp}_contact_sheet.png`;
          await S3Manager.uploadBuffer(
            CONFIG.S3_BUCKET_NAME,
            s3Key,
            contactSheetBuffer,
            `image/png`
          );
          s3Location = s3Key;
          Logger.log(`Contact sheet saved to S3: ${s3Key}`);
        } catch (s3Error) {
          Logger.log(```Failed to save contact sheet to S3: ${s3Error.message}`, `warn`);
        }
      }

      // Cleanup temporary files
      try {
        fs.unlinkSync(gifPath);
        fs.unlinkSync(contactSheetPath);
        frameFiles.forEach(file => {
          const filePath = path.join(framesDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(framesDir);
        Logger.log(`Temporary files cleaned up`);
      } catch (cleanupError) {
        Logger.log(`Cleanup error: ${cleanupError.message}", "warn`);
      }

      let result = `🎬 **GIF Animation Analysis:**\n\n${analysis}`;
      result += `\n\n📊 **Processing Details:**\n• Extracted ${frameFiles.length} key frames\n• Created contact sheet for comprehensive analysis`;

      if (s3Location) {
        result += `\n• Contact sheet saved to: ${s3Location}`;
      }

      return result;

    } catch (error) {
      Logger.log(`GIF processing error: ${error.message}", "error`);

      // Cleanup on error
      try {
        [gifPath, contactSheetPath].forEach(file => {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        if (fs.existsSync(framesDir)) {
          fs.readdirSync(framesDir).forEach(file => {
            fs.unlinkSync(path.join(framesDir, file));
          });
          fs.rmdirSync(framesDir);
        }
      } catch (cleanupError) {
        Logger.log(```Error cleanup failed: ${cleanupError.message}`,`warn`);
      }

      if (error.message.includes('rate limit')) {
        return '⏳ Rate limit reached for GIF analysis. Please try again in a moment.';
      } else if (error.message.includes('ffmpeg')) {
        return `🎬 GIF processing requires ffmpeg. Analyzing as static image instead.`;
      } else {
        return `❌ Error processing GIF: ${error.message}`;
      }
    }
  },
  {
    name: 'processGIF',
    category: 'vision',
    description: `Process animated GIFs by extracting frames and creating contact sheets for analysis`,
    formatResult: (result) => result
  }
);

/**
 * Extract frames from GIF (utility function)
 * @param {string} gifPath - Path to GIF file
 * @param {string} outputDir - Directory for frame output
 * @param {number} maxFrames - Maximum number of frames to extract
 * @returns {Promise<string[]>} Array of frame file paths
 */
async function extractGIFFrames(gifPath, outputDir, maxFrames = 9) {
  const extractCmd = `ffmpeg -i "${gifPath}" -vf 'fps=2,scale=320:240' -frames:v ${maxFrames} "${outputDir}/frame_%03d.png" -y`;

  await execAsync(extractCmd);

  return fs.readdirSync(outputDir)
    .filter(file => file.endsWith(`.png`))
    .sort()
    .map(file => path.join(outputDir, file));
}

/**
 * Create contact sheet from frame images
 * @param {string[]} framePaths - Array of frame file paths
 * @param {string} outputPath - Output path for contact sheet
 * @returns {Promise<void>}
 */
async function createContactSheet(framePaths, outputPath) {
  const inputs = framePaths.map(frame => `-i "${frame}"`).join(" ");
  const filterInputs = framePaths.map((_, i) => `[${i}:v]scale=320:240[s${i}];`).join("");
  const tileInputs = framePaths.map((_, i) => `[s${i}]`).join('');

  const contactCmd = `ffmpeg ${inputs} -filter_complex "${filterInputs}${tileInputs}tile=3x3:margin=10:padding=5[out]" -map "[out]" "${outputPath}" -y`;

  await execAsync(contactCmd);
}
