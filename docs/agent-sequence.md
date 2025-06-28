# Everything Bot - Multi-Agent Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant TB as Telegram Bot
    participant AR as Agent Router
    participant PM as Persona Manager
    participant CM as Context Manager
    participant MM as Memory Manager
    participant TA as Transcription Agent
    participant SA as Search Agent
    participant FA as Fact-Check Agent
    participant GPT as OpenAI GPT-4
    participant APIs as External APIs
    participant S3 as S3 Storage

    Note over User, S3: Message Processing
    User->>TB: "fact-bot is climate change real?" + voice message
    TB->>AR: Route incoming message
    AR->>AR: Parse message type and persona

    Note over User, S3: Persona & Context Setup
    AR->>PM: Identify persona (fact-bot)
    PM->>PM: Load fact-checking persona traits
    PM->>CM: Set context for factual analysis
    CM->>MM: Retrieve relevant conversation history
    MM->>S3: Query past climate discussions
    S3-->>MM: Return historical context
    MM-->>CM: Provide memory context

    Note over User, S3: Multi-Agent Orchestration
    CM->>TA: Process voice message
    TA->>GPT: Transcribe audio using Whisper
    GPT-->>TA: Return transcription
    TA-->>CM: "Is climate change caused by humans?"

    CM->>SA: Research climate change evidence
    SA->>APIs: Search for recent climate data
    APIs-->>SA: Scientific papers, IPCC reports
    SA->>FA: Verify source credibility
    FA->>GPT: Cross-reference multiple sources
    GPT-->>FA: Fact-check analysis
    FA-->>SA: Verified factual data
    SA-->>CM: Compiled research results

    Note over User, S3: Response Generation
    CM->>PM: Generate fact-based response
    PM->>GPT: Create response with fact-bot persona
    Note right of GPT: Persona Instructions:<br/>- Use scientific evidence<br/>- Cite credible sources<br/>- Maintain objective tone<br/>- Provide data-driven conclusions
    GPT-->>PM: Persona-styled factual response

    Note over User, S3: Memory & Storage
    PM->>MM: Store interaction for future reference
    MM->>S3: Save conversation + fact-check results
    S3-->>MM: Confirm storage

    Note over User, S3: Response Delivery
    PM->>AR: Final response ready
    AR->>TB: Send formatted response
    TB->>User: Deliver fact-checked answer with sources

    Note over User, S3: Follow-up Memory Query
    User->>TB: "memory-bot what did we discuss about climate?"
    TB->>AR: Route memory query
    AR->>MM: Search conversation history
    MM->>S3: Query climate-related discussions
    S3-->>MM: Return conversation summaries
    MM->>GPT: Summarize historical discussions
    GPT-->>MM: "You asked about climate change evidence..."
    MM->>TB: Deliver memory-based response
    TB->>User: "2 weeks ago you asked about climate change..."

    Note over User, S3: The system maintains persistent memory across sessions,<br/>enabling contextual conversations and learning user preferences
```

## Interaction Flow Description

### 1. Message Processing
The user sends a message with a persona prefix ("fact-bot") and voice content. The Telegram Bot receives this and routes it to the Agent Router for processing.

### 2. Persona & Context Setup
- **Agent Router** parses the message to identify the requested persona
- **Persona Manager** loads the specific traits for "fact-bot" persona
- **Context Manager** receives the context and requests relevant history
- **Memory Manager** queries S3 for past climate-related discussions

### 3. Multi-Agent Orchestration
- **Transcription Agent** processes the voice message using OpenAI Whisper
- **Search Agent** researches climate change evidence from external APIs
- **Fact-Check Agent** verifies source credibility and cross-references information
- All agents coordinate through the Context Manager

### 4. Response Generation
The Persona Manager generates a response using the fact-bot persona with:
- Scientific evidence emphasis
- Credible source citations
- Objective tone
- Data-driven conclusions

### 5. Memory & Storage
The interaction is stored in S3 for future reference, enabling the bot to remember and reference past conversations.

### 6. Follow-up Capabilities
Users can query past conversations using "memory-bot", demonstrating the system's persistent memory and contextual awareness across sessions.