/**
 * Agent Configuration - Clean Modular System
 * Dynamic prompt generation based on available tools and persona
 */

import { getToolDefinitions, generateToolDocumentation } from './tools/index.js';

/**
 * Get OpenAI function tool definitions
 */
export async function getAgentTools(currentLoop = 1, maxLoops = 10) {
  // On final loop, only provide send_messages to force response
  if (currentLoop >= maxLoops) {
    const allTools = await getToolDefinitions();
    const sendMessagesOnly = allTools.filter(tool => tool.function.name === 'send_messages');
    console.log(`[TOOLS] Loop ${currentLoop}/${maxLoops}: FINAL LOOP - only send_messages tool available`);
    return sendMessagesOnly;
  }

  // All tools available for non-final loops
  const all = await getToolDefinitions();
  console.log(`[TOOLS] Loop ${currentLoop}/${maxLoops}: full toolset enabled (${all.length} tools)`);
  return all;
}

/**
 * Generate dynamic system prompt based on persona and available tools
 */
export async function getAgentSystemPrompt(personality = '', currentLoop = 1, maxLoops = 10) {
  const cleanPersonality = personality.toLowerCase().trim();
  
  // Get current date and time for context grounding
  const now = new Date();
  const currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric', 
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  });
  
  // Create dynamic persona section
  const personaSection = createPersonaSection(cleanPersonality, personality);
  
  // Generate dynamic tool documentation based on available tools
  const toolDocumentation = await generateToolDocumentation(cleanPersonality);
  
  // Build complete system prompt
  const systemPrompt = `You are Everything Bot. Everything research assistant. Today is ${currentDateTime}. Loop ${currentLoop}/${maxLoops}.

${personaSection}

${toolDocumentation}

FOCUS AREAS (from recent conversations):
- VIDEO HANDLING: Use analyze tool with contentType "video" for any video URLs or files
- AUDIO GENERATION: When user requests audio/voice, use send_messages with medium: {type: "audio"}
- MESSAGE FORMAT: Always break responses into message arrays, never walls of text
- RESEARCH FIRST: Search thoroughly before responding
- GROUP CHAT CONTEXT: Keep it conversational, short, helpful
- NEVER ASK FOR CLARIFICATION OR FOLLOW-UPS: Figure it out from context, search, or chat history - you get ONE chance
- RESPONSE STYLE: Robotic, concise, direct. No questions. Occasional dry humor. Clean layout.

FORMAT RULES:
✅ send_messages({messages: ["Point 1", "Point 2", "Final thought"]})
✅ send_messages({messages: ["Here's the code:", "code block here", "That should work, gang"]})
❌ send_messages({messages: ["Giant wall of text with everything in one message..."]})

DECISION MAKING:
- Ambiguous request → Make your best guess using context clues
- Missing info → Search for it or check conversation history
- Unclear intent → Pick the most likely interpretation and go with it
- Multiple possibilities → Choose the most practical one
- Video → They'll share YouTube shorts. Use analyze(videoUrl, "video", "describe what happens")
- Audio/podcast/can't read → Create multiple audio blocks: send_messages({messages: ["content"], medium: {type: "audio"}})
- Code → Break into: explanation + code block + conclusion

CRITICAL: You cannot ask "Could you clarify?" or "What do you mean?" - FIGURE IT OUT and provide the best answer you can. Use search_messages, search tools, and logical reasoning. One shot, make it count.

YOUR ACTUAL TOOLS (6 total):
1. search - Web/news/Reddit search
2. run_code - JavaScript execution
3. analyze - Universal content analysis (text/images/documents/voice/video)
4. fetch_url - Web page content
5. send_messages - Final response (text OR audio with medium: {type: "audio"})
6. search_messages - Bot memory/conversation history

Do NOT hallucinate fake tools. These 6 are all you have.`;

  return systemPrompt;
}

/**
 * Create persona section based on personality input
 */
function createPersonaSection(cleanPersonality, originalPersonality) {
  if (cleanPersonality && cleanPersonality !== 'default' && cleanPersonality !== 'robot') {
    console.log(`[PERSONA DEBUG] Creating dynamic persona: "${cleanPersonality}"`);
    return `PERSONA: Embody "${originalPersonality}" completely. Stay in character. Max 2 messages.`;
  } else {
    console.log(`[PERSONA DEBUG] Using default robot persona`);
    return `PERSONALITY: Robotic and concise. Dry humor occasionally. Never ask follow-ups or questions. Deliver information directly. Max 2 messages.`;
  }
}

/**
 * Tool usage configuration
 */
export const TOOL_USAGE_CONFIG = {
  // Agent loop limits
  MAX_LOOPS: 10,
  MAX_TOOL_USAGE: 100,
  
  // Default tool usage limits per conversation
  DEFAULT_TOOL_COUNTS: {
    'search': 0,
    'messages': 0,
    'images': 0,
    'calculate': 0,
    'analyze': 0,
    'fetch_url': 0,
    'browser': 0,
    'analyze_image': 0,
    'send_messages': 0
  },
  
  // Timeout for individual tool operations (Lambda and local)
  TOOL_TIMEOUT: 90000, // 90s
  MAX_CONTENT_LENGTH: 50000 // Limit content size to prevent memory issues
};
