#!/usr/bin/env node

/**
 * Simple CLI Chat Explorer for Everything Bot
 * View users, chats, and recent activity quickly
 */

import { S3Manager } from '../services/s3Manager.js';
import { CONFIG } from '../config.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';

const s3 = new S3Manager();

console.log(chalk.blue.bold('\n🤖 Everything Bot - Chat Explorer'));
console.log(chalk.gray('=====================================\n'));

let users = [];
let selectedUser = null;

// Main menu
async function showMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '👥 List all users', value: 'listUsers' },
        { name: '💬 View user messages', value: 'viewMessages' },
        { name: '🔍 Search messages', value: 'search' },
        { name: '📊 Recent activity', value: 'activity' },
        { name: '📈 Show stats', value: 'stats' },
        { name: '🚪 Exit', value: 'exit' }
      ]
    }
  ]);

  switch(action) {
    case 'listUsers': await listUsers(); break;
    case 'viewMessages': await selectUserForMessages(); break;
    case 'search': await searchMessages(); break;
    case 'activity': await showRecentActivity(); break;
    case 'stats': await showStats(); break;
    case 'exit': 
      console.log(chalk.green('\nGoodbye! 👋\n'));
      process.exit(0);
      break;
  }
}

// List all users
async function listUsers() {
  try {
    console.log(chalk.yellow('\n📋 Loading users...\n'));
    
    const result = await s3.listObjects('');
    const chatIds = new Set();
    
    // Extract unique chat IDs from object keys
    result.Contents?.forEach(obj => {
      const parts = obj.Key.split('/');
      if (parts.length >= 2) {
        chatIds.add(parts[1]); // chat-{chatId}
      }
    });

    users = Array.from(chatIds).map(chatId => {
      const id = chatId.replace('chat-', '');
      return { id, name: `User ${id}` };
    });

    if (users.length === 0) {
      console.log(chalk.red('No users found.'));
    } else {
      const table = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('User'), chalk.cyan('Chat ID')],
        colWidths: [5, 20, 15]
      });

      users.forEach((user, index) => {
        table.push([index + 1, user.name, user.id]);
      });

      console.log(chalk.green(`Found ${users.length} users:\n`));
      console.log(table.toString());
    }
    
    await showMenu();
  } catch (error) {
    console.error(chalk.red('Error loading users:', error.message));
    await showMenu();
  }
}

// Select user and view messages
async function selectUserForMessages() {
  if (users.length === 0) {
    console.log(chalk.red('\nNo users loaded. Please list users first.'));
    await showMenu();
    return;
  }

  const { user } = await inquirer.prompt([
    {
      type: 'list',
      name: 'user',
      message: 'Select a user to view messages:',
      choices: users.map(user => ({
        name: `${user.name} (ID: ${user.id})`,
        value: user
      }))
    }
  ]);

  selectedUser = user;
  await viewUserMessages(user.id);
}

// View messages for a specific user
async function viewUserMessages(chatId) {
  try {
    console.log(chalk.yellow(`\n💬 Loading messages for ${selectedUser.name}...\n`));

    // Get recent messages
    const messages = await getRecentMessages(chatId, 20);
    
    if (messages.length === 0) {
      console.log(chalk.red('No messages found for this user.'));
    } else {
      const table = new Table({
        head: [chalk.cyan('#'), chalk.cyan('Type'), chalk.cyan('Time'), chalk.cyan('Message')],
        colWidths: [4, 6, 12, 80],
        wordWrap: true
      });

      messages.forEach((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleTimeString();
        const type = msg.role === 'user' ? '👤' : '🤖';
        const content = msg.content.length > 70 ? 
          msg.content.substring(0, 70) + '...' : msg.content;
        
        table.push([index + 1, type, date, content]);
      });

      console.log(chalk.green(`Last ${messages.length} messages:\n`));
      console.log(table.toString());
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '📄 View more messages', value: 'more' },
          { name: '🔍 Search in this chat', value: 'search' },
          { name: '🏠 Back to main menu', value: 'menu' }
        ]
      }
    ]);

    switch(action) {
      case 'more': await viewUserMessages(chatId); break;
      case 'search': await searchInUserChat(chatId); break;
      default: await showMenu(); break;
    }

  } catch (error) {
    console.error(chalk.red('Error loading messages:', error.message));
    await showMenu();
  }
}

// Get recent messages for a chat
async function getRecentMessages(chatId, limit = 20) {
  try {
    const messages = [];
    
    // List all message files for this chat
    const result = await s3.listObjects(`messages/chat-${chatId}/`);
    
    if (!result.Contents) return messages;

    // Sort by last modified and take recent ones
    const sortedFiles = result.Contents
      .filter(obj => obj.Key.endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .slice(0, limit);

    // Load each message
    for (const file of sortedFiles) {
      try {
        const data = await s3.getObject(file.Key);
        if (data) {
          const message = JSON.parse(data);
          messages.push(message);
        }
      } catch (err) {
        console.log(`Skipping corrupted file: ${file.Key}`);
      }
    }

    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (error) {
    console.error('Error getting messages:', error.message);
    return [];
  }
}

// Search messages
async function searchMessages() {
  rl.question('\nEnter search term: ', async (term) => {
    if (!term.trim()) {
      console.log('Please enter a search term.');
      showMenu();
      return;
    }

    console.log(`\n🔍 Searching for "${term}"...\n`);

    try {
      const results = [];
      
      // Search across all users
      for (const user of users) {
        const messages = await getRecentMessages(user.id, 100);
        const matches = messages.filter(msg => 
          msg.content.toLowerCase().includes(term.toLowerCase())
        );
        
        matches.forEach(msg => {
          results.push({
            ...msg,
            userName: user.name,
            userId: user.id
          });
        });
      }

      if (results.length === 0) {
        console.log('No messages found containing that term.');
      } else {
        console.log(`Found ${results.length} results:\n`);
        results.slice(0, 10).forEach((msg, index) => {
          const date = new Date(msg.timestamp).toLocaleString();
          const type = msg.role === 'user' ? '👤' : '🤖';
          const content = msg.content.length > 80 ? 
            msg.content.substring(0, 80) + '...' : msg.content;
          
          console.log(`${index + 1}. ${type} ${msg.userName} [${date}]`);
          console.log(`   ${content}\n`);
        });

        if (results.length > 10) {
          console.log(`... and ${results.length - 10} more results`);
        }
      }
    } catch (error) {
      console.error('Search error:', error.message);
    }

    showMenu();
  });
}

// Search in specific user chat
async function searchInUserChat(chatId) {
  rl.question('\nEnter search term: ', async (term) => {
    if (!term.trim()) {
      console.log('Please enter a search term.');
      await viewUserMessages(chatId);
      return;
    }

    console.log(`\n🔍 Searching in ${selectedUser.name}'s chat for "${term}"...\n`);

    try {
      const messages = await getRecentMessages(chatId, 200);
      const results = messages.filter(msg => 
        msg.content.toLowerCase().includes(term.toLowerCase())
      );

      if (results.length === 0) {
        console.log('No messages found containing that term.');
      } else {
        console.log(`Found ${results.length} results:\n`);
        results.forEach((msg, index) => {
          const date = new Date(msg.timestamp).toLocaleString();
          const type = msg.role === 'user' ? '👤' : '🤖';
          
          console.log(`${index + 1}. ${type} [${date}]`);
          console.log(`   ${msg.content}\n`);
        });
      }
    } catch (error) {
      console.error('Search error:', error.message);
    }

    await viewUserMessages(chatId);
  });
}

// Show recent activity
async function showRecentActivity() {
  console.log('\n📊 Recent Activity (Last 24 hours)...\n');

  try {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const activity = [];

    for (const user of users) {
      const messages = await getRecentMessages(user.id, 50);
      const recentMessages = messages.filter(msg => 
        new Date(msg.timestamp).getTime() > oneDayAgo
      );

      if (recentMessages.length > 0) {
        activity.push({
          user: user.name,
          userId: user.id,
          messageCount: recentMessages.length,
          lastMessage: recentMessages[recentMessages.length - 1]
        });
      }
    }

    if (activity.length === 0) {
      console.log('No recent activity found.');
    } else {
      activity.sort((a, b) => b.messageCount - a.messageCount);
      
      console.log('Most active users today:\n');
      activity.forEach((item, index) => {
        const lastTime = new Date(item.lastMessage.timestamp).toLocaleTimeString();
        console.log(`${index + 1}. ${item.user} - ${item.messageCount} messages (last: ${lastTime})`);
      });
    }
  } catch (error) {
    console.error('Error getting recent activity:', error.message);
  }

  showMenu();
}

// Show stats
async function showStats() {
  console.log('\n📈 Bot Statistics...\n');

  try {
    let totalMessages = 0;
    let totalUsers = users.length;
    let botMessages = 0;
    let userMessages = 0;

    for (const user of users) {
      const messages = await getRecentMessages(user.id, 1000);
      totalMessages += messages.length;
      
      messages.forEach(msg => {
        if (msg.role === 'assistant') {
          botMessages++;
        } else {
          userMessages++;
        }
      });
    }

    console.log(`Total Users: ${totalUsers}`);
    console.log(`Total Messages: ${totalMessages}`);
    console.log(`User Messages: ${userMessages}`);
    console.log(`Bot Messages: ${botMessages}`);
    console.log(`Bot Response Rate: ${totalMessages > 0 ? ((botMessages / totalMessages) * 100).toFixed(1) : 0}%`);

  } catch (error) {
    console.error('Error calculating stats:', error.message);
  }

  showMenu();
}

// Initialize
async function init() {
  try {
    // Test S3 connection
    await s3.listObjects('');
    console.log('✅ Connected to S3 storage\n');
    
    // Load users initially
    await listUsers();
  } catch (error) {
    console.error('❌ Failed to connect to S3:', error.message);
    console.log('\nPlease check your AWS credentials and S3 configuration.');
    process.exit(1);
  }
}

// Start the explorer
init();