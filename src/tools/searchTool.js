/**
 * Search Tool Configuration
 * Universal search with advanced query techniques
 */

export const searchTool = {
  // OpenAI function definition
  definition: {
    type: 'function',
    function: {
      name: 'search',
      description: "Universal search tool with advanced query techniques. ALWAYS use sophisticated search strategies: quoted phrases, specific terms, alternative keywords, and varied approaches for comprehensive results.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "ADVANCED SEARCH QUERY - Use these techniques for best results: 1) QUOTED PHRASES: \"exact phrase\" for specific terms 2) BOOLEAN OPERATORS: \"climate change\" AND policy, OR alternatives 3) EXCLUSIONS: \"AI safety\" -hype -marketing 4) SPECIFICITY: Include dates, locations, specific terms 5) VARIATIONS: Try multiple related keywords."
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

  // Tool documentation for system prompt
  documentation: `**🔍 SEARCH TOOL** - Universal search with ADVANCED QUERY TECHNIQUES:
ALWAYS use sophisticated search strategies for maximum effectiveness:

🎯 **QUOTED PHRASES** - Use "exact phrases" for precise results:
• search('"machine learning" safety concerns', 'news') - Exact phrase matching
• search('"telegram bot api" documentation', 'web') - Specific technical terms

🔀 **BOOLEAN OPERATORS** - Combine terms strategically:
• search('"AI regulation" AND policy OR legislation', 'news') - Multiple related terms
• search('cybersecurity AND privacy -marketing -ads', 'web') - Include/exclude terms

📅 **TIME-FOCUSED SEARCHES** - Add temporal context for recent information:
• search('"climate summit" 2024 outcomes', 'news') - Recent specific events
• search('"AI breakthrough" December 2024', 'web') - Latest developments

🌐 **SEARCH TYPES**:
• search(query, "web") - General web search (default)
• search(query, "news") - Breaking news, current events, recent developments
• search(query, "reddit") - Public discussions, opinions, community insights
• search(query, "alternative") - Independent journalism, diverse perspectives
• search(query, "images") - Visual examples, screenshots, diagrams
• search(query, "videos") - Tutorials, explanations, demonstrations
• search(query, "places") - Local businesses, physical locations`,

  // Persona-specific examples
  personaExamples: {
    default: [
      'search(\'"climate change" data 2024 AND scientific consensus\')',
      'search(\'"WHO guidelines" covid OR coronavirus official\')',
      'search(\'"API documentation" telegram bot development\')'
    ],
    scientist: [
      'search(\'"peer reviewed" studies "climate change" -blog -opinion\')',
      'search(\'"clinical trial" results "drug name" AND methodology\')',
      'search(\'"systematic review" OR "meta-analysis" nutrition studies\')'
    ],
    detective: [
      'search(\'"official story" vs "witness accounts" event name\')',
      'search(\'"incident timeline" discrepancies news reports\')',
      'search(\'"missing evidence" OR "inconsistent reports" case name\')'
    ]
  },

  // When to use this tool
  useCases: [
    'Need current information beyond training data',
    'Fact-checking claims and statements',
    'Finding multiple perspectives on topics',
    'Researching recent developments',
    'Gathering evidence and sources'
  ]
};