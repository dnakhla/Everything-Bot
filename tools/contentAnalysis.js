import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Summarize a large text or data into key points
 * @param {string} content - Content to summarize
 * @param {number} maxPoints - Maximum number of key points (default: 5)
 * @returns {string} Summarized content
 */
export async function summarizeContent(content, maxPoints = 5) {
  try {
    Logger.log(`Summarizing content (${content.length} chars) into ${maxPoints} points using LLM`);
        
    // Import OpenAI at the top level to avoid repeated imports
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
    });
        
    // Use LLM to summarize content
    const response = await openai.chat.completions.create({
      model: CONFIG.GPT_MODEL || 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a content summarizer. Extract the ${maxPoints} most important points from the given content. Format as a numbered list. Be concise but informative.`
        },
        {
          role: 'user',
          content: `Summarize this content into ${maxPoints} key points:\n\n${content}`
        }
      ],
      temperature: 0.3,
      max_tokens: 400
    });
        
    const summary = response.choices[0].message.content;
    return `📝 Summary (${maxPoints} key points):\n\n${summary}`;
        
  } catch (error) {
    Logger.log(`Summarize error: ${error.message}`, 'error');
    return `Error summarizing content: ${error.message}`;
  }
}