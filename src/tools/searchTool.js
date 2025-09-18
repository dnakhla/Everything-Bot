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
  documentation: `**🔍 SEARCH TOOL** - Advanced real-time intelligence gathering with multi-source synthesis:
PROFESSIONAL-GRADE search capabilities with sophisticated query construction and source diversification:

🎯 **PRECISION QUERY ENGINEERING** - Master-level search syntax for optimal results:
• search('"exact technical term" AND context -spam -ads', 'web') - Boolean logic with noise filtering
• search('site:github.com "telegram bot" language:JavaScript', 'web') - Source-specific technical searches
• search('"breaking news" within:2h location:ukraine', 'news') - Time and location precision
• search('"research paper" filetype:pdf machine learning 2024', 'web') - Document type filtering

🔀 **ADVANCED BOOLEAN OPERATIONS** - Complex logical constructions for comprehensive coverage:
• search('("artificial intelligence" OR "machine learning") AND ethics -marketing', 'news') - Grouped terms with exclusions
• search('"supply chain" AND (disruption OR shortage) AND 2024', 'news') - Multiple condition matching
• search('cybersecurity AND (vulnerability OR breach) -advertisement', 'web') - Industry-specific filtering

📅 **TEMPORAL INTELLIGENCE** - Time-aware searching for current and historical context:
• search('"election results" after:2024-11-01 before:2024-12-01', 'news') - Precise date ranges
• search('"market crash" within:24h real-time', 'news') - Ultra-recent developments
• search('"historical analysis" world war timeline', 'web') - Historical context research

🌐 **MULTI-SOURCE INTELLIGENCE MATRIX**:
• search(query, "news") - BREAKING: Real-time news feeds, press releases, official statements, wire services
• search(query, "web") - COMPREHENSIVE: Documentation, academic papers, official sites, technical resources
• search(query, "reddit") - GRASSROOTS: Community insights, user experiences, insider perspectives, discussions
• search(query, "alternative") - DIVERSE: Independent journalism, investigative reports, alternative viewpoints
• search(query, "images") - VISUAL: Infographics, technical diagrams, evidence photos, charts, screenshots
• search(query, "videos") - DYNAMIC: Live coverage, tutorials, explanations, demonstrations, testimonials
• search(query, "places") - LOCATION: Business listings, geographical data, local information, maps

⚡ **INTELLIGENT AGGREGATION** - Cross-references multiple sources for comprehensive, verified information
🛡️ **SOURCE CREDIBILITY** - Prioritizes authoritative sources while maintaining perspective diversity
🔄 **REAL-TIME ACCESS** - Bypasses AI training cutoffs for current events and latest developments`,

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