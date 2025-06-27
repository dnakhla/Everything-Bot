#!/usr/bin/env node

/**
 * Local Test Script for Everything Bot
 * 
 * This script simulates a Telegram webhook message to test the agent locally
 * without needing to deploy to Lambda or use the actual Telegram API.
 */

import { handler } from './index.js';

// Create a mock Telegram webhook event
function createTestEvent(messageText, chatId = -1001234567890) {
  return {
    httpMethod: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      update_id: Date.now(),
      message: {
        message_id: Math.floor(Math.random() * 100000),
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Test",
          last_name: "User",
          username: "testuser"
        },
        chat: {
          id: chatId,
          title: "Test Group",
          type: "supergroup"
        },
        date: Math.floor(Date.now() / 1000),
        text: messageText
      }
    })
  };
}

// Test different message types
const testCases = [
  {
    name: "Date query (your example)",
    message: "robot, what's the date today?"
  },
  {
    name: "Math calculation",
    message: "robot calculate 15% tip on $87.50"
  },
  {
    name: "Search query",
    message: "robot what's the latest news about AI?"
  },
  {
    name: "Personality bot",
    message: "scientist-bot, explain quantum computing"
  },
  {
    name: "Help command",
    message: "/help"
  },
  {
    name: "Regular message (should be saved)",
    message: "Just a regular conversation message"
  }
];

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📝 Message: "${testCase.message}"`);
  console.log('─'.repeat(50));
  
  try {
    const event = createTestEvent(testCase.message);
    const result = await handler(event);
    
    console.log(`✅ Status: ${result.statusCode}`);
    console.log(`📤 Response:`, JSON.parse(result.body));
    
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.error(error.stack);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Everything Bot Local Tests\n');
  console.log('This will test the agent toolkit with simulated Telegram messages');
  console.log('Note: Telegram API errors are expected in local testing (we use fake chat IDs)');
  console.log('Make sure you have your .env file configured with API keys\n');
  
  for (const testCase of testCases) {
    await runTest(testCase);
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 All tests completed!');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length > 0) {
  // Test with custom message
  const customMessage = args.join(' ');
  console.log('🧪 Testing custom message:', customMessage);
  
  const testCase = {
    name: "Custom message",
    message: customMessage
  };
  
  runTest(testCase);
} else {
  // Run all predefined tests
  runAllTests();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});