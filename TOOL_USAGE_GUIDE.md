# Everything Bot - Tool Usage Guide

## 🔍 SEARCH TOOL - Enhanced with SerpAPI
**Comprehensive search across multiple platforms with rich results**

### Basic Syntax
```
robot search "<query>" "<type>"
```

### Search Types & Examples

#### 1. **WEB SEARCH** (Default)
```
robot search "latest AI breakthrough 2024"
robot search "JavaScript async await best practices"
robot search "climate change data 2024"
```
**Returns:** Title, link, snippet, source for each result

#### 2. **NEWS SEARCH**
```
robot search "tesla stock price" "news"
robot search "election results 2024" "news"
robot search "cryptocurrency regulation" "news"
```
**Returns:** Title, link, summary, source, date, thumbnail

#### 3. **REDDIT SEARCH**
```
robot search "best programming languages 2024" "reddit"
robot search "cooking tips beginners" "reddit"
robot search "workout routine home" "reddit"
```
**Returns:** Reddit posts and discussions with community insights

#### 4. **YOUTUBE/VIDEO SEARCH**
```
robot search "python tutorial beginners" "videos"
robot search "how to change car oil" "videos"
robot search "guitar lessons acoustic" "videos"
```
**Returns:** Video title, link, thumbnail, channel, duration, views, published date

#### 5. **IMAGE SEARCH**
```
robot search "golden retriever puppies" "images"
robot search "modern kitchen design" "images"
robot search "sunset mountain photography" "images"
```
**Returns:** Image title, link, original URL, thumbnail, dimensions

#### 6. **PLACES/LOCAL SEARCH**
```
robot search "pizza restaurants near me" "places"
robot search "coffee shops downtown Seattle" "places"
robot search "gas stations highway 101" "places"
```
**Returns:** Business name, address, phone, rating, reviews, hours, website

#### 7. **ALTERNATIVE SOURCES**
```
robot search "tech industry analysis" "alternative"
robot search "political commentary independent" "alternative"
```
**Returns:** Results from Medium, Substack, HackerNews, ArsTechnica, etc.

---

## ⚡ RUN_CODE TOOL - JavaScript Sandbox
**Safe code execution for calculations and data processing**

### Mathematical Operations
```
robot run_code "Math.pow(2, 10) + Math.sqrt(144)"
robot run_code "Array.from({length: 10}, (_, i) => Math.factorial(i))"
robot run_code "const pi = Math.PI; pi * Math.pow(5, 2)" // Circle area
```

### Array & Data Processing
```
robot run_code "[1,2,3,4,5].filter(n => n % 2).map(n => n * n).reduce((a,b) => a + b)"
robot run_code "const data = [10,20,30,40,50]; data.reduce((a,b) => a + b) / data.length"
robot run_code "['apple','banana','cherry'].sort().reverse().join(' | ')"
```

### String Operations
```
robot run_code "'Hello World'.split('').reverse().join('').toLowerCase()"
robot run_code "const text = 'JavaScript is awesome'; text.match(/[aeiou]/gi).length"
robot run_code "'  trim this text  '.trim().toUpperCase().split(' ').join('-')"
```

### Date & Time
```
robot run_code "new Date().toISOString()"
robot run_code "Math.floor((new Date('2025-01-01') - new Date()) / (1000*60*60*24))"
robot run_code "new Date().getFullYear() + '-' + (new Date().getMonth() + 1)"
```

### Complex Algorithms
```
robot run_code "function fibonacci(n) { return n < 2 ? n : fibonacci(n-1) + fibonacci(n-2); } Array.from({length: 10}, (_, i) => fibonacci(i))"
robot run_code "const isPrime = n => { for(let i = 2; i <= Math.sqrt(n); i++) if(n % i === 0) return false; return n > 1; }; [2,3,4,5,6,7,8,9,10,11].filter(isPrime)"
```

---

## 🔍 ANALYZE TOOL - Universal Content Analysis
**AI-powered analysis for any content type**

### Text Analysis
```
robot analyze "This is a long article about climate change..." "text" "summarize in 3 key points"
robot analyze "User feedback: The app crashes when I click save" "text" "extract the main issue and severity"
robot analyze "Meeting transcript here..." "text" "identify action items and decisions"
```

### Image Analysis (OCR & Recognition)
```
robot analyze "https://example.com/document.jpg" "image" "extract all text from this document"
robot analyze "https://example.com/chart.png" "image" "describe the data and trends shown"
robot analyze "https://example.com/product.jpg" "image" "what product is this and describe its features"
```

### Document Processing
```
robot analyze "[PDF content]" "document" "summarize the main findings and recommendations"
robot analyze "[Spreadsheet data]" "document" "find patterns and anomalies in this data"
```

### Voice/Audio Transcription
```
robot analyze "[voice message file ID]" "voice" "transcribe this voice message"
robot analyze "[audio file]" "audio" "transcribe and analyze the speaker's tone"
```

### Video Analysis
```
robot analyze "https://youtube.com/watch?v=example" "video" "describe what happens in this video"
robot analyze "https://example.com/tutorial.mp4" "video" "extract the key learning points"
```

### Web Page Analysis
```
robot analyze "https://news.example.com/article" "url" "extract main facts and quotes"
robot analyze "https://docs.example.com/api" "url" "summarize the API endpoints and parameters"
```

---

## 🌐 FETCH_URL TOOL - Advanced Web Content Extraction
**Intelligent web scraping with content analysis**

### News Articles
```
robot fetch_url "https://cnn.com/breaking-news" "extract headline, key facts, and quotes"
robot fetch_url "https://techcrunch.com/startup-funding" "summarize the funding details and company info"
```

### Documentation
```
robot fetch_url "https://docs.openai.com/api/chat" "extract API endpoints and parameters"
robot fetch_url "https://react.dev/learn" "summarize the main learning concepts"
```

### Research Papers
```
robot fetch_url "https://arxiv.org/abs/2301.example" "summarize methodology and conclusions"
robot fetch_url "https://papers.ieee.org/document/example" "extract key technical contributions"
```

### Product Pages
```
robot fetch_url "https://amazon.com/product/example" "extract specs, price, and review summary"
robot fetch_url "https://apple.com/iphone" "compare features and pricing options"
```

---

## 💬 SEND_MESSAGES TOOL - Multi-Format Response Delivery
**Text and audio responses with smart formatting**

### Text Responses (Default)
```
// Automatically used when bot completes research
robot search "latest tech news"
// Bot automatically uses send_messages to deliver results
```

### Audio/Voice Responses
```
robot make voice message of "Hello, this is Everything Bot with your daily update..."
robot create audio summary of "Today's top 3 tech stories are..."
robot generate voice memo "Meeting notes: We discussed the quarterly budget..."
```

### Voice Options
- **Casual_Guy**: Friendly, conversational tone
- **Deep_Voice_Man**: Authoritative, professional
- **Calm_Woman**: Soothing, measured delivery
- **Lively_Girl**: Energetic, enthusiastic
- **Patient_Man**: Thoughtful, deliberate
- **Friendly_Person**: Balanced, approachable

### Emotional Tones
- **neutral**: Balanced delivery
- **happy**: Upbeat and positive
- **calm**: Relaxed and peaceful
- **excited**: Energetic and enthusiastic

---

## 🔍 SEARCH_MESSAGES TOOL - Conversation Memory & File Retrieval
**Comprehensive search through bot's memory and chat history**

### Search Conversation History
```
robot search_messages "bug report python error" // Find past discussions about bugs
robot search_messages "meeting notes from last week" // Locate meeting summaries
robot search_messages "project timeline" // Find project-related conversations
```

### Find User Activity
```
robot search_messages "@daniel" "user" // All messages from specific user
robot search_messages "john" "user" 7 30 // User 'john', last 7 days, 30 results max
```

### Locate Files & Media
```
robot search_messages "screenshot" "image" // Find shared images
robot search_messages "document pdf" "document" // Find PDF files
robot search_messages "voice memo" "voice" // Find voice messages with transcriptions
robot search_messages "video tutorial" "video" // Find shared videos
```

### Advanced Search Options
```
// Search with context - shows surrounding messages
robot search_messages "deployment failed" true // Include before/after context

// Search specific timeframe
robot search_messages "budget discussion" 14 // Last 14 days

// Search multiple message types
robot search_messages "presentation" ["document", "image"] // Files and images only
```

### What It Finds
- **Text messages** with full content
- **Files** with names, sizes, and IDs
- **Images** with OCR text extraction
- **Voice messages** with transcriptions
- **Documents** with analyzed summaries
- **User information** and timestamps
- **File metadata** for downloads

---

## 🎯 BEST PRACTICES & TIPS

### 1. **Combining Tools for Complex Tasks**
```
robot search "machine learning tutorials" "videos"
// Then: robot analyze [video URL] "video" "extract key learning points"
// Then: robot create voice memo of the summary
```

### 2. **Effective Search Queries**
- Use quotes for exact phrases: `"artificial intelligence"`
- Use Boolean operators: `AI AND ethics NOT marketing`
- Add year for recent info: `"climate change 2024"`
- Specify location: `"restaurants Seattle downtown"`

### 3. **Voice Message Strategy**
- Keep under 1200 characters (~1 minute)
- Use for summaries, updates, or explanations
- Let bot choose voice based on content tone
- Specify voice/emotion for specific needs

### 4. **Memory Search Tips**
- Start broad, then narrow down
- Use key terms from original conversations
- Search by file types when looking for attachments
- Include context for better understanding

### 5. **Content Analysis Approach**
- Be specific about what you want extracted
- Use different instructions for different goals
- Combine with search for comprehensive research
- Save important analyses to memory

---

## 📋 QUICK REFERENCE

| **Task** | **Tool** | **Example** |
|----------|----------|-------------|
| Find current news | search | `robot search "AI breakthrough" "news"` |
| Calculate complex math | run_code | `robot run_code "Math.factorial(10) / Math.pow(2, 5)"` |
| Extract text from image | analyze | `robot analyze [image] "image" "extract all text"` |
| Get webpage summary | fetch_url | `robot fetch_url "https://example.com" "summarize main points"` |
| Create voice message | send_messages | Bot automatically creates audio when requested |
| Find old conversation | search_messages | `robot search_messages "project deadline"` |

**Remember:** You can also just reply to any bot message without using "robot" prefix!