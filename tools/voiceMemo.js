/**
 * Voice Memo Tool - Text-to-Speech using OpenAI TTS API
 *
 * Creates high-quality voice memos using OpenAI's text-to-speech capabilities
 * and saves them to S3 with proper chat organization
 */

import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { S3Manager } from '../services/s3Manager.js';
import { createToolWrapper } from '../utils/toolWrapper.js';
import fs from 'fs';
import path from 'path';

/**
 * Analyze text content and context to determine optimal voice characteristics
 * @param {string} text - Text content to analyze
 * @param {string} requestedVoice - User's requested voice (if any)
 * @param {string} requestedEmotion - User's requested emotion (if any)
 * @param {Object} context - Additional context (message history, chat tone, etc.)
 * @returns {Object} Voice configuration with rationale
 */
function analyzeOptimalVoice(text, requestedVoice, requestedEmotion, context = {}) {
  const analysis = {
    voiceId: requestedVoice || 'Friendly_Person',
    emotion: requestedEmotion || 'auto',
    speed: 1.0,
    rationale: []
  };

  // Analyze text content for tone indicators
  const textLower = text.toLowerCase();
  const urgentWords = ['urgent', 'emergency', 'asap', 'quickly', 'immediately', 'breaking'];
  const calmWords = ['relax', 'calm', 'peaceful', 'meditate', 'gentle', 'soft'];
  const excitedWords = ['amazing', 'awesome', 'incredible', 'fantastic', 'wow', '!', 'great', 'excellent'];
  const seriousWords = ['important', 'critical', 'serious', 'warning', 'attention', 'alert'];
  const formalWords = ['furthermore', 'however', 'therefore', 'consequently', 'moreover', 'analysis'];
  const casualWords = ['hey', 'yo', 'sup', 'lol', 'btw', 'gonna', 'wanna'];

  // Content analysis
  const hasUrgent = urgentWords.some(word => textLower.includes(word));
  const hasCalm = calmWords.some(word => textLower.includes(word));
  const hasExcited = excitedWords.some(word => textLower.includes(word)) || (text.match(/!/g) || []).length > 2;
  const hasSerious = seriousWords.some(word => textLower.includes(word));
  const hasFormal = formalWords.some(word => textLower.includes(word));
  const hasCasual = casualWords.some(word => textLower.includes(word));

  // Voice selection logic (override only if no specific voice requested)
  if (!requestedVoice) {
    if (hasSerious || hasFormal) {
      analysis.voiceId = 'Deep_Voice_Man';
      analysis.rationale.push('Selected authoritative voice for serious/formal content');
    } else if (hasCasual) {
      analysis.voiceId = 'Casual_Guy';
      analysis.rationale.push('Selected casual voice for informal content');
    } else if (hasExcited) {
      analysis.voiceId = 'Lively_Girl';
      analysis.rationale.push('Selected energetic voice for excited content');
    } else if (hasCalm) {
      analysis.voiceId = 'Calm_Woman';
      analysis.rationale.push(`Selected calm voice for peaceful content`);
    }
  } else {
    analysis.rationale.push(`Using requested voice: ${requestedVoice}`);
  }

  // Emotion analysis (override only if no specific emotion requested)
  if (!requestedEmotion || requestedEmotion === 'auto') {
    if (hasExcited) {
      analysis.emotion = 'happy';
      analysis.rationale.push('Detected excited tone - using happy emotion');
    } else if (hasSerious) {
      analysis.emotion = 'neutral';
      analysis.rationale.push('Detected serious tone - using neutral emotion');
    } else if (hasCalm) {
      analysis.emotion = 'calm';
      analysis.rationale.push('Detected calm tone - using calm emotion');
    } else {
      analysis.emotion = 'neutral';
      analysis.rationale.push(`Default neutral emotion for balanced delivery`);
    }
  } else {
    analysis.rationale.push(`Using requested emotion: ${requestedEmotion}`);
  }

  // Speed analysis
  if (hasUrgent) {
    analysis.speed = 1.2;
    analysis.rationale.push('Increased speed for urgent content');
  } else if (hasCalm || text.length > 800) {
    analysis.speed = 0.9;
    analysis.rationale.push('Reduced speed for calm or long content');
  } else if (hasExcited) {
    analysis.speed = 1.1;
    analysis.rationale.push('Slightly increased speed for excited content');
  }

  // Text length considerations
  if (text.length > 600) {
    analysis.speed = Math.max(0.8, analysis.speed - 0.1);
    analysis.rationale.push('Adjusted speed down for longer text');
  }

  return analysis;
}

/**
 * Create a voice memo using OpenAI TTS API with intelligent voice selection
 * @param {string} text - Text to convert to speech (max 1200 chars = ~1 minute)
 * @param {string} voiceId - Voice character to use (will be analyzed if 'auto')
 * @param {string} emotion - Emotional tone (auto, neutral, happy, etc.)
 * @param {number} speed - Speech speed (0.5-2.0, will be analyzed if 'auto')
 * @param {string} title - Optional title for the memo
 * @param {string} chatId - Chat ID for S3 organization
 * @param {Object} context - Additional context for voice analysis
 * @returns {Promise<string>} Result with S3 location and download info
 */
export const createVoiceMemo = createToolWrapper(
  async (text, voiceId = 'auto', emotion = 'auto', speed = 'auto', title = ``, chatId = null, context = {}) => {
    try {
      Logger.log(`Creating voice memo: ${text.substring(0, 100)}... (${text.length} chars)`);

      if (text.length > 1200) {
        return '❌ Error: Text is too long. Maximum 1200 characters allowed (~1 minute of speech).';
      }

      // Analyze optimal voice characteristics
      const voiceAnalysis = analyzeOptimalVoice(
        text,
        voiceId === 'auto' ? null : voiceId,
        emotion === 'auto' ? null : emotion,
        context
      );

      // Use analyzed characteristics
      const finalVoiceId = voiceAnalysis.voiceId;
      const finalEmotion = voiceAnalysis.emotion;
      const finalSpeed = speed === `auto` ? voiceAnalysis.speed : speed;

      Logger.log(`Voice Analysis: ${finalVoiceId}, emotion: ${finalEmotion}, speed: ${finalSpeed}`);
      if (voiceAnalysis.rationale.length > 0) {
        Logger.log(`Voice Rationale: ${voiceAnalysis.rationale.join('; ')}`);
      }

      // Clean text for TTS - process pause markers <#x#>
      const cleanText = text.replace(/<#(\d+(?:\.\d+)?)#>/g, (match, seconds) => {
        // Convert to natural pauses
        const pauseDots = Math.max(1, Math.round(parseFloat(seconds)));
        return ` ... `.repeat(pauseDots);
      });

      Logger.log(`Using Replicate Chatterbox TTS with emotion: ${finalEmotion}, speed: ${finalSpeed}`);

      // Map emotions to exaggeration levels for Chatterbox (must be >= 0.25)
      const exaggerationMapping = {
        'neutral': 0.5,
        'calm': 0.25,
        'happy': 0.7,
        'excited': 0.8,
        'auto': 0.5
      };

      const exaggeration = Math.max(0.25, exaggerationMapping[finalEmotion] || 0.5);

      // Generate speech using Replicate HTTP API directly
      const requestBody = {
        input: {
          prompt: cleanText,
          exaggeration: exaggeration,
          cfg: finalSpeed > 1 ? 0.3 : 0.5
        }
      };

      const response = await fetch('https://api.replicate.com/v1/models/resemble-ai/chatterbox/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.status} ${response.statusText}`);
      }

      const output = await response.json();

      // Fetch the audio file from the output URL
      let audioBuffer;
      Logger.log(`Replicate output type: ${typeof output}, value: ${JSON.stringify(output)}`);

      let audioUrl = null;

      if (output && typeof output === 'string' && output.startsWith('http')) {
        // Output is a direct URL string
        audioUrl = output;
      } else if (output && typeof output.output === 'string' && output.output.startsWith('http')) {
        // Replicate HTTP API returns { output: "url" }
        audioUrl = output.output;
      } else if (output && output.output && Array.isArray(output.output) && output.output.length > 0) {
        // Replicate HTTP API returns { output: [url] }
        audioUrl = output.output[0];
      } else if (output && output.url && typeof output.url === 'string') {
        // Output is an object with url property
        audioUrl = output.url;
      } else if (output && Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
        // Output is an array with URL at index 0
        audioUrl = output[0];
      } else {
        Logger.log(`Failed to extract URL from Replicate response. Type: ${typeof output}, Keys: ${output ? Object.keys(output) : 'null'}`, 'error');
        Logger.log(`Full response structure: ${JSON.stringify(output, null, 2)}`, 'error');
        throw new Error(`Unable to extract audio URL from Replicate response. Got: ${JSON.stringify(output)}`);
      }

      Logger.log(`Fetching audio from URL: ${audioUrl}`);
      const audioResponse = await fetch(audioUrl);

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
      }

      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      Logger.log(`Generated audio: ${audioBuffer.length} bytes`);

      // Save to S3 with organized structure
      let s3Location = null;
      let s3Url = null;

      if (chatId) {
        const timestamp = Date.now();
        const cleanTitle = title ? title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) : `voice_memo`;
        const s3Key = `fact_checker_bot/groups/${chatId}/audio/${timestamp}_${cleanTitle}.mp3`;

        try {
          await S3Manager.uploadBuffer(
            CONFIG.S3_BUCKET_NAME,
            s3Key,
            audioBuffer,
            `audio/mpeg`
          );
          s3Location = s3Key;
          s3Url = `https://${CONFIG.S3_BUCKET_NAME}.s3.${CONFIG.AWS_REGION}.amazonaws.com/${s3Key}`;
          Logger.log(`Audio saved to S3: ${s3Key}`);
        } catch (s3Error) {
          Logger.log(`Failed to save audio to S3: ${s3Error.message}`, 'warn');
          // Continue even if S3 save fails
        }
      }

      // Format response with structured data for voice message sending
      const duration = Math.round(audioBuffer.length / 24000); // Rough estimate: ~24KB per second for MP3

      // Return structured data that can be used by the agent executor to send voice messages
      const result = {
        type: 'voice_memo',
        success: true,
        audioBuffer: audioBuffer,
        s3Url: s3Url,
        s3Location: s3Location,
        metadata: {
          title: title || `Voice Memo`,
          voiceId: finalVoiceId,
          originalVoiceRequest: voiceId,
          emotion: finalEmotion,
          speed: finalSpeed,
          originalSpeedRequest: speed,
          duration: duration,
          size: Math.round(audioBuffer.length / 1024),
          text: text.substring(0, 200), // Keep first 200 chars for caption
          voiceAnalysis: voiceAnalysis.rationale
        },
        // Keep a human-readable message for fallback
        message: `🎤 Voice memo created: "${(title || text.substring(0, 30))}..." (${duration}s, ${finalVoiceId}${voiceAnalysis.rationale.length > 0 ? ' - ' + voiceAnalysis.rationale[0] : ''})`
      };

      return result;

    } catch (error) {
      Logger.log(`Voice memo creation error: ${error.message}`, 'error');

      if (error.message.includes('rate limit')) {
        return '⏳ Rate limit reached for voice synthesis. Please try again in a moment.';
      } else if (error.message.includes('content_policy')) {
        return `🚫 Text content violates policy and cannot be synthesized.`;
      } else {
        return `❌ Error creating voice memo: ${error.message}`;
      }
    }
  },
  {
    name: 'createVoiceMemo',
    category: 'audio',
    description: 'Create high-quality voice memos using OpenAI TTS',
    formatResult: (result) => result
  }
);

/**
 * Transcribe audio using OpenAI Whisper API
 * @param {Buffer|string} audioData - Audio buffer or file path
 * @param {string} language - Language code (optional, auto-detected if not provided)
 * @param {string} prompt - Context prompt to guide transcription
 * @param {string} chatId - Chat ID for S3 organization
 * @returns {Promise<string>} Transcription result
 */
export const transcribeAudio = createToolWrapper(
  async (audioData, language = null, prompt = '', chatId = null) => {
    try {
      Logger.log(`Transcribing audio file...`);

      // Import OpenAI SDK
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: CONFIG.OPENAI_API_KEY,
      });

      let audioBuffer;
      let filename = 'audio.mp3';

      // If no audioData provided, look for recent voice message in chat
      if (!audioData && chatId) {
        Logger.log(`No audio data provided, searching for recent voice message...`);

        try {
          const { getRecentMessages } = await import('../services/messageService.js');
          const messages = await getRecentMessages(chatId, 10); // Get last 10 messages

          // Find the most recent voice message (stored in attachments)
          let voiceAttachment = null;
          let originalMessage = null;

          for (const msg of messages) {
            if (msg.attachments && msg.attachments.length > 0) {
              const voiceAtt = msg.attachments.find(att => att.type === 'voice');
              if (voiceAtt) {
                voiceAttachment = voiceAtt;
                originalMessage = msg;
                break;
              }
            }
          }

          if (!voiceAttachment) {
            return 'I couldn\'t find any recent voice messages to transcribe. Please send a voice message first.';
          }

          // If we have a stored transcription, return it directly
          if (voiceAttachment.transcription) {
            Logger.log(`Found stored transcription for voice message`);
            return `🎯 **Voice Transcription:**\n\n"${voiceAttachment.transcription}"\n\n📊 **Details:** ${voiceAttachment.duration}s voice message`;
          }

          // If no transcription but we have Base64 data, provide it for manual transcription
          if (voiceAttachment.base64Data) {
            Logger.log(`Found voice message with Base64 data, providing for manual transcription`);

            const base64Data = voiceAttachment.base64Data;
            const dataUrl = `data:audio/ogg;base64,${base64Data}`;

            return `🎯 **Voice Message Found** (${voiceAttachment.duration}s)\n\nBase64 (data URL):\n${dataUrl}\n\nManual transcription (cURL):\n\necho "${base64Data}" | base64 -d > voice.ogg\ncurl -X POST https://api.openai.com/v1/audio/transcriptions \\
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \\
  -F file=@voice.ogg \\
  -F model=gpt-4o-transcribe\n\nError details:  ${voiceAttachment.error || 'Auto-transcription failed during storage'}`;
          }

          // If no Base64 data available either
          if (voiceAttachment.fileName && originalMessage.messageId) {
            Logger.log(`No stored transcription or Base64 data found for voice message ${originalMessage.messageId}`);
            return `I found the voice message (${voiceAttachment.duration}s) but neither transcription nor Base64 audio data is available. The original error was: ${voiceAttachment.error || 'transcription failed during storage'}. Please try re-uploading the voice message as an MP3 file or send it again.`;
          }

        } catch (error) {
          Logger.log(`Error fetching voice message: ${error.message}`, 'error');
          return 'I couldn\'t access the recent voice message. Please try sending the voice message again or provide audio data directly.';
        }
      }
      // Handle different input formats
      else if (Buffer.isBuffer(audioData)) {
        audioBuffer = audioData;
      } else if (typeof audioData === 'string') {
        if (audioData.startsWith('data:audio/')) {
          // Base64 audio data
          const base64Data = audioData.split(',')[1];
          audioBuffer = Buffer.from(base64Data, 'base64');
          filename = 'audio.mp3';
        } else {
          // File path
          filename = path.basename(audioData);
          audioBuffer = fs.readFileSync(audioData);
        }
      } else {
        return `Invalid audio data format. Expected Buffer, file path, or provide chatId to transcribe recent voice message.`;
      }

      Logger.log(`Audio buffer size: ${audioBuffer.length} bytes`);

      // Create a temporary file for OpenAI API (it requires a file)
      const tempDir = `/tmp`;
      const tempFilePath = path.join(tempDir, `temp_audio_${Date.now()}.mp3`);

      try {
        fs.writeFileSync(tempFilePath, audioBuffer);

        // Transcribe using OpenAI Whisper
        const transcriptionOptions = {
          file: fs.createReadStream(tempFilePath),
          model: "gpt-4o-transcribe",
        };

        if (language) {
          transcriptionOptions.language = language;
        }

        if (prompt) {
          transcriptionOptions.prompt = prompt;
        }

        const response = await openai.audio.transcriptions.create(transcriptionOptions);

        const transcription = response.text;
        Logger.log(`Transcription completed: ${transcription.substring(0, 100)}...`);

        // Save transcription to S3 if chatId provided
        if (chatId && transcription) {
          const timestamp = Date.now();
          const s3Key = `fact_checker_bot/groups/${chatId}/transcriptions/${timestamp}_transcription.txt`;

          try {
            await S3Manager.uploadBuffer(
              CONFIG.S3_BUCKET_NAME,
              s3Key,
              Buffer.from(transcription, 'utf8'),
              `text/plain`
            );
            Logger.log(`Transcription saved to S3: ${s3Key}`);
          } catch (s3Error) {
            Logger.log(`Failed to save transcription to S3: ${s3Error.message}`, 'warn');
          }
        }

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        let result = `🎯 **Audio Transcription:**\n\n`;
        result += `"${transcription}"`;

        return result;

      } finally {
        // Ensure temp file is cleaned up even if transcription fails
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

    } catch (error) {
      Logger.log(`Audio transcription error: ${error.message}`, 'error');

      if (error.message.includes('rate limit')) {
        return '⏳ Rate limit reached for audio transcription. Please try again in a moment.';
      } else if (error.message.includes('file size')) {
        return `📏 Audio file is too large. Maximum size is 25MB.`;
      } else {
        return `❌ Error transcribing audio: ${error.message}`;
      }
    }
  },
  {
    name: 'transcribeAudio',
    category: 'audio',
    description: `Transcribe audio files using OpenAI Whisper API`,
    formatResult: (result) => result
  }
);

/**
 * Get S3 path for chat audio files
 * @param {string} chatId - Chat ID
 * @returns {string} S3 path for audio files
 */
export function getChatAudioPath(chatId) {
  return `fact_checker_bot/groups/${chatId}/audio/`;
}

/**
 * Get S3 path for chat transcriptions
 * @param {string} chatId - Chat ID
 * @returns {string} S3 path for transcriptions
 */
export function getChatTranscriptionPath(chatId) {
  return `fact_checker_bot/groups/${chatId}/transcriptions/`;
}

/**
 * Voice Memo Toolkit for agent integration
 */
export const VOICE_MEMO_TOOLKIT = {
  createVoiceMemo: {
    name: 'createVoiceMemo',
    description: 'Generate high-quality voice memos using OpenAI TTS',
    examples: [
      'createVoiceMemo("Hello world", "Friendly_Person", "auto", 1, "test_memo", chatId)',
      'createVoiceMemo("Breaking news update", "Deep_Voice_Man", "neutral", 0.9, "", chatId)'
    ],
    voices: [
      'Friendly_Person (alloy)', 'Deep_Voice_Man (onyx)', 'Calm_Woman (nova)',
      'Casual_Guy (echo)', 'Lively_Girl (shimmer)', 'Patient_Man (fable)'
    ],
    use_cases: [
      'Create podcast episodes from text',
      'Generate audio summaries',
      'Make voice announcements',
      'Create personalized voice messages'
    ]
  },

  transcribeAudio: {
    name: 'transcribeAudio',
    description: 'Transcribe audio files using OpenAI Whisper',
    examples: [
      'transcribeAudio(audioBuffer, null, "", chatId)',
      'transcribeAudio(filePath, "en", "This is a meeting transcript", chatId)'
    ],
    use_cases: [
      'Transcribe voice messages',
      'Convert audio meetings to text',
      'Process uploaded audio files',
      'Extract speech from recordings'
    ]
  }
};
