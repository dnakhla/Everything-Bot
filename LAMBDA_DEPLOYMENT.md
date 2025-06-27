# Lambda Deployment Guide

## 📋 Prerequisites

### Required Lambda Layers
1. **FFmpeg Layer** (for video/GIF processing):
   - Use AWS Serverless Application Repository: `serverlesspub-ffmpeg-nodejs`
   - Or create custom layer with FFmpeg binaries at `/opt/bin/ffmpeg` and `/opt/bin/ffprobe`

### Environment Variables
```bash
# Core Configuration
OPENAI_API_KEY=your_openai_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
S3_BUCKET_NAME=your_s3_bucket
SERPER_API_KEY=your_serper_api_key

# Lambda Optimizations (automatically detected)
AWS_LAMBDA_FUNCTION_NAME=your_function_name  # Set automatically by Lambda
```

## ⚙️ Lambda Configuration

### Recommended Settings
```yaml
Runtime: Node.js 18.x or 20.x
Memory: 1024 MB (minimum for video processing)
Timeout: 5 minutes (300 seconds)
Architecture: x86_64 (required for FFmpeg layer)
```

### Layers Required
1. **FFmpeg Layer**: `arn:aws:lambda:region:your-account:layer:ffmpeg:version`
2. **Optional**: Node.js native modules layer if using additional dependencies

## 🚀 Deployment Methods

### Method 1: AWS SAM
```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  EverythingBotFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: index.handler
      Runtime: nodejs18.x
      Timeout: 300
      MemorySize: 1024
      Environment:
        Variables:
          OPENAI_API_KEY: !Ref OpenAIApiKey
          TELEGRAM_BOT_TOKEN: !Ref TelegramBotToken
          S3_BUCKET_NAME: !Ref S3BucketName
          SERPER_API_KEY: !Ref SerperApiKey
      Layers:
        - !Ref FFmpegLayer
```

### Method 2: AWS CLI
```bash
# Package and deploy
zip -r function.zip . -x "*.git*" "node_modules/.cache/*" "tests/*"
aws lambda update-function-code \
  --function-name EverythingBot \
  --zip-file fileb://function.zip
```

### Method 3: Serverless Framework
```yaml
# serverless.yml
service: everything-bot

provider:
  name: aws
  runtime: nodejs18.x
  memorySize: 1024
  timeout: 300

functions:
  telegram:
    handler: index.handler
    layers:
      - ${self:custom.ffmpegLayerArn}
    environment:
      OPENAI_API_KEY: ${env:OPENAI_API_KEY}
      TELEGRAM_BOT_TOKEN: ${env:TELEGRAM_BOT_TOKEN}
      S3_BUCKET_NAME: ${env:S3_BUCKET_NAME}
      SERPER_API_KEY: ${env:SERPER_API_KEY}
```

## 🔧 Lambda-Specific Optimizations

### Code Optimizations
- **Reduced loop limits**: 7 iterations max (vs 10 locally)
- **Tool timeouts**: 45 seconds max per tool execution
- **Content size limits**: 50KB max to prevent memory issues
- **Efficient imports**: Only load required modules

### Performance Features
- **Cold start optimization**: Minimal import dependencies
- **Memory management**: Automatic content size limiting
- **Timeout handling**: Graceful degradation on timeouts
- **Error resilience**: Robust error handling for Lambda constraints

### Video Processing
- **FFmpeg detection**: Automatically detects Lambda layer availability
- **Fallback handling**: Graceful degradation when FFmpeg unavailable
- **Memory efficient**: Processes videos in streaming mode
- **Timeout aware**: Respects Lambda execution limits

## 📊 Monitoring & Debugging

### CloudWatch Logs
Key log patterns to monitor:
```
[INFO] FFmpeg configured: /opt/bin/ffmpeg
[INFO] Executing agent tool: search
[ERROR] Tool execution timeout
[INFO] Lambda execution completed in 45.2s
```

### Common Issues & Solutions

**FFmpeg Not Found**:
```
Solution: Ensure FFmpeg layer is attached and has correct ARN
Check: /opt/bin/ directory exists with ffmpeg and ffprobe binaries
```

**Timeout Errors**:
```
Solution: Increase Lambda timeout or reduce MAX_LOOPS in agentConfig.js
Monitor: Tool execution times in CloudWatch
```

**Memory Issues**:
```
Solution: Increase Lambda memory allocation
Monitor: Memory usage patterns in CloudWatch
```

## 🧪 Testing

### Local Testing
```bash
# Test with Lambda environment variables
AWS_LAMBDA_FUNCTION_NAME=test-function npm test

# Test specific tool execution
node -e "process.env.AWS_LAMBDA_FUNCTION_NAME='test'; import('./tools/agentToolkit.js')"
```

### Lambda Testing
```bash
# Test with AWS CLI
aws lambda invoke \
  --function-name EverythingBot \
  --payload file://test-event.json \
  response.json
```

## 🔒 Security Considerations

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream", 
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Environment Security
- Use AWS Secrets Manager for sensitive API keys
- Enable encryption at rest for environment variables
- Use VPC endpoints for S3 access if required
- Implement proper error handling to avoid information leakage

## 📈 Cost Optimization

### Memory Allocation
- **1024 MB**: Recommended for video processing
- **512 MB**: Minimum for basic operations
- **2048 MB**: For heavy video processing loads

### Timeout Settings
- **60 seconds**: Basic chat operations
- **180 seconds**: Image processing
- **300 seconds**: Video processing (maximum)

### Concurrent Executions
- Set reserved concurrency based on Telegram webhook requirements
- Monitor and adjust based on usage patterns
- Consider provisioned concurrency for consistent performance