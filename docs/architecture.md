# Everything Bot - Agentic AI Architecture

## System Architecture Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        TG[Telegram Groups]
        UM[User Messages]
        VM[Voice Messages]
        IM[Images/Videos]
    end

    subgraph "Agent Orchestration Layer"
        AR[Agent Router]
        PM[Persona Manager]
        CM[Context Manager]
        MM[Memory Manager]
    end

    subgraph "Specialized AI Agents"
        TA[Transcription Agent]
        VA[Video Analysis Agent]
        SA[Search Agent]
        FA[Fact-Check Agent]
        PA[Personality Agent]
        MA[Memory Agent]
    end

    subgraph "External APIs & Services"
        OAI[OpenAI GPT-4]
        SERP[Serper API]
        BRAVE[Brave Search]
        FFMPEG[FFmpeg Layer]
    end

    subgraph "Data Persistence"
        S3[AWS S3 Storage]
        CONV[Conversation History]
        META[Message Metadata]
    end

    subgraph "Infrastructure"
        AWS[AWS Lambda]
        TGB[Telegram Bot API]
        WEBHOOK[Webhook Handler]
    end

    TG --> UM
    TG --> VM
    TG --> IM
    
    UM --> AR
    VM --> AR
    IM --> AR
    
    AR --> PM
    AR --> CM
    AR --> MM
    
    PM --> PA
    CM --> TA
    CM --> VA
    CM --> SA
    CM --> FA
    CM --> MA
    
    TA --> OAI
    VA --> FFMPEG
    VA --> OAI
    SA --> SERP
    SA --> BRAVE
    FA --> OAI
    PA --> OAI
    MA --> S3
    
    MM --> S3
    CM --> CONV
    CM --> META
    
    AWS --> WEBHOOK
    WEBHOOK --> TGB
    TGB --> TG

    style AR fill:#ff6b6b
    style PM fill:#4ecdc4
    style CM fill:#45b7d1
    style MM fill:#96ceb4
    style TA fill:#feca57
    style VA fill:#ff9ff3
    style SA fill:#54a0ff
    style FA fill:#5f27cd
    style PA fill:#00d2d3
    style MA fill:#ff6348
```

## Agent Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant TelegramBot
    participant AgentRouter
    participant PersonaAgent
    participant ContextManager
    participant SpecializedAgent
    participant OpenAI
    participant Storage

    User->>TelegramBot: Send message with persona prefix
    TelegramBot->>AgentRouter: Route incoming message
    
    AgentRouter->>PersonaAgent: Identify persona type
    PersonaAgent->>ContextManager: Apply persona context
    
    ContextManager->>Storage: Retrieve conversation history
    Storage-->>ContextManager: Return relevant context
    
    ContextManager->>SpecializedAgent: Determine required tools
    
    alt Voice Message
        SpecializedAgent->>OpenAI: Transcribe audio
        OpenAI-->>SpecializedAgent: Return transcription
    else Image/Video
        SpecializedAgent->>OpenAI: Analyze visual content
        OpenAI-->>SpecializedAgent: Return analysis
    else Search Query
        SpecializedAgent->>OpenAI: Generate search query
        SpecializedAgent->>External APIs: Execute search
        External APIs-->>SpecializedAgent: Return results
    end
    
    SpecializedAgent->>PersonaAgent: Apply persona to response
    PersonaAgent->>OpenAI: Generate final response
    OpenAI-->>PersonaAgent: Return persona-styled response
    
    PersonaAgent->>Storage: Store interaction
    PersonaAgent->>TelegramBot: Send response
    TelegramBot->>User: Deliver message
```

## Multi-Agent Decision Tree

```mermaid
flowchart TD
    START([Incoming Message]) --> PARSE{Parse Message}
    
    PARSE -->|Voice Message| VOICE[Transcription Agent]
    PARSE -->|Image/Video| VISUAL[Video Analysis Agent] 
    PARSE -->|Text with Persona| PERSONA[Persona Agent]
    PARSE -->|Search Query| SEARCH[Search Agent]
    PARSE -->|Memory Query| MEMORY[Memory Agent]
    
    VOICE --> TRANSCRIBE[OpenAI Whisper API]
    TRANSCRIBE --> CONTEXT[Add to Context]
    
    VISUAL --> EXTRACT[FFmpeg Frame Extraction]
    EXTRACT --> ANALYZE[OpenAI Vision Analysis]
    ANALYZE --> CONTEXT
    
    PERSONA --> DETERMINE{Determine Persona Type}
    DETERMINE -->|fact-bot| FACT[Fact-Check Agent]
    DETERMINE -->|skeptic-bot| SKEPTIC[Critical Analysis Mode]
    DETERMINE -->|optimist-bot| OPTIMIST[Positive Response Mode]
    DETERMINE -->|conspiracy-bot| CONSPIRACY[Alternative Perspective]
    DETERMINE -->|bro-bot| CASUAL[Casual Explanation Mode]
    DETERMINE -->|memory-bot| MEMORY
    
    SEARCH --> WEBSEARCH[Web Search APIs]
    WEBSEARCH --> FACT
    
    MEMORY --> RETRIEVE[S3 Conversation Retrieval]
    RETRIEVE --> ANALYZE_CONTEXT[Context Analysis]
    ANALYZE_CONTEXT --> CONTEXT
    
    FACT --> CONTEXT
    SKEPTIC --> CONTEXT
    OPTIMIST --> CONTEXT
    CONSPIRACY --> CONTEXT
    CASUAL --> CONTEXT
    
    CONTEXT --> GENERATE[Generate Response with OpenAI]
    GENERATE --> STORE[Store in S3]
    STORE --> RESPOND[Send to Telegram]
    RESPOND --> END([End])

    style START fill:#e1f5fe
    style VOICE fill:#fff3e0
    style VISUAL fill:#f3e5f5
    style PERSONA fill:#e8f5e8
    style SEARCH fill:#fff8e1
    style MEMORY fill:#fce4ec
    style FACT fill:#e3f2fd
    style END fill:#e1f5fe
```

## Data Flow Architecture

```mermaid
graph LR
    subgraph "Input Processing"
        A[User Input] --> B[Message Parser]
        B --> C[Intent Recognition]
        C --> D[Agent Selection]
    end
    
    subgraph "Agent Execution"
        D --> E[Context Enrichment]
        E --> F[Tool Selection]
        F --> G[API Orchestration]
        G --> H[Response Generation]
    end
    
    subgraph "Memory & Learning"
        H --> I[Context Storage]
        I --> J[Pattern Learning]
        J --> K[Preference Adaptation]
    end
    
    subgraph "Output Delivery"
        H --> L[Response Formatting]
        L --> M[Persona Application]
        M --> N[Message Delivery]
    end
    
    K --> E
    I --> E
    
    style D fill:#ff6b6b
    style G fill:#4ecdc4
    style I fill:#feca57
    style M fill:#ff9ff3
```

## Technology Stack

```plantuml
@startuml
!define RECTANGLE class

RECTANGLE "Frontend Layer" {
  + Telegram Bot API
  + Webhook Handlers
  + Message Processing
}

RECTANGLE "Agent Orchestration" {
  + Agent Router
  + Context Manager
  + Persona Manager
  + Memory Manager
}

RECTANGLE "AI/ML Services" {
  + OpenAI GPT-4
  + Whisper API
  + Vision API
  + Custom Prompts
}

RECTANGLE "External APIs" {
  + Serper Search API
  + Brave Search API
  + Reddit API
  + Web Scraping
}

RECTANGLE "Media Processing" {
  + FFmpeg Layer
  + Video Frame Extraction
  + Audio Transcription
  + Image Analysis
}

RECTANGLE "Data Storage" {
  + AWS S3
  + Conversation History
  + User Preferences
  + Agent Memory
}

RECTANGLE "Infrastructure" {
  + AWS Lambda
  + Serverless Functions
  + Auto-scaling
  + Cost Optimization
}

"Frontend Layer" --> "Agent Orchestration"
"Agent Orchestration" --> "AI/ML Services"
"Agent Orchestration" --> "External APIs"
"Agent Orchestration" --> "Media Processing"
"Agent Orchestration" --> "Data Storage"
"Frontend Layer" --> "Infrastructure"
"Agent Orchestration" --> "Infrastructure"

@enduml
```

## Agent Capabilities Matrix

| Agent Type | Input Types | Processing | Output | Memory |
|------------|-------------|------------|---------|---------|
| **Transcription Agent** | Voice Messages | Whisper API | Text Transcription | Context History |
| **Video Analysis Agent** | Videos/GIFs | FFmpeg + Vision | Frame Analysis | Visual Memory |
| **Search Agent** | Text Queries | Multi-API Search | Web Results | Search Patterns |
| **Fact-Check Agent** | Claims/Statements | Cross-reference | Verification | Source Database |
| **Persona Agent** | Any Input | Style Adaptation | Persona Response | Personality Traits |
| **Memory Agent** | Context Queries | S3 Retrieval | Historical Data | Long-term Storage |

## Key Agentic AI Features

### 1. **Autonomous Decision Making**
- Agents automatically select appropriate tools based on input type
- Dynamic persona switching without manual configuration
- Self-directed search and fact-checking workflows

### 2. **Multi-Modal Processing**
- Voice → Text transcription with context preservation
- Video → Frame-by-frame analysis with temporal understanding
- Image → Object recognition and text extraction

### 3. **Persistent Memory**
- Conversation continuity across sessions
- User preference learning and adaptation
- Group context awareness and history

### 4. **Collaborative Agent Network**
- Agents share context and coordinate responses
- Hierarchical decision-making with specialized roles
- Dynamic tool selection and API orchestration

### 5. **Real-time Adaptation**
- Persona switching mid-conversation
- Context-aware response generation
- Learning from user feedback and interactions

## Business Impact & Scalability

- **Target Market**: 1B+ Telegram users in group chats
- **Use Cases**: Fantasy sports, gaming communities, work teams, educational groups
- **Monetization**: Freemium model with premium personalities and features
- **Scalability**: Serverless architecture with auto-scaling Lambda functions
- **Cost Efficiency**: Pay-per-use model with intelligent caching and optimization