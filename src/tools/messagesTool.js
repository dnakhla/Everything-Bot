/**
 * Messages Tool Configuration
 * Chat history operations and analysis
 */

export const messagesTool = {
  // OpenAI function definition
  definition: {
    type: 'function',
    function: {
      name: 'messages',
      description: 'Access and analyze chat conversation history stored in S3. Search messages, get recent conversations, generate summaries, and find specific content.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get', 'search', 'summary', 'filter', 'range'],
            description: 'Action to perform: "get" (recent messages), "search" (find content), "summary" (conversation summary), "filter" (by criteria), "range" (date range)'
          },
          params: {
            type: 'object',
            properties: {
              timeframe: { type: 'string', description: 'Time period: "1h", "6h", "24h", "3d", "7d" (default: 24h)' },
              query: { type: 'string', description: 'Search query for finding specific messages or content' },
              maxMessages: { type: 'integer', description: 'Maximum number of messages to return (default: 50)' },
              includeMedia: { type: 'boolean', description: 'Include media files and attachments (default: true)' },
              criteria: { type: 'string', description: 'Filter criteria for message filtering' },
              startDate: { type: 'string', description: 'Start date for range queries (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'End date for range queries (YYYY-MM-DD)' }
            },
            description: 'Parameters specific to the chosen action'
          }
        },
        required: ['action']
      }
    }
  },

  // Tool documentation for system prompt
  documentation: `**💬 MESSAGES TOOL** - Chat history operations:
• messages("search", {query: "keyword"}) - Find messages containing text/voice transcripts
• messages("get", {timeframe: "24h"}) - Recent messages with files/links/media shown
• messages("summary", {timeframe: "2d"}) - Conversation summary including voice content
• messages("filter", {criteria: "contains links"}) - Filter messages by specific criteria
• messages("range", {startDate: "2025-06-20", endDate: "2025-06-25"}) - Messages from date range`,

  // Persona-specific examples
  personaExamples: {
    default: [
      'messages("get", {timeframe: "24h", maxMessages: 50})',
      'messages("search", {query: "important decision"})',
      'messages("summary", {timeframe: "3d"})'
    ],
    scientist: [
      'messages("search", {query: "research OR study OR data"})',
      'messages("filter", {criteria: "contains scientific terms"})',
      'messages("summary", {timeframe: "7d"}) // for research context'
    ],
    detective: [
      'messages("search", {query: "inconsistency OR contradiction"})',
      'messages("range", {startDate: "2025-06-20", endDate: "2025-06-25"})',
      'messages("filter", {criteria: "contains evidence OR claims"})'
    ]
  },

  // When to use this tool
  useCases: [
    'Understanding conversation context',
    'Finding previous discussions on topics',
    'Summarizing long conversations',
    'Searching for specific information mentioned',
    'Analyzing conversation patterns',
    'Retrieving shared links or media'
  ]
};