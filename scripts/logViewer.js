#!/usr/bin/env node

import { spawn } from 'child_process';
import readline from 'readline';
import chalk from 'chalk';
import { S3Manager } from '../services/s3Manager.js';
import { CONFIG } from '../config.js';

// ANSI escape codes for terminal control
const CLEAR_SCREEN = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

class LogViewer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.chatRooms = new Map();
    this.currentView = 'menu';
    this.selectedChat = null;
    this.logBuffer = [];
    this.maxLogLines = 100;
    this.isLiveTailing = false;
    this.awsProcess = null;
  }

  // Colors and formatting
  formatLog(line) {
    // Extract timestamp, request ID, and log level
    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})/);
    const requestMatch = line.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
    const levelMatch = line.match(/\s(INFO|ERROR|WARN|DEBUG)\s/);
    const messageMatch = line.match(/\[(.*?)\]\s(.+)/);

    let formatted = line;

    // Color by log level
    if (levelMatch) {
      const level = levelMatch[1];
      switch (level) {
      case 'ERROR':
        formatted = chalk.red(formatted);
        break;
      case 'WARN':
        formatted = chalk.yellow(formatted);
        break;
      case 'INFO':
        formatted = chalk.blue(formatted);
        break;
      case 'DEBUG':
        formatted = chalk.gray(formatted);
        break;
      }
    }

    // Highlight timestamps
    if (timestampMatch) {
      formatted = formatted.replace(timestampMatch[1], chalk.cyan(timestampMatch[1]));
    }

    // Highlight request IDs
    if (requestMatch) {
      formatted = formatted.replace(requestMatch[1], chalk.magenta(requestMatch[1].substring(0, 8) + '...'));
    }

    // Highlight chat IDs
    formatted = formatted.replace(/chat ID (-?\d+)/g, chalk.green('chat ID $1'));
        
    // Highlight message IDs
    formatted = formatted.replace(/message_id: (\d+)/g, chalk.yellow('message_id: $1'));

    // Highlight tool names
    formatted = formatted.replace(/Tool selected: (\w+)/g, `Tool selected: ${chalk.magenta('$1')}`);

    return formatted;
  }

  async loadChatRooms() {
    try {
      console.log(chalk.blue('📡 Loading chat rooms from S3...'));
            
      // List all chat room files from S3
      const AWS = await import('@aws-sdk/client-s3');
      const s3Client = new AWS.S3Client({ region: CONFIG.AWS_REGION });
            
      const command = new AWS.ListObjectsV2Command({
        Bucket: CONFIG.S3_BUCKET_NAME,
        Prefix: 'fact_checker_bot/groups/'
      });
            
      const response = await s3Client.send(command);
            
      if (response.Contents) {
        for (const object of response.Contents) {
          const key = object.Key;
          const chatIdMatch = key.match(/groups\/(-?\d+)\.json$/);
          if (chatIdMatch) {
            const chatId = chatIdMatch[1];
                        
            // Load recent messages for this chat
            try {
              const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
              const messages = data?.messages || [];
              const recentMessages = messages.slice(-5); // Last 5 messages
                            
              // Get chat title from messages if available
              const chatTitle = messages.find(m => m.chat_title)?.chat_title || `Chat ${chatId}`;
                            
              this.chatRooms.set(chatId, {
                title: chatTitle,
                messageCount: messages.length,
                recentMessages: recentMessages,
                lastActivity: object.LastModified
              });
            } catch (error) {
              console.log(chalk.red(`Failed to load messages for chat ${chatId}: ${error.message}`));
            }
          }
        }
      }
            
      console.log(chalk.green(`✅ Loaded ${this.chatRooms.size} chat rooms`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to load chat rooms: ${error.message}`));
    }
  }

  displayMenu() {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.blue('🤖 Telegram Bot Log Viewer\n'));
        
    console.log(chalk.yellow('📊 Chat Rooms:'));
    console.log(chalk.gray('─'.repeat(80)));
        
    if (this.chatRooms.size === 0) {
      console.log(chalk.red('No chat rooms found'));
      return;
    }

    const sortedChats = Array.from(this.chatRooms.entries()).sort((a, b) => {
      return new Date(b[1].lastActivity) - new Date(a[1].lastActivity);
    });

    sortedChats.forEach(([chatId, info], index) => {
      const number = chalk.cyan(`${index + 1}.`);
      const title = chalk.bold.white(info.title);
      const messageCount = chalk.gray(`(${info.messageCount} messages)`);
      const lastActivity = chalk.blue(new Date(info.lastActivity).toLocaleString());
            
      console.log(`${number} ${title} ${messageCount}`);
      console.log(`   Last activity: ${lastActivity}`);
            
      // Show last message preview
      if (info.recentMessages.length > 0) {
        const lastMsg = info.recentMessages[info.recentMessages.length - 1];
        const preview = lastMsg.message_text?.substring(0, 60) || '[No text]';
        const sender = lastMsg.message_from || 'Unknown';
        console.log(`   ${chalk.gray('💬')} ${chalk.green(sender)}: ${chalk.gray(preview)}${preview.length >= 60 ? '...' : ''}`);
      }
      console.log();
    });

    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('1-' + sortedChats.length)} - View chat details`);
    console.log(`${chalk.cyan('live')} - Start live log tailing`);
    console.log(`${chalk.cyan('refresh')} - Reload chat rooms`);
    console.log(`${chalk.cyan('quit')} - Exit`);
    console.log();
  }

  displayChatDetails(chatId) {
    console.log(CLEAR_SCREEN);
    const chat = this.chatRooms.get(chatId);
    if (!chat) {
      console.log(chalk.red('Chat not found'));
      return;
    }

    console.log(chalk.bold.blue(`🔍 Chat Details: ${chat.title}`));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`${chalk.yellow('Chat ID:')} ${chatId}`);
    console.log(`${chalk.yellow('Total Messages:')} ${chat.messageCount}`);
    console.log(`${chalk.yellow('Last Activity:')} ${new Date(chat.lastActivity).toLocaleString()}`);
    console.log();

    console.log(chalk.yellow('📝 Recent Messages:'));
    console.log(chalk.gray('─'.repeat(80)));

    chat.recentMessages.forEach((msg, index) => {
      const timestamp = msg.timestamp?.friendly || 'Unknown time';
      const sender = msg.message_from || 'Unknown';
      const text = msg.message_text || '[No text content]';
      const isBot = msg.isBot ? '🤖' : '👤';
            
      console.log(`${chalk.cyan(timestamp)} ${isBot} ${chalk.green(sender)}`);
      console.log(`  ${chalk.white(text)}`);
      console.log();
    });

    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('back')} - Return to main menu`);
    console.log(`${chalk.cyan('live')} - Start live log tailing for this chat`);
    console.log(`${chalk.cyan('all')} - Show all messages for this chat`);
    console.log(`${chalk.cyan('quit')} - Exit`);
    console.log();
  }

  startLiveTailing(chatId = null) {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.green('📡 Live Log Tailing'));
    if (chatId) {
      console.log(chalk.blue(`Filtering for chat ID: ${chatId}`));
    }
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    this.isLiveTailing = true;
        
    // Start AWS CloudWatch logs tail
    this.awsProcess = spawn('aws', [
      'logs', 'tail', '/aws/lambda/FactCheckerBot-LambdaFunction',
      '--region', 'us-east-1',
      '--follow',
      '--format', 'short'
    ]);

    this.awsProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          // Filter by chat ID if specified
          if (chatId && !line.includes(`chat ID ${chatId}`)) {
            return;
          }
                    
          const formatted = this.formatLog(line);
          console.log(formatted);
        }
      });
    });

    this.awsProcess.stderr.on('data', (data) => {
      console.log(chalk.red(data.toString()));
    });

    this.awsProcess.on('close', (code) => {
      this.isLiveTailing = false;
      console.log(chalk.yellow(`\nLog tailing stopped (exit code: ${code})`));
      this.promptUser();
    });
  }

  stopLiveTailing() {
    if (this.awsProcess) {
      this.awsProcess.kill('SIGTERM');
      this.awsProcess = null;
    }
    this.isLiveTailing = false;
  }

  async promptUser() {
    if (this.isLiveTailing) return;

    process.stdout.write(chalk.cyan('> '));
        
    this.rl.once('line', async (input) => {
      const command = input.trim().toLowerCase();
            
      if (command === 'quit' || command === 'exit' || command === 'q') {
        this.cleanup();
        return;
      }
            
      if (command === 'refresh' || command === 'r') {
        this.chatRooms.clear();
        await this.loadChatRooms();
        this.currentView = 'menu';
        this.displayMenu();
        this.promptUser();
        return;
      }
            
      if (command === 'live' || command === 'l') {
        this.startLiveTailing();
        return;
      }
            
      if (command === 'back' || command === 'b') {
        this.currentView = 'menu';
        this.selectedChat = null;
        this.displayMenu();
        this.promptUser();
        return;
      }

      if (this.currentView === 'menu') {
        // Check if it's a number (chat selection)
        const chatIndex = parseInt(command) - 1;
        const sortedChats = Array.from(this.chatRooms.keys()).sort((a, b) => {
          const aTime = this.chatRooms.get(a).lastActivity;
          const bTime = this.chatRooms.get(b).lastActivity;
          return new Date(bTime) - new Date(aTime);
        });
                
        if (chatIndex >= 0 && chatIndex < sortedChats.length) {
          this.selectedChat = sortedChats[chatIndex];
          this.currentView = 'chat';
          this.displayChatDetails(this.selectedChat);
          this.promptUser();
          return;
        }
      }
            
      if (this.currentView === 'chat') {
        if (command === 'live' || command === 'l') {
          this.startLiveTailing(this.selectedChat);
          return;
        }
                
        if (command === 'all' || command === 'a') {
          await this.showAllMessages(this.selectedChat);
          this.promptUser();
          return;
        }
      }
            
      console.log(chalk.red('Unknown command. Try again.'));
      this.promptUser();
    });
  }

  async showAllMessages(chatId) {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.blue(`📜 All Messages for Chat ${chatId}`));
    console.log(chalk.gray('─'.repeat(80)));
        
    try {
      const key = `fact_checker_bot/groups/${chatId}.json`;
      const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
      const messages = data?.messages || [];
            
      messages.forEach((msg, index) => {
        const timestamp = msg.timestamp?.friendly || 'Unknown time';
        const sender = msg.message_from || 'Unknown';
        const text = msg.message_text || '[No text content]';
        const isBot = msg.isBot ? '🤖' : '👤';
        const messageId = msg.messageId ? chalk.gray(`[${msg.messageId}]`) : '';
                
        console.log(`${chalk.cyan(timestamp)} ${isBot} ${chalk.green(sender)} ${messageId}`);
        console.log(`  ${chalk.white(text)}`);
        console.log();
      });
            
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.yellow(`Total: ${messages.length} messages`));
            
    } catch (error) {
      console.log(chalk.red(`Failed to load messages: ${error.message}`));
    }
        
    console.log(chalk.yellow('\nPress Enter to continue...'));
    await new Promise(resolve => {
      this.rl.once('line', resolve);
    });
        
    this.displayChatDetails(chatId);
  }

  cleanup() {
    console.log(SHOW_CURSOR);
    this.stopLiveTailing();
    this.rl.close();
    process.exit(0);
  }

  async start() {
    console.log(HIDE_CURSOR);
        
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      if (this.isLiveTailing) {
        this.stopLiveTailing();
        this.displayMenu();
        this.promptUser();
      } else {
        this.cleanup();
      }
    });

    console.log(chalk.blue('Starting log viewer...'));
    await this.loadChatRooms();
    this.displayMenu();
    this.promptUser();
  }
}

// Start the application
const viewer = new LogViewer();
viewer.start().catch(error => {
  console.error(chalk.red('Failed to start log viewer:', error.message));
  process.exit(1);
});