# Everything Bot - Agent Selection Decision Tree

```mermaid
flowchart TD
    Start([Incoming Message]) --> MsgType{Message Type?}
    
    %% Voice Message Path
    MsgType -->|Voice Message| TransAgent[Activate Transcription Agent]
    TransAgent --> Whisper[Process with Whisper API]
    Whisper --> TextConvert[Convert to text context]
    
    %% Image/Video Path
    MsgType -->|Image/Video| VideoAgent[Activate Video Analysis Agent]
    VideoAgent --> FFmpeg[Extract frames with FFmpeg]
    FFmpeg --> Vision[Analyze with Vision API]
    
    %% Text Message Path
    MsgType -->|Text Message| HasPersona{Contains Persona Prefix?}
    
    %% Persona Handling
    HasPersona -->|Yes| PersonaType{Persona Type?}
    PersonaType -->|fact-bot| FactAgent[Activate Fact-Check Agent<br/>Research mode with citations]
    PersonaType -->|skeptic-bot| SkepticAgent[Activate Critical Analysis Agent<br/>Question assumptions]
    PersonaType -->|optimist-bot| OptimistAgent[Activate Positive Response Agent<br/>Focus on opportunities]
    PersonaType -->|conspiracy-bot| ConspiracyAgent[Activate Alternative Perspective Agent<br/>Explore hidden connections]
    PersonaType -->|bro-bot| BroAgent[Activate Casual Explanation Agent<br/>Use simple, friendly language]
    PersonaType -->|memory-bot| MemoryAgent[Activate Memory Retrieval Agent<br/>Search conversation history]
    PersonaType -->|Custom Persona| AdaptiveAgent[Activate Adaptive Persona Agent<br/>Generate custom personality]
    
    %% No Persona Path
    HasPersona -->|No Persona| HasQuestion{Contains Question Words?}
    HasQuestion -->|Yes| SearchAgent[Activate Search Agent<br/>Web research and fact-checking]
    HasQuestion -->|No| PastConvo{Mentions Past Conversation?}
    PastConvo -->|Yes| MemoryAgent2[Activate Memory Agent<br/>Retrieve historical context]
    PastConvo -->|No| DefaultAgent[Activate Default Conversational Agent<br/>Maintain group chat context]
    
    %% Context Coordination
    FactAgent --> ContextMgr[Context Manager Coordination]
    SkepticAgent --> ContextMgr
    OptimistAgent --> ContextMgr
    ConspiracyAgent --> ContextMgr
    BroAgent --> ContextMgr
    MemoryAgent --> ContextMgr
    AdaptiveAgent --> ContextMgr
    SearchAgent --> ContextMgr
    MemoryAgent2 --> ContextMgr
    DefaultAgent --> ContextMgr
    TextConvert --> ContextMgr
    Vision --> ContextMgr
    
    %% Memory Integration
    ContextMgr --> MemoryMgr[Memory Manager Integration]
    
    %% External Data Decision
    MemoryMgr --> NeedsData{Requires External Data?}
    NeedsData -->|Yes| DataType{Data Type?}
    DataType -->|Search Query| SerperAPI[Use Serper API<br/>Use Brave Search API]
    DataType -->|Fact Verification| FactVerify[Cross-reference sources<br/>Verify with multiple APIs]
    DataType -->|Reddit Discussion| RedditAPI[Search Reddit communities<br/>Analyze public sentiment]
    
    NeedsData -->|No| CachedKnowledge[Use cached knowledge]
    
    %% Response Generation
    SerperAPI --> GenerateResponse[Generate Response with OpenAI]
    FactVerify --> GenerateResponse
    RedditAPI --> GenerateResponse
    CachedKnowledge --> GenerateResponse
    
    GenerateResponse --> PersonaStyling[Apply Persona Styling]
    PersonaStyling --> StoreS3[Store Interaction in S3]
    StoreS3 --> SendTelegram[Send Response to Telegram]
    SendTelegram --> End([Complete])

    %% Styling
    classDef agentBox fill:#e1f5fe,stroke:#01579b
    classDef decisionBox fill:#fff3e0,stroke:#e65100
    classDef processBox fill:#f3e5f5,stroke:#4a148c
    classDef dataBox fill:#e8f5e8,stroke:#1b5e20
    
    class FactAgent,SkepticAgent,OptimistAgent,ConspiracyAgent,BroAgent,MemoryAgent,AdaptiveAgent,SearchAgent,MemoryAgent2,DefaultAgent,TransAgent,VideoAgent agentBox
    class MsgType,HasPersona,PersonaType,HasQuestion,PastConvo,NeedsData,DataType decisionBox
    class Whisper,FFmpeg,Vision,ContextMgr,MemoryMgr,GenerateResponse,PersonaStyling,StoreS3,SendTelegram processBox
    class SerperAPI,FactVerify,RedditAPI,CachedKnowledge dataBox
```

## Decision Tree Description

### Message Processing Flow

The Everything Bot uses a hierarchical decision tree for agent selection:

#### 1. **Message Type Detection**
- **Voice Messages** → Transcription Agent (Whisper API)
- **Images/Videos** → Video Analysis Agent (FFmpeg + Vision API)  
- **Text Messages** → Persona/Content Analysis

#### 2. **Persona Prefix Recognition**
When users include persona prefixes, specific agents activate:
- **fact-bot** → Fact-Check Agent (research mode with citations)
- **skeptic-bot** → Critical Analysis Agent (question assumptions)
- **optimist-bot** → Positive Response Agent (focus on opportunities)
- **conspiracy-bot** → Alternative Perspective Agent (explore hidden connections)
- **bro-bot** → Casual Explanation Agent (simple, friendly language)
- **memory-bot** → Memory Retrieval Agent (search conversation history)
- **Custom personas** → Adaptive Persona Agent (generate custom personality)

#### 3. **Content-Based Agent Selection**
For messages without persona prefixes:
- **Questions** → Search Agent (web research and fact-checking)
- **Past conversation references** → Memory Agent (retrieve historical context)
- **General chat** → Default Conversational Agent (maintain group context)

#### 4. **External Data Integration**
Based on agent needs:
- **Search queries** → Serper API, Brave Search API
- **Fact verification** → Cross-reference multiple sources
- **Reddit discussions** → Community search and sentiment analysis

#### 5. **Coordination & Memory**
- **Context Manager** coordinates between all agents
- **Memory Manager** stores every interaction in S3
- **Response Generation** applies persona styling before delivery

### Key Features

- **Hierarchical Decision Making**: Message type → Persona → Content analysis
- **Agent Coordination**: All agents work through Context Manager
- **Persistent Memory**: Every interaction stored for future context
- **External API Integration**: Multiple data sources for comprehensive responses
- **Adaptive Personalities**: Dynamic persona generation for custom requests