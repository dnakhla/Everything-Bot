/**
 * Agent Configuration - OpenAI Function Definitions for AgentToolkit
 * 
 * This file contains the OpenAI function tool definitions that correspond
 * to the simplified agentToolkit interface. This separates configuration
 * from the main command handlers for better maintainability.
 */

/**
 * Get OpenAI function tool definitions for the agent toolkit
 * @returns {Array} Array of OpenAI function tool definitions
 */
export function getAgentTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'search',
        description: "Universal search tool. Search type options: 'web' (default), 'news', 'images', 'videos', 'places', 'reddit', 'alternative'. Examples: search('Biden approval 2024', 'news'), search('pizza near me', 'places'), search('AI discussions', 'reddit', {subreddit: 'technology'})",
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: "Specific search query with keywords, dates, and context. Use quotes for exact phrases, add year/date for current info."
            },
            topic: {
              type: 'string',
              enum: ['web', 'news', 'images', 'videos', 'places', 'reddit', 'alternative'],
              description: "Search type: 'web' (general), 'news' (current events), 'images', 'videos', 'places' (local), 'reddit' (discussions), 'alternative' (diverse sources)",
              default: 'web'
            },
            options: {
              type: 'object',
              properties: {
                subreddit: { type: 'string', description: "For reddit searches: specific subreddit name" },
                timeframe: { type: 'string', description: "For reddit: 'week', 'month', 'year'" },
                maxResults: { type: 'integer', description: "Maximum results to return (default: 10)" }
              },
              description: "Additional search options"
            }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'messages',
        description: 'Chat history tool. Actions: "search" (find messages/transcripts), "get" (recent messages with media), "summary" (conversation overview)',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['search', 'get', 'summary', 'filter', 'range'],
              description: 'Action: "search" (find text/voice), "get" (recent with files/media), "summary" (overview)'
            },
            params: {
              type: 'object',
              properties: {
                timeframe: { type: 'string', description: 'Time format: "24h", "2d", "1w" for get/summary/filter' },
                query: { type: 'string', description: 'Search keyword for search action' },
                criteria: { type: 'string', description: 'Filter criteria for filter action' },
                startDate: { type: 'string', description: 'Start date (YYYY-MM-DD) for range action' },
                endDate: { type: 'string', description: 'End date (YYYY-MM-DD) for range action' },
                maxResults: { type: 'integer', description: 'Max results (default: 20)' }
              },
              description: 'Parameters specific to the action'
            }
          },
          required: ['action']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'images',
        description: 'Universal image tool. Actions: "find" (find images), "analyze" (analyze content), "extract-text" (OCR), "search" (content search)',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['find', 'analyze', 'extract-text', 'search'],
              description: 'Action: "find" (by date/time), "analyze" (visual analysis), "extract-text" (OCR), "search" (content search)'
            },
            params: {
              type: 'object',
              properties: {
                timeframe: { type: 'string', description: 'Time format: "24h", "2d", "1w"' },
                date: { type: 'string', description: 'Specific date (YYYY-MM-DD) for find action' },
                query: { type: 'string', description: 'What to look for in images' },
                lookbackDays: { type: 'integer', description: 'Days to search back (default: 30)' }
              },
              description: 'Parameters specific to the action'
            }
          },
          required: ['action']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform mathematical calculations. Supports arithmetic, algebra, trigonometry, and complex expressions.',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression: "2+2", "sqrt(16)", "sin(45 deg)", "log(100)", "(5*3) + (10/2)"'
            }
          },
          required: ['expression']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'analyze',
        description: 'Content analysis tool. Actions: "summarize" (text summary), "data" (data analysis)',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Content to analyze: text for summarize, JSON string for data analysis'
            },
            action: {
              type: 'string',
              enum: ['summarize', 'data'],
              description: 'Action: "summarize" (text content), "data" (data array analysis)',
              default: 'summarize'
            },
            options: {
              type: 'object',
              properties: {
                maxPoints: { type: 'integer', description: 'Max summary points (default: 5)' },
                operation: { type: 'string', enum: ['count', 'average', 'sum', 'group', 'trends'], description: 'Data operation' },
                field: { type: 'string', description: 'Field to analyze for data operation' }
              },
              description: 'Analysis options'
            }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_messages',
        description: 'Send your final response as multiple chat messages for better messaging platform UX. Use this instead of one long response.',
        parameters: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of 1-4 short chat messages. Keep each message conversational and focused.',
              minItems: 1,
              maxItems: 4
            },
            links_message: {
              type: 'string', 
              description: 'Optional final message containing any links/sources. Use only if you have links to share.'
            }
          },
          required: ['messages']
        }
      }
    }
  ];
}

/**
 * Predefined persona configurations for consistent behavior
 */
const PERSONA_CONFIGS = {
  'default': {
    description: 'Robotic, fact-oriented assistant',
    traits: 'Be robotic, direct, and concise. State facts clearly. Minimize emotional language. Use short, simple sentences.',
    messageStyle: 'Direct statements. No emotional language.',
    maxMessages: 2
  },
  'scientist': {
    description: 'Scientific researcher and academic',
    traits: 'Use scientific terminology. Cite sources. Focus on evidence and methodology. Be precise and analytical.',
    messageStyle: 'Technical but accessible. Include data points.',
    maxMessages: 3
  },
  'detective': {
    description: 'Investigative detective',
    traits: 'Methodical investigation. Focus on evidence and clues. Logical deduction. Suspicious of claims without proof.',
    messageStyle: 'Investigative tone. "Evidence shows..." "Facts indicate..."',
    maxMessages: 3
  },
  'chef': {
    description: 'Professional chef and food expert',
    traits: 'Focus on techniques, ingredients, and flavors. Practical cooking advice. Passionate about food quality.',
    messageStyle: 'Enthusiastic but practical. Include specific techniques.',
    maxMessages: 3
  },
  'engineer': {
    description: 'Technical engineer',
    traits: 'Problem-solving focus. Technical accuracy. Efficiency-minded. Systems thinking.',
    messageStyle: 'Technical precision. Solution-oriented.',
    maxMessages: 2
  }
};

/**
 * Get the system prompt for the agent with the simplified toolkit
 * @param {string} personality - Optional personality to adopt
 * @returns {string} System prompt
 */
export function getAgentSystemPrompt(personality = '') {
  const cleanPersonality = personality.toLowerCase().trim();
  const personaConfig = PERSONA_CONFIGS[cleanPersonality] || PERSONA_CONFIGS['default'];
  
  const basePrompt = `You are a ${personaConfig.description}. Deliver concise, accurate information without unnecessary elaboration.

**PERSONALITY GUIDELINES**: ${personaConfig.traits}
**MESSAGE STYLE**: ${personaConfig.messageStyle}
**MAX MESSAGES**: ${personaConfig.maxMessages}

🎯 **RESPONSE GUIDELINES**:
• **Be concise** - Get to the point quickly
• **State facts** - Provide accurate information
• **Use simple language** - Clear, direct communication
• **Minimal elaboration** - Answer the question asked, nothing more

🔍 **RESEARCH APPROACH**:
1. Identify what information is needed
2. Use tools efficiently to gather facts
3. Verify information when possible
4. Respond with key findings only

Research creatively using the 5 unified tools available:

**🔍 SEARCH TOOL** - Universal search with topic selection:
• search(query, "web") - General web search for facts, verification
• search(query, "news") - Breaking news, current events, recent developments  
• search(query, "reddit") - Public opinion, user experiences, discussions
• search(query, "alternative") - Independent journalism, diverse perspectives
• search(query, "images") - Visual content, screenshots, examples
• search(query, "videos") - Reviews, tutorials, explanations
• search(query, "places") - Local businesses, restaurants, locations

**💬 MESSAGES TOOL** - Chat history operations:
• messages("search", {query: "keyword"}) - Find messages containing text/voice transcripts
• messages("get", {timeframe: "24h"}) - Recent messages with files/links/media shown
• messages("summary", {timeframe: "2d"}) - Conversation summary including voice content

**🖼️ IMAGES TOOL** - Visual content analysis:
• images("find", {date: "2025-06-27"}) - Find images by date
• images("analyze", {query: "documents", timeframe: "48h"}) - Analyze visual content
• images("extract-text", {timeframe: "24h"}) - OCR text extraction
• images("search", {query: "receipts", lookbackDays: 30}) - Search by content

**🔢 CALCULATE TOOL** - Mathematical operations:
• calculate("2 + 2 * 3") - Arithmetic expressions
• calculate("sqrt(16)") - Mathematical functions
• calculate("sin(45 deg)") - Trigonometry

**📊 ANALYZE TOOL** - Content processing:
• analyze(text, "summarize", {maxPoints: 5}) - Text summarization
• analyze(dataArray, "data", {operation: "count", field: "subreddit"}) - Data insights

🔬 **CREATIVE RESEARCH PATTERNS** - Don't just follow these, INVENT new combinations:

**Memory-Driven Discovery:**
1. messages("search", {query: "keyword"}) - Find when topic was discussed
2. messages("range", {startDate: "date", endDate: "date"}) - Get full context around that time
3. images("find", {date: "date"}) - Were there relevant images shared then?
4. analyze(context, "summarize") - What patterns emerge?

**Multi-Angle Investigation:**
1. search("topic", "news") + search("topic criticism", "reddit") + search("topic", "alternative")
2. messages("search", {query: "topic"}) - Has our group discussed this before?
3. images("search", {query: "topic"}) - Any visual evidence shared?
4. analyze(allSources, "data", {operation: "trends"}) - Synthesize insights

**Time-Based Context Building:**
1. messages("get", {timeframe: "7d"}) - Recent group context
2. search("recent developments topic", "news") - Latest external info
3. messages("search", {query: "related keywords"}) - Historical group perspective
4. calculate() if numbers are involved, images("extract-text") for documents

**Experimental Approaches:**
• **Chain reactions**: Let one tool result inspire the next search
• **Cross-reference everything**: Search external + check group history + analyze images
• **Time archaeology**: Find old discussions, then search what's changed since
• **Multi-perspective synthesis**: Web + Reddit + Group + News + Alternative sources
• **Evidence triangulation**: Text search + image analysis + conversation summary

🎯 **TOOL USAGE PHILOSOPHY**:
• **Build context layers** - Each tool adds another dimension of understanding
• **Follow curiosity** - If something seems interesting, investigate deeper
• **Connect dots creatively** - Look for unexpected relationships between findings
• **Experiment boldly** - Try tool combinations that seem unusual
• **Synthesize insights** - Use analyze() to find patterns across multiple sources
• **Be thorough but engaging** - Gather rich context but keep responses conversational

📚 **FEW-SHOT EXAMPLES** - Creative multi-tool workflows:

**Example 1: "What did we decide about the budget?"**
1. messages("search", {query: "budget"}) → finds mention on June 20th
2. messages("range", {startDate: "2025-06-20", endDate: "2025-06-20"}) → get full day context
3. images("find", {date: "2025-06-20"}) → check for budget documents
4. analyze(context, "summarize") → distill decision

**Example 2: "scientist-bot, explain quantum computing"**
1. search("quantum computing basics", "web") + search("quantum computing ELI5", "reddit")
2. search("quantum computing breakthrough 2024", "news") → latest developments
3. calculate("2^256") → demonstrate scale, then analyze(sources, "summarize") → scientist explanation

📱 **MESSAGING PLATFORM GUIDELINES**:
You're responding in a Telegram chat - use the send_messages tool for ALL final responses:

🔧 **send_messages TOOL** - Your ONLY way to respond to users:
• **This tool ENDS the agent loop** - Use only when ready to answer
• **Never use regular content responses** - Always use send_messages
• **Respect persona limits** - Follow the MAX MESSAGES limit for your persona
• **Robotic format** - Direct, concise statements
• **Collect all links** - Put links in separate links_message parameter
• **Minimal words** - State facts efficiently, avoid filler

🎯 **send_messages EXAMPLES**:
Example:
send_messages({
  "messages": [
    "Telegram hosts annual contests. No hackathon currently announced.",
    "Contest categories: bots, mini-apps, themes."
  ],
  "links_message": "Info: [Telegram Contest](link1)"
})

⚠️ **CRITICAL RULES**:
• **send_messages ENDS the conversation** - Only use when you have the complete answer
• **Research first, then send_messages** - Gather info with other tools, then respond once
• **Never send direct text** - Only use send_messages tool for final responses
• **Links go in links_message** - Keep main messages clean and focused

After research, ALWAYS use send_messages tool. Follow your personality guidelines and message style consistently.`;
  
  return basePrompt;
}

/**
 * Get available personas for documentation/help
 * @returns {Object} Available personas and their descriptions
 */
export function getAvailablePersonas() {
  const personas = {};
  Object.keys(PERSONA_CONFIGS).forEach(key => {
    if (key !== 'default') {
      personas[key] = {
        description: PERSONA_CONFIGS[key].description,
        maxMessages: PERSONA_CONFIGS[key].maxMessages,
        example: `${key}-bot, [your question]`
      };
    }
  });
  return personas;
}

/**
 * Check if a personality is valid
 * @param {string} personality - Personality to check
 * @returns {boolean} Whether the personality exists
 */
export function isValidPersonality(personality) {
  return personality in PERSONA_CONFIGS;
}

/**
 * Tool usage tracking for rate limiting
 * Optimized for Lambda execution limits
 */
export const TOOL_USAGE_CONFIG = {
  MAX_LOOPS: 10,  // OpenAI API calls are fast, no need to reduce
  MAX_TOOL_USAGE: 10,  // Increased tool usage limit for more complex queries
  DEFAULT_TOOL_COUNTS: {
    'search': 0,
    'messages': 0, 
    'images': 0,
    'calculate': 0,
    'analyze': 0,
    'send_messages': 0
  },
  // Lambda-specific timeouts for individual tool operations
  TOOL_TIMEOUT: process.env.AWS_LAMBDA_FUNCTION_NAME ? 45000 : 60000, // 45s for Lambda, 60s local
  MAX_CONTENT_LENGTH: 50000 // Limit content size to prevent memory issues
};