# Usage Limits Structure Analysis

## Overview
This document describes the comprehensive usage limits structure now stored in S3 at `config/usage_limits.json` in the `telegram-bots-2025` bucket.

## Current Status
- **File Location**: `config/usage_limits.json` in S3 bucket `telegram-bots-2025`
- **Structure**: JSON object with room IDs as keys and configuration objects as values
- **Total Properties**: 27 different configuration properties available
- **Sample Configurations**: 3 (2 sample rooms + 1 default configuration)

## Complete Property List

### Basic Limits (Currently in Admin Interface)
1. **`messageLimit`** - Maximum messages per session/period
2. **`tokenLimit`** - Maximum tokens per session/period

### Extended Time-based Limits
3. **`dailyMessageLimit`** - Maximum messages per day
4. **`weeklyMessageLimit`** - Maximum messages per week  
5. **`monthlyMessageLimit`** - Maximum messages per month
6. **`dailyTokenLimit`** - Maximum tokens per day
7. **`monthlyTokenLimit`** - Maximum tokens per month

### Rate Limiting
8. **`rateLimitPerMinute`** - Maximum requests per minute
9. **`rateLimitPerHour`** - Maximum requests per hour

### Feature-specific Limits
10. **`maxImageAnalyses`** - Maximum image analysis requests
11. **`maxVoiceTranscriptions`** - Maximum voice transcription requests
12. **`maxWebSearches`** - Maximum web search requests
13. **`maxDocumentOCR`** - Maximum document OCR requests

### Cost Controls
14. **`maxCostPerMonth`** - Maximum cost per month (in USD)

### User & Room Limits
15. **`maxUsersPerRoom`** - Maximum users allowed in room
16. **`maxActiveUsers`** - Maximum active users at once

### Content Restrictions
17. **`maxMessageLength`** - Maximum message length in characters
18. **`maxFileSize`** - Maximum file size in bytes
19. **`allowedFileTypes`** - Array of allowed MIME types

### Feature Controls
20. **`enabledFeatures`** - Array of enabled features (e.g., "web_search", "image_analysis")
21. **`disabledCommands`** - Array of disabled commands
22. **`moderationLevel`** - Moderation level: "none", "standard", "strict"

### Time Restrictions
23. **`activeHours`** - Object with start/end times and timezone
    - `start`: "HH:MM" format
    - `end`: "HH:MM" format  
    - `timezone`: Timezone string (e.g., "UTC")

### Metadata
24. **`createdAt`** - ISO timestamp of creation
25. **`lastUpdated`** - ISO timestamp of last update
26. **`updatedBy`** - Who updated the configuration
27. **`notes`** - Human-readable notes about the configuration

## Sample Configurations

### Private Chat Configuration (Room: 987654321)
```json
{
  "messageLimit": 200,
  "tokenLimit": 20000,
  "dailyMessageLimit": 1000,
  "rateLimitPerMinute": 20,
  "maxImageAnalyses": 50,
  "maxVoiceTranscriptions": 30,
  "maxWebSearches": 100,
  "dailyTokenLimit": 100000,
  "monthlyTokenLimit": 1000000,
  "maxCostPerMonth": 25,
  "maxMessageLength": 8000,
  "enabledFeatures": ["web_search", "image_analysis", "voice_transcription", "document_ocr", "audio_generation"],
  "moderationLevel": "none",
  "activeHours": null,
  "notes": "Sample configuration for private chat with premium features"
}
```

### Group Chat Configuration (Room: -1001234567890)
```json
{
  "messageLimit": 100,
  "tokenLimit": 15000,
  "dailyMessageLimit": 500,
  "weeklyMessageLimit": 2000,
  "monthlyMessageLimit": 5000,
  "rateLimitPerMinute": 10,
  "rateLimitPerHour": 100,
  "maxImageAnalyses": 20,
  "maxVoiceTranscriptions": 10,
  "maxWebSearches": 30,
  "maxDocumentOCR": 5,
  "dailyTokenLimit": 50000,
  "monthlyTokenLimit": 500000,
  "maxCostPerMonth": 10,
  "maxUsersPerRoom": 100,
  "maxActiveUsers": 50,
  "maxMessageLength": 4000,
  "maxFileSize": 10485760,
  "allowedFileTypes": ["image/jpeg", "image/png", "image/gif", "audio/mpeg", "audio/wav", "text/plain"],
  "enabledFeatures": ["web_search", "image_analysis", "voice_transcription", "document_ocr"],
  "disabledCommands": [],
  "moderationLevel": "standard",
  "activeHours": {
    "start": "06:00",
    "end": "22:00", 
    "timezone": "UTC"
  },
  "notes": "Sample configuration for group chat"
}
```

### Default Configuration (Room: _default)
```json
{
  "messageLimit": 50,
  "tokenLimit": 10000,
  "dailyMessageLimit": 200,
  "weeklyMessageLimit": 1000,
  "rateLimitPerMinute": 5,
  "rateLimitPerHour": 50,
  "maxImageAnalyses": 10,
  "maxVoiceTranscriptions": 5,
  "maxWebSearches": 15,
  "maxDocumentOCR": 3,
  "dailyTokenLimit": 25000,
  "monthlyTokenLimit": 250000,
  "maxCostPerMonth": 5,
  "maxUsersPerRoom": 50,
  "maxMessageLength": 2000,
  "maxFileSize": 5242880,
  "allowedFileTypes": ["image/jpeg", "image/png", "image/gif", "audio/mpeg", "text/plain"],
  "enabledFeatures": ["web_search", "image_analysis"],
  "disabledCommands": ["admin", "debug"],
  "moderationLevel": "standard",
  "activeHours": {
    "start": "07:00",
    "end": "21:00",
    "timezone": "UTC"
  },
  "notes": "Default configuration applied to new rooms"
}
```

## Current Admin Interface Status

The existing admin interface in `/home/daniel/Projects/Everything-Bot/admin/server.js` currently only supports:
- `messageLimit`
- `tokenLimit`

**Lines 380-432** contain the current implementation that needs to be expanded.

## Recommendations for Admin Interface Enhancement

1. **Group Properties by Category** in the UI:
   - Basic Limits (messageLimit, tokenLimit)
   - Time-based Limits (daily, weekly, monthly)
   - Rate Limiting (per minute, per hour)
   - Feature Limits (image, voice, web search, OCR)
   - Cost Controls
   - Content Restrictions
   - Feature Controls
   - Time Restrictions
   - Metadata

2. **Add Validation** for:
   - Numeric limits (non-negative integers)
   - File size limits (bytes)
   - Time format validation (HH:MM)
   - MIME type validation
   - Feature name validation

3. **Add UI Components** for:
   - Array inputs (enabledFeatures, allowedFileTypes, disabledCommands)
   - Time picker for activeHours
   - Dropdown for moderationLevel
   - Rich text editor for notes

4. **Add Default Handling**:
   - Use `_default` configuration for new rooms
   - Fallback to sensible defaults if properties are missing

## API Endpoints That Need Updates

- `GET /api/room/:roomId/limits` - Expand to return all properties
- `POST /api/room/:roomId/limits` - Accept all properties in request body
- Consider adding `GET /api/room/:roomId/limits/schema` for dynamic form generation

## Files Involved

- **Analysis Script**: `/home/daniel/Projects/Everything-Bot/admin/examine_usage_limits.js`
- **Server API**: `/home/daniel/Projects/Everything-Bot/admin/server.js` (lines 380-432)
- **S3 Configuration**: `config/usage_limits.json` in bucket `telegram-bots-2025`
- **This Documentation**: `/home/daniel/Projects/Everything-Bot/admin/USAGE_LIMITS_STRUCTURE.md`