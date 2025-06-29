/**
 * Audio Generation Tool - Text-to-Speech using Replicate API
 * 
 * This tool generates audio files from text using the Chatterbox TTS model
 * via Replicate API. Should only be used when user specifically requests
 * audio output, voice files, or podcast-style content.
 */

import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Generate audio from text using Replicate API
 * @param {string} text - Text to convert to speech
 * @param {Object} options - Generation options
 * @param {number} options.seed - Random seed (default: 0)
 * @param {number} options.cfg_weight - CFG weight (default: 0.5)
 * @param {number} options.temperature - Temperature (default: 0.8)
 * @param {number} options.exaggeration - Emotion exaggeration (default: 0.5)
 * @returns {Promise<Buffer>} Audio file buffer
 */
export async function generateAudio(text, options = {}) {
  if (!CONFIG.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for audio generation');
  }

  // Limit text length to ~60 seconds of speech (approximately 150 words)
  // At normal speech rate (~150 words/min), 60 seconds = ~150 words
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 150) {
    const words = text.split(/\s+/).slice(0, 150);
    text = words.join(' ') + '...';
    Logger.log(`Text truncated from ${wordCount} to 150 words for 1-minute audio limit`, 'warn');
  }

  const {
    seed = 0,
    cfg_weight = 0.5,
    temperature = 0.8,
    exaggeration = 0.5
  } = options;

  Logger.log(`Generating audio for text (${text.length} chars) with Replicate API`);

  try {
    // Make request to Replicate API
    const response = await axios.post(
      'https://api.replicate.com/v1/models/resemble-ai/chatterbox/predictions',
      {
        input: {
          seed,
          prompt: text,
          cfg_weight,
          temperature,
          exaggeration
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        timeout: 120000 // 2 minute timeout for audio generation
      }
    );

    Logger.log(`Replicate API response status: ${response.status}`);

    if (response.data && response.data.output) {
      // The output should be a URL to the generated audio file
      const audioUrl = response.data.output;
      Logger.log(`Audio generated successfully: ${audioUrl}`);

      // Download the audio file
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      const audioBuffer = Buffer.from(audioResponse.data);
      Logger.log(`Downloaded audio file: ${audioBuffer.length} bytes`);

      return audioBuffer;
    } else {
      throw new Error('No audio output received from Replicate API');
    }

  } catch (error) {
    if (error.response) {
      Logger.log(`Replicate API error (${error.response.status}): ${JSON.stringify(error.response.data)}`, 'error');
      throw new Error(`Audio generation failed: ${error.response.data.detail || error.response.statusText}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Audio generation timed out - text may be too long');
    } else {
      Logger.log(`Audio generation error: ${error.message}`, 'error');
      throw new Error(`Audio generation failed: ${error.message}`);
    }
  }
}

/**
 * Validate if audio generation should be used based on user request
 * @param {string} userQuery - User's query
 * @returns {boolean} True if audio generation is appropriate
 */
export function shouldGenerateAudio(userQuery) {
  const audioKeywords = [
    'audio', 'voice', 'speech', 'sound', 'listen', 'hear',
    'podcast', 'narrat', 'speak', 'say', 'tell me',
    'voice message', 'audio file', 'sound file',
    'read aloud', 'read out', 'voice over'
  ];

  const query = userQuery.toLowerCase();
  return audioKeywords.some(keyword => query.includes(keyword));
}

/**
 * Generate audio with smart text preprocessing
 * @param {string} text - Text to convert
 * @param {Object} options - Generation options
 * @returns {Promise<{buffer: Buffer, metadata: Object}>} Audio buffer and metadata
 */
export async function generateAudioSmart(text, options = {}) {
  // Clean and optimize text for speech
  let cleanText = text
    // Remove excessive markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    // Remove links but keep link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove excessive emojis (keep first few)
    .replace(/([\u{1F600}-\u{1F64F}][\u{1F300}-\u{1F5FF}][\u{1F680}-\u{1F6FF}][\u{1F1E0}-\u{1F1FF}]){3,}/gu, '')
    // Replace newlines with proper pauses
    .replace(/\n\n/g, '. ')
    .replace(/\n/g, ', ')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Add natural speech markers for better audio
  if (cleanText.length > 50) {
    // Add slight pauses after sentences
    cleanText = cleanText.replace(/\. /g, '. ... ');
  }

  const audioBuffer = await generateAudio(cleanText, options);
  
  // Use word-based duration estimation (150 words per minute = 2.5 words per second)
  const wordCount = cleanText.split(/\s+/).length;
  const actualDuration = Math.min(wordCount / 2.5, 60);
  
  const metadata = {
    originalLength: text.length,
    processedLength: cleanText.length,
    originalWordCount: text.split(/\s+/).length,
    processedWordCount: wordCount,
    estimatedDuration: actualDuration, // ~2.5 words per second, max 60 seconds
    actualDuration: actualDuration,
    options: options
  };

  return {
    buffer: audioBuffer,
    metadata: metadata
  };
}

export default {
  generateAudio,
  generateAudioSmart,
  shouldGenerateAudio
};