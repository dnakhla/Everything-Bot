/**
 * Browser Tool Configuration
 * Full web automation with Chromium
 */

export const browserTool = {
  // OpenAI function definition
  definition: {
    type: 'function',
    function: {
      name: 'browser',
      description: 'Full browser automation with Chromium: JavaScript rendering, screenshots, clicks, form filling, navigation. Use for interactive sites, SPAs, dynamic content, visual analysis, or when fetch_url fails.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to with browser automation'
          },
          action: {
            type: 'string',
            enum: ['scrape', 'screenshot', 'interact', 'wait-and-scrape', 'spa-scrape', 'links', 'find-clickables', 'smart-navigate'],
            description: 'Browser actions: "screenshot" (capture page image), "interact" (click/fill forms), "wait-and-scrape" (dynamic content), "spa-scrape" (React/Vue apps), "links" (extract links), "find-clickables" (show all clickable elements), "smart-navigate" (automatically click through to find data), "scrape" (basic text)',
            default: 'scrape'
          },
          options: {
            type: 'object',
            properties: {
              waitFor: { type: 'integer', description: 'Milliseconds to wait for content loading (default: 3000)' },
              selector: { type: 'string', description: 'CSS selector to wait for specific elements' },
              scrollDown: { type: 'boolean', description: 'Auto-scroll for infinite scroll content (default: false)' },
              instruction: { type: 'string', description: 'Analysis instruction for extracted content' },
              clickElement: { type: 'string', description: 'CSS selector to click (buttons, tabs, links)' },
              fillForm: { type: 'object', description: 'Form fields: {"#selector": "value", "#search": "query"}' },
              fullPageScreenshot: { type: 'boolean', description: 'Full page screenshot vs viewport only (default: false)' }
            },
            description: 'Browser automation options: screenshots, interactions, form filling, dynamic loading'
          }
        },
        required: ['url']
      }
    }
  },

  // Tool documentation for system prompt
  documentation: `**🤖 BROWSER TOOL** - Full web automation with Chromium:

📸 **SCREENSHOTS & VISUAL ANALYSIS**:
• browser(url, "screenshot", {fullPageScreenshot: true, instruction: "describe layout"}) - Full page screenshot with analysis
• browser(url, "screenshot", {fullPageScreenshot: false, instruction: "identify errors"}) - Viewport screenshot with analysis

🖱️ **CLICK & INTERACT**:
• browser(url, "interact", {clickElement: ".load-more-btn", waitFor: 3000}) - Click buttons/links
• browser(url, "interact", {clickElement: ".results-tab"}) - Navigate to different sections

🧠 **SMART NAVIGATION**:
• browser(url, "smart-navigate", {instruction: "Carolina vs Seattle match result"}) - Auto-click through navigation to find data
• browser(url, "find-clickables", {instruction: "week 10 results"}) - Find clickable elements

📜 **ADVANCED SCRAPING**:
• browser(url, "wait-and-scrape", {waitFor: 5000, scrollDown: true}) - Dynamic content
• browser(url, "spa-scrape", {waitFor: 7000}) - Single Page Apps (React/Vue/Angular)

💡 **WHEN TO USE**:
- JavaScript-heavy sites that don't work with fetch_url
- Need to click buttons/navigate to access content
- Sites requiring form submission or search
- Need screenshots for visual analysis
- Dynamic content that loads after initial page`,

  // Persona-specific examples
  personaExamples: {
    default: [
      'browser(url, "smart-navigate", {instruction: "specific data needed"})',
      'browser(url, "screenshot", {fullPageScreenshot: true})',
      'browser(url, "interact", {clickElement: ".results-tab"})'
    ],
    scientist: [
      'browser(journal_url, "wait-and-scrape") // for research databases',
      'browser(pubmed_url, "interact", {fillForm: {"#term": "keyword"}, clickElement: ".search-btn"})',
      'browser(chart_url, "screenshot") // capture research graphs'
    ],
    detective: [
      'browser(complex_site, "interact") // access gated content',
      'browser(evidence_url, "screenshot") // preserve visual evidence',
      'browser(site, "interact", {clickElement: ".hidden-details"}) // reveal information'
    ]
  },

  // When to use this tool
  useCases: [
    'JavaScript-heavy sites requiring browser rendering',
    'Interactive content behind clicks/forms',
    'Single Page Applications (SPAs)',
    'Visual analysis via screenshots',
    'Dynamic content that loads after page load',
    'Sites requiring navigation to access data'
  ],

  // Feature flag requirement
  requiresFeatureFlag: 'ENABLE_BROWSER_TOOL'
};