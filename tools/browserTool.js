/**
 * Browser Automation Tool - Using Sparticuz Chromium for AWS Lambda
 * 
 * Provides browser automation capabilities for:
 * - JavaScript-heavy site scraping
 * - Dynamic content loading
 * - Interactive page navigation
 * - Screenshot capture
 * - Form interaction
 * - SPA (Single Page Application) handling
 */

import { Logger } from '../utils/logger.js';
import { createToolWrapper } from '../utils/toolWrapper.js';

let chromium;
let puppeteer;

/**
 * Initialize browser dependencies (lazy loading for performance)
 */
async function initializeBrowser() {
  if (!chromium) {
    try {
      chromium = await import('@sparticuz/chromium');
      puppeteer = await import('puppeteer-core');
      Logger.log('Browser dependencies initialized successfully');
    } catch (error) {
      Logger.log(`Failed to initialize browser dependencies: ${error.message}`, 'error');
      
      // In Lambda, if browser dependencies are missing, gracefully fail
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        throw new Error('Browser automation not available in current Lambda deployment. Use fetch_url for basic content extraction.');
      } else {
        throw new Error('Browser automation not available - missing dependencies. Please run: npm install @sparticuz/chromium puppeteer-core');
      }
    }
  }
}

/**
 * Get browser configuration optimized for AWS Lambda
 */
async function getBrowserConfig() {
  const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  if (isLambda) {
    return {
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(), // call as function
      headless: chromium.default.headless,
      ignoreHTTPSErrors: true,
    };
  } else {
    // Local development config - try to find local Chrome installation
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/google-chrome-stable', // Linux
      '/usr/bin/google-chrome', // Linux
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows
    ];
    
    let executablePath = null;
    const fs = await import('fs');
    
    for (const path of possiblePaths) {
      try {
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!executablePath) {
      throw new Error('Local Chrome installation not found. Please install Google Chrome or set CHROME_PATH environment variable.');
    }
    
    return {
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      defaultViewport: { width: 1280, height: 720 }
    };
  }
}

/**
 * Launch browser with optimized settings
 */
async function launchBrowser() {
  await initializeBrowser();
  
  const config = await getBrowserConfig();
  const browser = await puppeteer.default.launch(config);
  
  // Set timeout for Lambda constraints
  const timeout = process.env.AWS_LAMBDA_FUNCTION_NAME ? 25000 : 30000;
  
  return { browser, timeout };
}

/**
 * Browser automation for dynamic content scraping
 * @param {string} url - URL to navigate to
 * @param {string} action - Action to perform: 'scrape', 'screenshot', 'interact', 'wait-and-scrape'
 * @param {Object} options - Action-specific options
 * @param {string} chatId - Chat ID for S3 organization (optional)
 * @returns {string} Results of browser automation
 */
export const browser = createToolWrapper(
  async (url, action = 'scrape', options = {}, chatId = null) => {
    const {
      selector = '',
      waitFor = 3000,
      scrollDown = false,
      clickElement = '',
      fillForm = {},
      extractLinks = false,
      fullPageScreenshot = false,
      instruction = 'extract main content'
    } = options;


    let browser;
    let page;
    
    try {
      Logger.log(`Browser automation: ${action} for ${url}`);
      
      // Validate URL
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid URL provided');
      }
      
      const { browser: browserInstance, timeout } = await launchBrowser();
      browser = browserInstance;
      page = await browser.newPage();
      
      // Set page timeout
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      
      // Navigate to URL
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: timeout 
      });
      
      switch (action.toLowerCase()) {
        case 'scrape':
          return await performScrape(page, selector, waitFor, scrollDown, instruction);
          
        case 'screenshot':
          return await takeScreenshot(page, fullPageScreenshot, chatId, instruction);
          
        case 'interact':
          return await performInteraction(page, clickElement, fillForm, waitFor);
          
        case 'wait-and-scrape':
          return await waitAndScrape(page, selector, waitFor, scrollDown, instruction);
          
        case 'spa-scrape':
          return await scrapeSPA(page, waitFor, instruction);
          
        case 'links':
          return await extractPageLinks(page, instruction);
          
        case 'find-clickables':
          return await findClickableElements(page, instruction);
          
        case 'smart-navigate':
          return await smartNavigateAndScrape(page, instruction, waitFor);
          
        default:
          throw new Error(`Unknown action: ${action}. Use: scrape, screenshot, interact, wait-and-scrape, spa-scrape, links, find-clickables, smart-navigate`);
      }
      
    } catch (error) {
      Logger.log(`Browser automation error: ${error.message}`, 'error');
      
      if (error.name === 'TimeoutError') {
        return `❌ Browser timeout: Page took too long to load or respond (${url})`;
      } else if (error.message.includes('net::ERR_')) {
        return `❌ Network error: Could not reach ${url}`;
      } else {
        return `❌ Browser error: ${error.message}`;
      }
    } finally {
      try {
        if (page) await page.close();
        if (browser) await browser.close();
      } catch (closeError) {
        Logger.log(`Error closing browser: ${closeError.message}`, 'warn');
      }
    }
  },
  {
    name: 'browser',
    category: 'automation',
    description: 'Browser automation for JavaScript-heavy sites and dynamic content',
    formatResult: (result) => result
  }
);

/**
 * Perform content scraping with dynamic loading support
 */
async function performScrape(page, selector, waitFor, scrollDown, instruction) {
  // Wait for initial content load
  await page.waitForTimeout(waitFor);
  
  // Scroll down if requested (for infinite scroll content)
  if (scrollDown) {
    await autoScroll(page);
  }
  
  // Wait for specific selector if provided
  if (selector) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
    } catch (error) {
      Logger.log(`Selector not found: ${selector}`, 'warn');
    }
  }
  
  // Extract page content
  const content = await page.evaluate(() => {
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());
    
    // Get main content
    const body = document.body;
    return body ? body.innerText : '';
  });
  
  // Extract links if content is sparse
  const links = await page.evaluate(() => {
    const linkElements = document.querySelectorAll('a[href]');
    return Array.from(linkElements).slice(0, 10).map(link => ({
      text: link.textContent.trim(),
      url: link.href
    })).filter(link => link.text && link.text.length > 2);
  });
  
  let result = `🌐 **Browser-rendered content** from ${page.url()}:\n\n`;
  result += `📊 **Page Stats**: ${content.length} characters extracted\n`;
  result += `🔍 **Search Target**: "${instruction}"\n\n`;
  
  if (content && content.trim().length > 100) {
    // Use content analysis for summarization
    const { summarizeContent } = await import('./contentAnalysis.js');
    const analysis = await summarizeContent(content, 8, instruction);
    result += analysis;
  } else {
    result += '⚠️ **Limited Content**: Page may be heavily JavaScript-dependent or require interaction.\n';
    result += '💡 **Suggestion**: Try "smart-navigate" or "wait-and-scrape" actions for dynamic content.\n\n';
  }
  
  // Add relevant links if found
  if (links.length > 0) {
    result += `\n\n🔗 **Key Links Found:**\n${links.slice(0, 5).map(link => `• [${link.text}](${link.url})`).join('\n')}`;
  }
  
  return result;
}

/**
 * Take screenshot of the page and analyze it
 */
async function takeScreenshot(page, fullPage = false, chatId = null, instruction = 'describe what you see in this screenshot') {
  const screenshot = await page.screenshot({
    fullPage: fullPage,
    type: 'png'
  });
  
  try {
    // Import the image analysis tool
    const { analyzeImage } = await import('./imageAnalysis.js');
    
    // Generate filename with timestamp
    const timestamp = Date.now();
    const filename = `screenshot_${timestamp}.png`;
    
    // Analyze the screenshot using the image analysis tool
    const analysis = await analyzeImage(screenshot, instruction, chatId, filename);
    
    return `📸 **Screenshot Analysis** (${page.url()}):\n\n${analysis.replace('🖼️ **Image Analysis:**', '')}`;
    
  } catch (error) {
    Logger.log(`Screenshot analysis error: ${error.message}`, 'error');
    
    // Fallback: just save to S3 if chatId provided
    if (chatId) {
      try {
        const { S3Manager } = await import('../services/s3Manager.js');
        const { CONFIG } = await import('../config.js');
        const timestamp = Date.now();
        const s3Key = `fact_checker_bot/groups/${chatId}/images/screenshot_${timestamp}.png`;
        
        await S3Manager.uploadBuffer(CONFIG.S3_BUCKET_NAME, s3Key, screenshot, 'image/png');
        return `📸 Screenshot captured from ${page.url()} (${fullPage ? 'full page' : 'viewport'})\n\n📁 Saved to: ${s3Key}`;
      } catch (s3Error) {
        return `📸 Screenshot captured from ${page.url()} (${fullPage ? 'full page' : 'viewport'})\n\n⚠️ Could not save or analyze screenshot`;
      }
    }
    
    return `📸 Screenshot captured from ${page.url()} (${fullPage ? 'full page' : 'viewport'})\n\n⚠️ Analysis failed: ${error.message}`;
  }
}

/**
 * Perform page interactions (clicks, form fills)
 */
async function performInteraction(page, clickElement, fillForm, waitFor) {
  let actions = [];
  
  // Click element if specified
  if (clickElement) {
    try {
      await page.click(clickElement);
      actions.push(`Clicked: ${clickElement}`);
      await page.waitForTimeout(2000); // Wait for response
    } catch (error) {
      actions.push(`Failed to click ${clickElement}: ${error.message}`);
    }
  }
  
  // Fill form if specified
  if (Object.keys(fillForm).length > 0) {
    for (const [selector, value] of Object.entries(fillForm)) {
      try {
        await page.type(selector, value);
        actions.push(`Filled ${selector}: ${value}`);
      } catch (error) {
        actions.push(`Failed to fill ${selector}: ${error.message}`);
      }
    }
  }
  
  // Wait for changes to take effect
  await page.waitForTimeout(waitFor);
  
  return `🤖 Browser interactions completed:\n${actions.join('\n')}`;
}

/**
 * Wait for dynamic content and then scrape
 */
async function waitAndScrape(page, selector, waitFor, scrollDown, instruction) {
  // Extended wait for dynamic content
  await page.waitForTimeout(waitFor);
  
  // Try to wait for specific content indicators
  const dynamicIndicators = [
    '[data-loaded="true"]',
    '.content-loaded',
    '[data-testid]',
    '.dynamic-content'
  ];
  
  for (const indicator of dynamicIndicators) {
    try {
      await page.waitForSelector(indicator, { timeout: 3000 });
      Logger.log(`Found dynamic content indicator: ${indicator}`);
      break;
    } catch (error) {
      // Continue to next indicator
    }
  }
  
  return await performScrape(page, selector, 1000, scrollDown, instruction);
}

/**
 * Specialized scraping for Single Page Applications
 */
async function scrapeSPA(page, waitFor, instruction) {
  // Wait for SPA to fully load
  await page.waitForTimeout(waitFor);
  
  // Wait for common SPA frameworks to initialize
  await page.evaluate(() => {
    return new Promise((resolve) => {
      // Check for React, Vue, Angular, etc.
      const checkFrameworks = () => {
        if (window.React || window.Vue || window.angular || document.querySelector('[data-reactroot]')) {
          resolve();
        } else {
          setTimeout(checkFrameworks, 500);
        }
      };
      checkFrameworks();
      
      // Fallback timeout
      setTimeout(resolve, 5000);
    });
  });
  
  return await performScrape(page, '', 2000, true, instruction);
}

/**
 * Extract all meaningful links from the page
 */
async function extractPageLinks(page, instruction) {
  const links = await page.evaluate(() => {
    const linkElements = document.querySelectorAll('a[href]');
    return Array.from(linkElements).map(link => ({
      text: link.textContent.trim(),
      url: link.href,
      title: link.title || ''
    })).filter(link => 
      link.text && 
      link.text.length > 2 && 
      link.url.startsWith('http')
    );
  });
  
  if (links.length === 0) {
    return `🔗 No meaningful links found on ${page.url()}`;
  }
  
  // Filter and score links based on instruction
  const relevantLinks = filterRelevantLinks(links, instruction);
  
  const result = `🔗 Links extracted from ${page.url()}:\n\n`;
  const topLinks = relevantLinks.slice(0, 10);
  
  return result + topLinks.map((link, index) => 
    `${index + 1}. [${link.text}](${link.url})`
  ).join('\n');
}

/**
 * Auto-scroll the page to load dynamic content
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 3000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Find all clickable elements on the page with their selectors
 */
async function findClickableElements(page, instruction) {
  const clickables = await page.evaluate(() => {
    const elements = [];
    
    // Find all clickable elements
    const selectors = [
      'a[href]',           // Links
      'button',            // Buttons
      '[onclick]',         // Elements with onclick
      '[role="button"]',   // ARIA buttons
      '.btn, .button',     // Common button classes
      '[data-toggle]',     // Bootstrap toggles
      '.nav-link',         // Navigation links
      '.tab',              // Tab elements
      '.dropdown-toggle',  // Dropdowns
      '[data-week]',       // Week elements (for sports sites)
      '[data-match]',      // Match elements
      '.week',             // Week classes
      '.match',            // Match classes
      '.game',             // Game elements
      '.result'            // Result elements
    ];
    
    selectors.forEach(selector => {
      const found = document.querySelectorAll(selector);
      found.forEach((el, index) => {
        const text = el.textContent?.trim() || el.alt || el.title || '';
        const href = el.href || '';
        const id = el.id || '';
        const className = el.className || '';
        
        if (text.length > 0 || href.length > 0) {
          elements.push({
            selector: `${selector}:nth-of-type(${index + 1})`,
            text: text.substring(0, 100),
            href: href,
            id: id,
            className: className,
            tagName: el.tagName.toLowerCase(),
            visible: el.offsetParent !== null
          });
        }
      });
    });
    
    return elements.filter(el => el.visible && el.text.length > 0);
  });
  
  // Filter clickables based on instruction
  const relevantClickables = filterRelevantClickables(clickables, instruction);
  
  let result = `🖱️ **Clickable Elements Found** (${clickables.length} total, ${relevantClickables.length} relevant):\n\n`;
  
  if (relevantClickables.length === 0) {
    result += '⚠️ No relevant clickable elements found for your search criteria.\n\n';
    result += '**All Available Clickables:**\n';
    clickables.slice(0, 10).forEach((el, index) => {
      result += `${index + 1}. **${el.tagName}**: "${el.text}"\n`;
      result += `   Selector: \`${el.selector}\`\n`;
      if (el.href) result += `   URL: ${el.href}\n`;
      result += '\n';
    });
  } else {
    result += '**Most Relevant Clickables:**\n';
    relevantClickables.slice(0, 8).forEach((el, index) => {
      result += `${index + 1}. **${el.tagName}**: "${el.text}" (score: ${el.score})\n`;
      result += `   Selector: \`${el.selector}\`\n`;
      if (el.href) result += `   URL: ${el.href}\n`;
      result += '\n';
    });
  }
  
  return result;
}

/**
 * Smart navigation: find relevant clickables and try clicking them to find data
 */
async function smartNavigateAndScrape(page, instruction, waitFor = 3000) {
  let results = [];
  
  results.push(`🤖 **Smart Navigation Started**: Looking for "${instruction}"`);
  results.push(`📍 **Current URL**: ${page.url()}`);
  results.push(`⏱️ **Wait Time**: ${waitFor}ms per interaction\n`);
  
  // First, find all clickable elements
  const clickables = await page.evaluate(() => {
    const elements = [];
    
    // Prioritize sports/schedule related elements
    const prioritySelectors = [
      'a[href*="week"]',
      'a[href*="match"]', 
      'a[href*="result"]',
      'a[href*="game"]',
      '.week a',
      '.match a',
      '.game a',
      '.result a',
      '[data-week] a',
      '[data-match] a'
    ];
    
    const generalSelectors = [
      'a[href]',
      'button',
      '.btn',
      '.nav-link',
      '.tab'
    ];
    
    // Check priority selectors first
    [...prioritySelectors, ...generalSelectors].forEach(selector => {
      const found = document.querySelectorAll(selector);
      found.forEach((el, index) => {
        const text = el.textContent?.trim() || '';
        const href = el.href || el.getAttribute('href') || '';
        
        if (text.length > 0 && el.offsetParent !== null) {
          elements.push({
            selector: `${selector}:nth-of-type(${index + 1})`,
            text: text.substring(0, 50),
            href: href,
            isPriority: prioritySelectors.some(ps => el.matches(ps))
          });
        }
      });
    });
    
    // Remove duplicates and sort by priority
    const unique = elements.filter((el, index, arr) => 
      index === arr.findIndex(e => e.text === el.text && e.href === el.href)
    );
    
    return unique.sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return 0;
    });
  });
  
  // Filter and score clickables based on instruction
  const relevantClickables = filterRelevantClickables(clickables, instruction);
  
  results.push(`🔍 **Scan Results**: Found ${clickables.length} total clickables, ${relevantClickables.length} relevant to "${instruction}"`);
  
  if (relevantClickables.length > 0) {
    results.push(`🎯 **Top Targets**:`);
    relevantClickables.slice(0, 3).forEach((el, i) => {
      results.push(`   ${i + 1}. "${el.text}" (score: ${el.score})`);
    });
  }
  results.push('');
  
  // Try clicking the most relevant elements (max 3 attempts)
  const maxAttempts = Math.min(3, relevantClickables.length);
  
  for (let i = 0; i < maxAttempts; i++) {
    const clickable = relevantClickables[i];
    
    try {
      results.push(`🖱️ **Attempt ${i + 1}/${maxAttempts}**: Clicking "${clickable.text}"`);
      results.push(`   📍 Selector: ${clickable.selector}`);
      
      // Click the element
      await page.click(clickable.selector);
      results.push(`   ✅ Click successful, waiting ${waitFor}ms for page response...`);
      
      // Wait for navigation/content change
      await page.waitForTimeout(waitFor);
      
      // Try to wait for network to be idle (new content loaded)
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        results.push(`   🌐 Network settled, new content loaded`);
      } catch (e) {
        results.push(`   ⚠️ Network still loading, continuing anyway...`);
      }
      
      // Extract content from the new page
      const newContent = await page.evaluate(() => {
        // Remove scripts and styles
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());
        
        return document.body ? document.body.innerText : '';
      });
      
      // Check if we found relevant content
      const keywords = instruction.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      const contentLower = newContent.toLowerCase();
      const foundKeywords = keywords.filter(keyword => contentLower.includes(keyword));
      
      results.push(`   📊 **Content Analysis**: ${newContent.length} chars, ${foundKeywords.length}/${keywords.length} keywords matched`);
      results.push(`   🔑 **Found Keywords**: ${foundKeywords.join(', ') || 'none'}`);
      
      if (foundKeywords.length > 0 && newContent.length > 200) {
        results.push(`   ✅ **SUCCESS!** Relevant content found, analyzing...`);
        
        // Analyze the content
        const { summarizeContent } = await import('./contentAnalysis.js');
        const analysis = await summarizeContent(newContent, 6, instruction);
        
        results.push(`\n**📄 Content Analysis:**\n${analysis}`);
        results.push(`\n🔗 **Final URL**: ${page.url()}`);
        
        break; // Success! Stop trying more clicks
      } else {
        results.push(`   ❌ **Content not relevant** (${foundKeywords.length} keywords, ${newContent.length} chars)`);
        results.push(`   🔙 Going back to try next option...\n`);
        // Go back to try the next clickable
        try {
          await page.goBack();
          await page.waitForTimeout(2000);
        } catch (e) {
          results.push(`   ⚠️ **Cannot go back**, ending navigation`);
          break;
        }
      }
      
    } catch (error) {
      results.push(`   ❌ **Click failed**: ${error.message}`);
      results.push(`   🔄 Trying next option...\n`);
      continue;
    }
  }
  
  if (maxAttempts === 0) {
    results.push(`⚠️ **No Navigation Possible**: No relevant clickable elements found for "${instruction}"`);
    results.push(`📋 **Recommendation**: Try using "find-clickables" action to see what's available on this page`);
  } else {
    results.push(`\n🏁 **Navigation Complete**: Tried ${maxAttempts} elements, see results above`);
  }
  
  return results.join('\n');
}

/**
 * Filter clickables based on relevance to instruction
 */
function filterRelevantClickables(clickables, instruction) {
  if (!instruction || instruction === 'extract main content') {
    return clickables;
  }
  
  const keywords = instruction.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  return clickables
    .map(clickable => {
      let score = 0;
      const text = clickable.text.toLowerCase();
      const href = clickable.href.toLowerCase();
      
      keywords.forEach(keyword => {
        if (text.includes(keyword)) score += 3;
        if (href.includes(keyword)) score += 2;
        
        // Special scoring for common patterns
        if (keyword === 'week' && (text.includes('week') || href.includes('week'))) score += 5;
        if (keyword === 'match' && (text.includes('match') || text.includes('game'))) score += 5;
        if (keyword === 'result' && (text.includes('result') || text.includes('score'))) score += 5;
        if (keyword === 'carolina' && text.includes('carolina')) score += 4;
        if (keyword === 'seattle' && text.includes('seattle')) score += 4;
        if (keyword === 'spinners' && text.includes('spinners')) score += 4;
        if (keyword === 'rush' && text.includes('rush')) score += 4;
      });
      
      // Boost priority elements
      if (clickable.isPriority) score += 2;
      
      return { ...clickable, score };
    })
    .filter(clickable => clickable.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Filter links based on relevance to instruction
 */
function filterRelevantLinks(links, instruction) {
  if (!instruction || instruction === 'extract main content') {
    return links;
  }
  
  const keywords = instruction.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  return links
    .map(link => {
      let score = 0;
      const linkText = link.text.toLowerCase();
      const linkUrl = link.url.toLowerCase();
      
      keywords.forEach(keyword => {
        if (linkText.includes(keyword)) score += 3;
        if (linkUrl.includes(keyword)) score += 2;
        if (link.title && link.title.toLowerCase().includes(keyword)) score += 1;
      });
      
      return { ...link, score };
    })
    .filter(link => link.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Browser tool configuration for agent toolkit
 */
export const BROWSER_TOOLKIT = {
  browser: {
    name: 'browser',
    description: 'Browser automation for JavaScript-heavy sites, SPAs, and dynamic content',
    examples: [
      'browser("https://example.com", "scrape", {waitFor: 5000})',
      'browser("https://spa-site.com", "spa-scrape", {instruction: "find prices"})',
      'browser("https://site.com", "wait-and-scrape", {selector: ".content", scrollDown: true})',
      'browser("https://page.com", "links", {instruction: "documentation"})',
      'browser("https://sports.com", "find-clickables", {instruction: "week 10 results"})',
      'browser("https://schedule.com", "smart-navigate", {instruction: "Carolina vs Seattle match result"})'
    ],
    actions: ['scrape', 'screenshot', 'interact', 'wait-and-scrape', 'spa-scrape', 'links', 'find-clickables', 'smart-navigate'],
    use_cases: [
      'JavaScript-heavy sites that need browser rendering',
      'Single Page Applications (React, Vue, Angular)',
      'Dynamic content that loads after initial page load',
      'Sites requiring scrolling or interaction to load content',
      'Complex web apps with client-side routing',
      'Sports sites with match results behind navigation links',
      'Schedule sites where you need to click weeks/games to see details',
      'Any site where initial page lacks data and you need to click deeper'
    ]
  }
};