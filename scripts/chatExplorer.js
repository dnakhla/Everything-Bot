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
        { name: '💬 List all chats', value: 'listUsers' },
        { name: '📄 View chat messages', value: 'viewMessages' },
        { name: '🔍 Search messages', value: 'search' },
        { name: '📊 Recent activity', value: 'activity' },
        { name: '📈 Show stats', value: 'stats' },
        { name: '🗑️ Delete chat', value: 'deleteChat' },
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
    case 'deleteChat': await selectChatForDeletion(); break;
    case 'exit': 
      console.log(chalk.green('\nGoodbye! 👋\n'));
      process.exit(0);
      break;
  }
}

// List all users
async function listUsers() {
  try {
    console.log(chalk.yellow('\n📋 Loading chats...\n'));
    
    const result = await S3Manager.listObjects('fact_checker_bot/groups/');
    users = [];
    
    // Load each chat file to get the chat title
    for (const obj of (result.Contents || [])) {
      if (obj.Key.endsWith('.json')) {
        try {
          const fileName = obj.Key.split('/').pop();
          const chatId = fileName.replace('.json', '');
          
          // Load chat data to get the title
          const chatData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, obj.Key);
          
          let chatName = `Chat ${chatId}`;
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            // Get chat title from the first message that has it
            const messageWithTitle = chatData.messages.find(msg => msg.chat_title);
            if (messageWithTitle && messageWithTitle.chat_title) {
              chatName = messageWithTitle.chat_title;
            }
          }
          
          users.push({ 
            id: chatId, 
            name: chatName,
            messageCount: chatData?.messages?.length || 0
          });
        } catch (error) {
          console.log(`Skipping corrupted chat file: ${obj.Key}`);
        }
      }
    }

    if (users.length === 0) {
      console.log(chalk.red('No chats found.'));
    } else {
      const table = new Table({
        head: [chalk.cyan('#'), chalk.cyan('Chat Name'), chalk.cyan('Chat ID'), chalk.cyan('Messages')],
        colWidths: [4, 35, 15, 10]
      });

      // Sort by message count (most active first)
      users.sort((a, b) => b.messageCount - a.messageCount);

      users.forEach((user, index) => {
        table.push([index + 1, user.name, user.id, user.messageCount]);
      });

      console.log(chalk.green(`Found ${users.length} chats:\n`));
      console.log(table.toString());
    }
    
    await showMenu();
  } catch (error) {
    console.error(chalk.red('Error loading users:', error.message));
    await showMenu();
  }
}

// Select chat and view messages
async function selectUserForMessages() {
  if (users.length === 0) {
    console.log(chalk.red('\nNo chats loaded. Please list chats first.'));
    await showMenu();
    return;
  }

  const { user } = await inquirer.prompt([
    {
      type: 'list',
      name: 'user',
      message: 'Select a chat to view messages:',
      choices: users.map(user => ({
        name: `${user.name} (${user.messageCount} messages)`,
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
        head: [chalk.cyan('#'), chalk.cyan('Sender'), chalk.cyan('Time'), chalk.cyan('Message')],
        colWidths: [4, 15, 12, 70],
        wordWrap: true
      });

      messages.forEach((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.isBot ? 'Bot' : (msg.senderName || 'Unknown');
        const content = msg.content.length > 70 ? 
          msg.content.substring(0, 70) + '...' : msg.content;
        
        table.push([index + 1, sender, date, content]);
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
    // Load the chat file from the new storage format
    const key = `fact_checker_bot/groups/${chatId}.json`;
    const chatData = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
    
    if (!chatData || !chatData.messages) {
      return [];
    }

    // Sort messages by timestamp and get recent ones
    const sortedMessages = chatData.messages
      .sort((a, b) => (b.timestamp?.unix || 0) - (a.timestamp?.unix || 0))
      .slice(0, limit);

    // Convert to the expected format for the UI
    return sortedMessages.map(msg => ({
      content: msg.message_text || '[No content]',
      role: msg.isBot ? 'assistant' : 'user',
      timestamp: msg.timestamp?.unix || Date.now(),
      messageId: msg.messageId,
      from: msg.message_from,
      senderName: typeof msg.message_from === 'string' ? msg.message_from : 'Unknown',
      isBot: msg.isBot
    }));
  } catch (error) {
    console.error('Error getting messages:', error.message);
    return [];
  }
}

// Search messages
async function searchMessages() {
  const { term } = await inquirer.prompt([
    {
      type: 'input',
      name: 'term',
      message: 'Enter search term:'
    }
  ]);

  if (!term.trim()) {
    console.log('Please enter a search term.');
    await showMenu();
    return;
  }

  console.log(`\n🔍 Searching for "${term}"...\n`);

  try {
    const results = [];
    
    // Search across all users
    for (const user of users) {
      const messages = await getRecentMessages(user.id, 100);
      const matches = messages.filter(msg => 
        msg.content && msg.content.toLowerCase().includes(term.toLowerCase())
      );
      
      matches.forEach(msg => {
        results.push({
          ...msg,
          userName: user.name,
          userId: user.id,
          senderName: msg.senderName,
          isBot: msg.isBot
        });
      });
    }

    if (results.length === 0) {
      console.log('No messages found containing that term.');
    } else {
      console.log(`Found ${results.length} results:\n`);
      results.slice(0, 10).forEach((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleString();
        const sender = msg.isBot ? 'Bot' : (msg.senderName || 'Unknown');
        const content = msg.content && msg.content.length > 80 ? 
          msg.content.substring(0, 80) + '...' : (msg.content || '[No content]');
        
        console.log(`${index + 1}. ${sender} in ${msg.userName} [${date}]`);
        console.log(`   ${content}\n`);
      });

      if (results.length > 10) {
        console.log(`... and ${results.length - 10} more results`);
      }
    }
  } catch (error) {
    console.error('Search error:', error.message);
  }

  await showMenu();
}

// Search in specific user chat
async function searchInUserChat(chatId) {
  const { term } = await inquirer.prompt([
    {
      type: 'input',
      name: 'term',
      message: 'Enter search term:'
    }
  ]);

  if (!term.trim()) {
    console.log('Please enter a search term.');
    await viewUserMessages(chatId);
    return;
  }

  console.log(`\n🔍 Searching in ${selectedUser.name}'s chat for "${term}"...\n`);

  try {
    const messages = await getRecentMessages(chatId, 200);
    const results = messages.filter(msg => 
      msg.content && msg.content.toLowerCase().includes(term.toLowerCase())
    );

    if (results.length === 0) {
      console.log('No messages found containing that term.');
    } else {
      console.log(`Found ${results.length} results:\n`);
      results.forEach((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleString();
        const sender = msg.isBot ? 'Bot' : (msg.senderName || 'Unknown');
        
        console.log(`${index + 1}. ${sender} [${date}]`);
        console.log(`   ${msg.content || '[No content]'}\n`);
      });
    }
  } catch (error) {
    console.error('Search error:', error.message);
  }

  await viewUserMessages(chatId);
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
        msg.timestamp > oneDayAgo
      );

      if (recentMessages.length > 0) {
        activity.push({
          user: user.name,
          userId: user.id,
          messageCount: recentMessages.length,
          lastMessage: recentMessages[0] // Most recent first due to sorting
        });
      }
    }

    if (activity.length === 0) {
      console.log('No recent activity found.');
    } else {
      activity.sort((a, b) => b.messageCount - a.messageCount);
      
      console.log('Most active chats today:\n');
      activity.forEach((item, index) => {
        const lastTime = new Date(item.lastMessage.timestamp).toLocaleTimeString();
        console.log(`${index + 1}. ${item.user} - ${item.messageCount} messages (last: ${lastTime})`);
      });
    }
  } catch (error) {
    console.error('Error getting recent activity:', error.message);
  }

  await showMenu();
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

// Select chat for deletion
async function selectChatForDeletion() {
  if (users.length === 0) {
    console.log(chalk.red('\nNo chats loaded. Please list chats first.'));
    await showMenu();
    return;
  }

  const { user } = await inquirer.prompt([
    {
      type: 'list',
      name: 'user',
      message: '🗑️ Select a chat to DELETE (this cannot be undone):',
      choices: [
        ...users.map(user => ({
          name: `${user.name} (${user.messageCount} messages) - ID: ${user.id}`,
          value: user
        })),
        { name: chalk.gray('← Back to main menu'), value: null }
      ]
    }
  ]);

  if (!user) {
    await showMenu();
    return;
  }

  await confirmAndDeleteChat(user);
}

// Confirm and delete chat
async function confirmAndDeleteChat(user) {
  console.log(chalk.yellow(`\n⚠️  WARNING: You are about to DELETE chat data for:`));
  console.log(chalk.white(`   Chat Name: ${user.name}`));
  console.log(chalk.white(`   Chat ID: ${user.id}`));
  console.log(chalk.white(`   Messages: ${user.messageCount}`));
  console.log(chalk.red(`\n   This action CANNOT be undone!`));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you absolutely sure you want to delete this chat?',
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.green('\n✅ Chat deletion cancelled.'));
    await showMenu();
    return;
  }

  // Double confirmation for safety
  const { doubleConfirm } = await inquirer.prompt([
    {
      type: 'input',
      name: 'doubleConfirm',
      message: `Type "DELETE ${user.id}" to confirm deletion:`,
      validate: (input) => {
        if (input === `DELETE ${user.id}`) {
          return true;
        }
        return `Please type exactly: DELETE ${user.id}`;
      }
    }
  ]);

  try {
    console.log(chalk.yellow('\n🗑️ Deleting chat data...'));
    
    // Delete the chat file from S3
    const key = `fact_checker_bot/groups/${user.id}.json`;
    await S3Manager.deleteObject(CONFIG.S3_BUCKET_NAME, key);
    
    // Remove from local users array
    const index = users.findIndex(u => u.id === user.id);
    if (index > -1) {
      users.splice(index, 1);
    }
    
    console.log(chalk.green(`\n✅ Successfully deleted chat: ${user.name}`));
    console.log(chalk.gray(`   Removed ${user.messageCount} messages from storage`));
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to delete chat: ${error.message}`));
    
    if (error.name === 'NoSuchKey' || error.code === 'NoSuchKey') {
      console.log(chalk.yellow('   The chat file may have already been deleted.'));
      // Remove from local array anyway
      const index = users.findIndex(u => u.id === user.id);
      if (index > -1) {
        users.splice(index, 1);
      }
    }
  }

  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: '🗑️ Delete another chat', value: 'deleteAnother' },
        { name: '💬 List remaining chats', value: 'listChats' },
        { name: '🏠 Back to main menu', value: 'mainMenu' }
      ]
    }
  ]);

  switch (nextAction) {
    case 'deleteAnother':
      await selectChatForDeletion();
      break;
    case 'listChats':
      await listUsers();
      break;
    default:
      await showMenu();
      break;
  }
}

// Initialize
async function init() {
  try {
    // Test S3 connection
    await S3Manager.listObjects('fact_checker_bot/groups/');
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