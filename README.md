# Everything Bot - AI-Powered Telegram Assistant

🏆 **AWS Lambda Hackathon 2025 Submission**

## 🎯 What It Is

Intelligent Telegram bot that fact-checks information, analyzes conversations, and provides AI-powered assistance in group chats. Built entirely on AWS serverless architecture.

**Live Bot**: [@LetMeCheckThatBot](https://t.me/LetMeCheckThatBot)

## 🚀 Key Features

- **Real-time Fact Checking** - Web search with source verification
- **Conversation Analysis** - AI summaries and insights  
- **Image Analysis** - OCR, object recognition, custom prompts
- **Smart Search** - Natural language search across chat history
- **Multiple Personalities** - Scientist, detective, chef, engineer personas
- **Audio Processing** - Voice transcription and generation
- **Team Tools** - Usage limits, admin dashboard, message management

## 🏗️ AWS Services Used

- **AWS Lambda** - Main application runtime (Node.js 18.x)
- **API Gateway** - HTTPS webhook for Telegram
- **Amazon S3** - Conversation storage and media files
- **CloudWatch** - Monitoring and logs
- **Lambda Layers** - FFmpeg for media processing

## ⚡ Usage Examples

```
robot what's the weather today?
scientist-bot explain quantum computing
robot analyze this image and extract the text
robot search our chat for "project deadline"
/usage - Check daily limits
/clearmessages 5 - Delete bot's last 5 messages
```

## 🔧 Architecture

```
Telegram → API Gateway → Lambda → OpenAI/Search APIs
                                 ↓
                              S3 Storage
                                 ↓
                           CloudWatch Logs
```

**Serverless Benefits:**
- Auto-scaling for unlimited users
- Pay-per-use cost model
- Zero server management
- Global availability

## 🚀 Quick Deploy

```bash
npm install
npm run deploy
npm run set-env
```

**Environment Variables:**
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
OPENAI_API_KEY=your_openai_key
S3_BUCKET_NAME=your_s3_bucket
SERPER_API_KEY=your_serper_key
```

## 📊 Stats

- **5,000+** lines of code
- **6** AWS services integrated
- **15+** AI capabilities
- **<3s** cold start time
- **74MB** optimized package

## 🎯 Business Value

**Problem**: Teams waste hours fact-checking and searching scattered chat messages.

**Solution**: AI assistant that instantly verifies claims, analyzes conversations, and provides intelligent search - saving 80% of manual effort.

## 🛠️ Admin Dashboard

Local web interface at `localhost:3002` for:
- Browse chat rooms and messages
- Configure usage limits per room
- Unsend bot messages
- View statistics and files

## 🔐 Security

- ✅ Secure API key management
- ✅ Input validation and sanitization  
- ✅ Rate limiting and usage controls
- ✅ S3 security with IAM policies

## 📞 Created By

**Daniel Nakhla** - AI Systems Developer

**Docs**: [dnakhla.github.io/Everything-Bot](https://dnakhla.github.io/Everything-Bot/)

---

*Demonstrating real-world serverless AI applications with AWS Lambda*