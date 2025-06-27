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

class ChatExplorer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.chatRooms = new Map();
    this.currentView = 'menu';
    this.selectedChat = null;
    this.searchResults = [];
    this.currentPage = 0;
    this.itemsPerPage = 10;
    this.isLiveTailing = false;
    this.awsProcess = null;
  }

  // Enhanced formatting with better colors and emojis
  formatMessage(msg, index) {
    const timestamp = msg.timestamp?.friendly || 'Unknown time';
    const sender = msg.message_from || 'Unknown';
    const text = msg.message_text || '[No text content]';
    const isBot = msg.isBot;
    const messageId = msg.messageId ? chalk.gray(`[${msg.messageId}]`) : '';
    const attachments = msg.attachments || [];
    
    const emoji = isBot ? '🤖' : '👤';
    const senderColor = isBot ? chalk.cyan : chalk.green;
    const timeColor = chalk.blue;
    const indexColor = chalk.yellow;
    
    let formattedText = text;
    if (text.length > 100) {
      formattedText = text.substring(0, 100) + chalk.gray('...');
    }
    
    // Add attachment indicators
    let attachmentInfo = '';
    if (attachments.length > 0) {
      const attachmentTypes = attachments.map(att => {
        const typeEmojis = {
          'photo': '📸',
          'document': '📄', 
          'audio': '🎵',
          'voice': '🎤',
          'video': '🎥',
          'video_note': '📹',
          'sticker': '🎭'
        };
        return typeEmojis[att.type] || '📎';
      });
      attachmentInfo = ` ${chalk.blue(attachmentTypes.join(''))}`;
    }
    
    return [
      `${indexColor(`${index + 1}.`)} ${timeColor(timestamp)} ${emoji} ${senderColor(sender)}${attachmentInfo} ${messageId}`,
      `   ${chalk.white(formattedText)}`,
      ''
    ].join('\n');
  }

  async loadChatRooms() {
    try {
      console.log(chalk.blue('📡 Loading chat rooms from S3...'));
      
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
            
            try {
              const data = await S3Manager.getFromS3(CONFIG.S3_BUCKET_NAME, key);
              const messages = data?.messages || [];
              const recentMessages = messages.slice(-5);
              
              // Get chat title and stats
              const chatTitle = messages.find(m => m.chat_title)?.chat_title || `Chat ${chatId}`;
              const userMessages = messages.filter(m => !m.isBot);
              const botMessages = messages.filter(m => m.isBot);
              const uniqueUsers = new Set(messages.filter(m => !m.isBot).map(m => m.message_from)).size;
              
              this.chatRooms.set(chatId, {
                title: chatTitle,
                messageCount: messages.length,
                userMessageCount: userMessages.length,
                botMessageCount: botMessages.length,
                uniqueUsers: uniqueUsers,
                recentMessages: recentMessages,
                lastActivity: object.LastModified,
                allMessages: messages
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
    console.log(chalk.bold.magenta('🔍 Telegram Chat Explorer\n'));
    
    console.log(chalk.yellow('📊 Chat Rooms:'));
    console.log(chalk.gray('─'.repeat(100)));
    
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
      const stats = chalk.gray(`(${info.messageCount} msgs, ${info.uniqueUsers} users, ${info.botMessageCount} bot)`);
      const lastActivity = chalk.blue(new Date(info.lastActivity).toLocaleString());
      
      console.log(`${number} ${title} ${stats}`);
      console.log(`   Last activity: ${lastActivity}`);
      
      // Show last message preview
      if (info.recentMessages.length > 0) {
        const lastMsg = info.recentMessages[info.recentMessages.length - 1];
        const preview = lastMsg.message_text?.substring(0, 80) || '[No text]';
        const sender = lastMsg.message_from || 'Unknown';
        const emoji = lastMsg.isBot ? '🤖' : '👤';
        console.log(`   ${emoji} ${chalk.green(sender)}: ${chalk.gray(preview)}${preview.length >= 80 ? '...' : ''}`);
      }
      console.log();
    });

    console.log(chalk.gray('─'.repeat(100)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('1-' + sortedChats.length)} - Explore chat`);
    console.log(`${chalk.cyan('search <term>')} - Search messages across all chats`);
    console.log(`${chalk.cyan('stats')} - Show detailed statistics`);
    console.log(`${chalk.cyan('live')} - Start live log tailing`);
    console.log(`${chalk.cyan('refresh')} - Reload chat rooms`);
    console.log(`${chalk.cyan('help')} - Show all commands`);
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
    console.log(chalk.gray('─'.repeat(100)));
    console.log(`${chalk.yellow('Chat ID:')} ${chatId}`);
    console.log(`${chalk.yellow('Total Messages:')} ${chat.messageCount} (${chat.userMessageCount} users + ${chat.botMessageCount} bot)`);
    console.log(`${chalk.yellow('Unique Users:')} ${chat.uniqueUsers}`);
    console.log(`${chalk.yellow('Last Activity:')} ${new Date(chat.lastActivity).toLocaleString()}`);
    console.log();

    console.log(chalk.yellow('📝 Recent Messages:'));
    console.log(chalk.gray('─'.repeat(100)));

    chat.recentMessages.forEach((msg, index) => {
      console.log(this.formatMessage(msg, index));
    });

    console.log(chalk.gray('─'.repeat(100)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('all')} - Show all messages`);
    console.log(`${chalk.cyan('search <term>')} - Search in this chat`);
    console.log(`${chalk.cyan('users')} - Show user statistics`);
    console.log(`${chalk.cyan('export')} - Export chat to file`);
    console.log(`${chalk.cyan('logs')} - View all logs for this chat`);
    console.log(`${chalk.cyan('delete')} - Delete this chat room`);
    console.log(`${chalk.cyan('live')} - Live tail logs for this chat`);
    console.log(`${chalk.cyan('back')} - Return to main menu`);
    console.log(`${chalk.cyan('quit')} - Exit`);
    console.log();
  }

  searchMessages(searchTerm, chatId = null) {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.green(`🔍 Search Results for: "${searchTerm}"`));
    
    if (chatId) {
      console.log(chalk.blue(`In chat: ${this.chatRooms.get(chatId).title}`));
    } else {
      console.log(chalk.blue('Across all chats'));
    }
    
    console.log(chalk.gray('─'.repeat(100)));

    this.searchResults = [];
    const searchLower = searchTerm.toLowerCase();

    const chatsToSearch = chatId ? [[chatId, this.chatRooms.get(chatId)]] : Array.from(this.chatRooms.entries());

    chatsToSearch.forEach(([cId, chat]) => {
      chat.allMessages.forEach((msg, msgIndex) => {
        if (msg.message_text && msg.message_text.toLowerCase().includes(searchLower)) {
          this.searchResults.push({
            chatId: cId,
            chatTitle: chat.title,
            message: msg,
            messageIndex: msgIndex
          });
        }
      });
    });

    if (this.searchResults.length === 0) {
      console.log(chalk.red('No messages found containing that term.'));
    } else {
      console.log(chalk.green(`Found ${this.searchResults.length} messages`));
      this.displaySearchResults();
    }

    console.log(chalk.gray('─'.repeat(100)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('next/n')} - Next page`);
    console.log(`${chalk.cyan('prev/p')} - Previous page`);
    console.log(`${chalk.cyan('export')} - Export search results`);
    console.log(`${chalk.cyan('back')} - Return to previous view`);
    console.log();
  }

  displaySearchResults() {
    const start = this.currentPage * this.itemsPerPage;
    const end = Math.min(start + this.itemsPerPage, this.searchResults.length);
    const results = this.searchResults.slice(start, end);

    console.log(chalk.blue(`\nPage ${this.currentPage + 1} of ${Math.ceil(this.searchResults.length / this.itemsPerPage)}`));
    console.log(chalk.blue(`Showing ${start + 1}-${end} of ${this.searchResults.length} results\n`));

    results.forEach((result, index) => {
      const globalIndex = start + index + 1;
      console.log(chalk.yellow(`${globalIndex}. ${chalk.white(result.chatTitle)} ${chalk.gray(`[${result.chatId}]`)}`));
      console.log(this.formatMessage(result.message, result.messageIndex));
    });
  }

  showStatistics() {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.magenta('📊 Chat Statistics\n'));

    const totalMessages = Array.from(this.chatRooms.values()).reduce((sum, chat) => sum + chat.messageCount, 0);
    const totalUserMessages = Array.from(this.chatRooms.values()).reduce((sum, chat) => sum + chat.userMessageCount, 0);
    const totalBotMessages = Array.from(this.chatRooms.values()).reduce((sum, chat) => sum + chat.botMessageCount, 0);
    const totalUsers = Array.from(this.chatRooms.values()).reduce((sum, chat) => sum + chat.uniqueUsers, 0);

    console.log(chalk.blue('📈 Overall Statistics:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.yellow('Total Chats:')} ${this.chatRooms.size}`);
    console.log(`${chalk.yellow('Total Messages:')} ${totalMessages}`);
    console.log(`${chalk.yellow('User Messages:')} ${totalUserMessages} (${((totalUserMessages/totalMessages)*100).toFixed(1)}%)`);
    console.log(`${chalk.yellow('Bot Messages:')} ${totalBotMessages} (${((totalBotMessages/totalMessages)*100).toFixed(1)}%)`);
    console.log(`${chalk.yellow('Total Users:')} ${totalUsers}`);
    console.log();

    console.log(chalk.blue('🏆 Top 10 Most Active Chats:'));
    console.log(chalk.gray('─'.repeat(80)));
    
    const sortedByActivity = Array.from(this.chatRooms.entries())
      .sort((a, b) => b[1].messageCount - a[1].messageCount)
      .slice(0, 10);

    sortedByActivity.forEach(([chatId, chat], index) => {
      const bar = '█'.repeat(Math.ceil((chat.messageCount / sortedByActivity[0][1].messageCount) * 20));
      console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.white(chat.title.substring(0, 30).padEnd(30))} ${chalk.green(bar)} ${chat.messageCount}`);
    });

    console.log(chalk.gray('\n─'.repeat(80)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('back')} - Return to main menu`);
    console.log();
  }

  showUserStats(chatId) {
    console.log(CLEAR_SCREEN);
    const chat = this.chatRooms.get(chatId);
    console.log(chalk.bold.blue(`👥 User Statistics: ${chat.title}\n`));

    const userStats = {};
    chat.allMessages.forEach(msg => {
      if (!msg.isBot) {
        const user = msg.message_from || 'Unknown';
        if (!userStats[user]) {
          userStats[user] = { count: 0, firstSeen: msg.timestamp?.unix || 0, lastSeen: msg.timestamp?.unix || 0 };
        }
        userStats[user].count++;
        if (msg.timestamp?.unix > userStats[user].lastSeen) userStats[user].lastSeen = msg.timestamp.unix;
        if (msg.timestamp?.unix < userStats[user].firstSeen || userStats[user].firstSeen === 0) userStats[user].firstSeen = msg.timestamp.unix;
      }
    });

    const sortedUsers = Object.entries(userStats).sort((a, b) => b[1].count - a[1].count);

    console.log(chalk.blue('📊 User Activity:'));
    console.log(chalk.gray('─'.repeat(80)));
    
    sortedUsers.forEach(([user, stats], index) => {
      const bar = '█'.repeat(Math.ceil((stats.count / sortedUsers[0][1].count) * 20));
      const lastSeen = stats.lastSeen ? new Date(stats.lastSeen).toLocaleDateString() : 'Unknown';
      console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.green(user.substring(0, 20).padEnd(20))} ${chalk.yellow(bar)} ${stats.count} msgs (last: ${lastSeen})`);
    });

    console.log(chalk.gray('\n─'.repeat(80)));
    console.log(chalk.yellow('Commands:'));
    console.log(`${chalk.cyan('back')} - Return to chat details`);
    console.log();
  }

  async exportChat(chatId, format = 'json') {
    const chat = this.chatRooms.get(chatId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chat_${chatId}_${timestamp}.${format}`;

    try {
      let content;
      if (format === 'json') {
        content = JSON.stringify({
          chatId,
          title: chat.title,
          exportedAt: new Date().toISOString(),
          messageCount: chat.messageCount,
          messages: chat.allMessages
        }, null, 2);
      } else if (format === 'txt') {
        content = `Chat Export: ${chat.title} (${chatId})\n`;
        content += `Exported: ${new Date().toLocaleString()}\n`;
        content += `Total Messages: ${chat.messageCount}\n\n`;
        content += '─'.repeat(80) + '\n\n';
        
        chat.allMessages.forEach(msg => {
          const timestamp = msg.timestamp?.friendly || 'Unknown time';
          const sender = msg.message_from || 'Unknown';
          const text = msg.message_text || '[No text content]';
          const type = msg.isBot ? '[BOT]' : '[USER]';
          
          content += `${timestamp} ${type} ${sender}:\n${text}\n\n`;
        });
      }

      const fs = await import('fs');
      fs.writeFileSync(filename, content);
      console.log(chalk.green(`✅ Chat exported to: ${filename}`));
    } catch (error) {
      console.log(chalk.red(`❌ Export failed: ${error.message}`));
    }
  }

  async viewAllLogs(chatId) {
    console.log(CLEAR_SCREEN);
    const chat = this.chatRooms.get(chatId);
    console.log(chalk.bold.blue(`📜 All Logs for Chat: ${chat.title}`));
    console.log(chalk.gray('─'.repeat(100)));
    console.log(chalk.blue('🔄 Fetching all AWS CloudWatch logs for this chat...'));
    console.log(chalk.gray('This may take a moment for large logs.\n'));

    try {
      // Use AWS CLI to get logs for this specific chat
      const { spawn } = await import('child_process');
      const awsProcess = spawn('aws', [
        'logs', 'filter-log-events',
        '--log-group-name', '/aws/lambda/FactCheckerBot-LambdaFunction',
        '--region', 'us-east-1',
        '--filter-pattern', `chat ID ${chatId}`,
        '--output', 'text',
        '--query', 'events[*].[eventTimestamp,message]'
      ]);

      let logData = '';
      awsProcess.stdout.on('data', (data) => {
        logData += data.toString();
      });

      awsProcess.stderr.on('data', (data) => {
        console.log(chalk.red(`Error: ${data.toString()}`));
      });

      awsProcess.on('close', (code) => {
        if (code === 0 && logData.trim()) {
          const lines = logData.trim().split('\n');
          
          console.log(chalk.green(`📊 Found ${lines.length} log entries for chat ${chatId}\n`));
          
          lines.forEach((line, index) => {
            if (line.trim()) {
              const [timestamp, ...messageParts] = line.split('\t');
              const message = messageParts.join('\t');
              
              if (timestamp && message) {
                const date = new Date(parseInt(timestamp));
                const formattedTime = chalk.cyan(date.toLocaleString());
                const formattedMessage = this.formatLogMessage(message);
                
                console.log(`${chalk.yellow(`${index + 1}.`)} ${formattedTime}`);
                console.log(`   ${formattedMessage}`);
                console.log();
              }
            }
          });
        } else if (code === 0) {
          console.log(chalk.yellow('No logs found for this chat.'));
        } else {
          console.log(chalk.red(`Failed to fetch logs (exit code: ${code})`));
        }
        
        console.log(chalk.gray('─'.repeat(100)));
        console.log(chalk.yellow('Press Enter to continue...'));
      });

      // Wait for the process to complete
      await new Promise(resolve => {
        awsProcess.on('close', resolve);
      });

      await new Promise(resolve => {
        this.rl.once('line', resolve);
      });

      this.displayChatDetails(chatId);
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed to fetch logs: ${error.message}`));
      console.log(chalk.yellow('Press Enter to continue...'));
      await new Promise(resolve => {
        this.rl.once('line', resolve);
      });
      this.displayChatDetails(chatId);
    }
  }

  formatLogMessage(message) {
    // Enhanced log formatting similar to logViewer
    let formatted = message;
    
    // Color by log level
    formatted = formatted.replace(/ERROR/g, chalk.red.bold('ERROR'));
    formatted = formatted.replace(/WARN/g, chalk.yellow.bold('WARN'));
    formatted = formatted.replace(/INFO/g, chalk.blue.bold('INFO'));
    formatted = formatted.replace(/DEBUG/g, chalk.gray('DEBUG'));
    
    // Highlight important elements
    formatted = formatted.replace(/chat ID (-?\d+)/g, chalk.green.bold('chat ID $1'));
    formatted = formatted.replace(/message_id: (\d+)/g, chalk.cyan('message_id: $1'));
    formatted = formatted.replace(/Tool selected: (\w+)/g, `Tool selected: ${chalk.magenta('$1')}`);
    
    // Highlight request IDs
    formatted = formatted.replace(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/g, 
      (match) => chalk.magenta(match.substring(0, 8) + '...'));
    
    return formatted;
  }

  async deleteChat(chatId) {
    console.log(CLEAR_SCREEN);
    const chat = this.chatRooms.get(chatId);
    console.log(chalk.bold.red(`🗑️  Delete Chat Room: ${chat.title}`));
    console.log(chalk.gray('─'.repeat(100)));
    console.log(chalk.yellow('⚠️  WARNING: This action cannot be undone!'));
    console.log(`${chalk.yellow('Chat ID:')} ${chatId}`);
    console.log(`${chalk.yellow('Total Messages:')} ${chat.messageCount}`);
    console.log(`${chalk.yellow('Chat Title:')} ${chat.title}`);
    console.log();
    console.log(chalk.red('This will permanently delete all messages and data for this chat room from S3.'));
    console.log();
    
    process.stdout.write(chalk.yellow('Type "DELETE" to confirm, or anything else to cancel: '));
    
    return new Promise((resolve) => {
      this.rl.once('line', async (input) => {
        if (input.trim() === 'DELETE') {
          try {
            console.log(chalk.blue('🔄 Deleting chat room from S3...'));
            
            const AWS = await import('@aws-sdk/client-s3');
            const s3Client = new AWS.S3Client({ region: CONFIG.AWS_REGION });
            
            const key = `fact_checker_bot/groups/${chatId}.json`;
            const deleteCommand = new AWS.DeleteObjectCommand({
              Bucket: CONFIG.S3_BUCKET_NAME,
              Key: key
            });
            
            await s3Client.send(deleteCommand);
            
            // Remove from local cache
            this.chatRooms.delete(chatId);
            
            console.log(chalk.green(`✅ Chat room "${chat.title}" has been permanently deleted.`));
            console.log(chalk.blue('Returning to main menu...'));
            
            setTimeout(() => {
              this.currentView = 'menu';
              this.selectedChat = null;
              this.displayMenu();
              resolve();
            }, 2000);
            
          } catch (error) {
            console.log(chalk.red(`❌ Failed to delete chat room: ${error.message}`));
            console.log(chalk.yellow('Press Enter to continue...'));
            await new Promise(resolve => {
              this.rl.once('line', resolve);
            });
            this.displayChatDetails(chatId);
            resolve();
          }
        } else {
          console.log(chalk.green('❌ Deletion cancelled.'));
          console.log(chalk.yellow('Press Enter to continue...'));
          await new Promise(resolve => {
            this.rl.once('line', resolve);
          });
          this.displayChatDetails(chatId);
          resolve();
        }
      });
    });
  }

  startLiveTailing(chatId = null) {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.green('📡 Live Log Tailing'));
    if (chatId) {
      console.log(chalk.blue(`Filtering for chat ID: ${chatId}`));
    }
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    this.isLiveTailing = true;
    
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
          if (chatId && !line.includes(`chat ID ${chatId}`)) {
            return;
          }
          
          // Enhanced log formatting
          let formatted = line;
          formatted = formatted.replace(/ERROR/g, chalk.red.bold('ERROR'));
          formatted = formatted.replace(/WARN/g, chalk.yellow.bold('WARN'));
          formatted = formatted.replace(/INFO/g, chalk.blue.bold('INFO'));
          formatted = formatted.replace(/chat ID (-?\d+)/g, chalk.green.bold('chat ID $1'));
          formatted = formatted.replace(/message_id: (\d+)/g, chalk.cyan('message_id: $1'));
          
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

  showHelp() {
    console.log(CLEAR_SCREEN);
    console.log(chalk.bold.magenta('📚 Chat Explorer Help\n'));

    console.log(chalk.yellow('Main Menu Commands:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('1-N')} - Select chat by number`);
    console.log(`${chalk.cyan('search <term>')} - Search across all chats`);
    console.log(`${chalk.cyan('stats')} - Show detailed statistics`);
    console.log(`${chalk.cyan('refresh')} - Reload chat data`);
    console.log(`${chalk.cyan('live')} - Start live log monitoring`);
    console.log(`${chalk.cyan('help')} - Show this help`);
    console.log(`${chalk.cyan('quit/exit/q')} - Exit the explorer`);

    console.log(chalk.yellow('\nChat View Commands:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('all')} - Show all messages in chat`);
    console.log(`${chalk.cyan('search <term>')} - Search within current chat`);
    console.log(`${chalk.cyan('users')} - Show user statistics for chat`);
    console.log(`${chalk.cyan('export')} - Export chat to file`);
    console.log(`${chalk.cyan('logs')} - View all AWS logs for this chat`);
    console.log(`${chalk.cyan('delete')} - Delete this chat room (permanent)`);
    console.log(`${chalk.cyan('live')} - Live tail logs for this chat`);
    console.log(`${chalk.cyan('back')} - Return to main menu`);

    console.log(chalk.yellow('\nSearch Results Commands:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('next/n')} - Next page of results`);
    console.log(`${chalk.cyan('prev/p')} - Previous page of results`);
    console.log(`${chalk.cyan('export')} - Export search results`);
    console.log(`${chalk.cyan('back')} - Return to previous view`);

    console.log(chalk.yellow('\nTips:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('• Search is case-insensitive');
    console.log('• Use quotes for exact phrase matching');
    console.log('• Export formats: json, txt');
    console.log('• Live tailing shows real-time bot activity');

    console.log(chalk.gray('\n─'.repeat(50)));
    console.log(chalk.yellow('Press Enter to continue...'));
  }

  async promptUser() {
    if (this.isLiveTailing) return;

    process.stdout.write(chalk.magenta('explorer> '));
    
    this.rl.once('line', async (input) => {
      const command = input.trim();
      const [cmd, ...args] = command.split(' ');
      
      if (['quit', 'exit', 'q'].includes(cmd.toLowerCase())) {
        this.cleanup();
        return;
      }
      
      if (['refresh', 'r'].includes(cmd.toLowerCase())) {
        this.chatRooms.clear();
        await this.loadChatRooms();
        this.currentView = 'menu';
        this.displayMenu();
        this.promptUser();
        return;
      }
      
      if (['help', 'h'].includes(cmd.toLowerCase())) {
        this.showHelp();
        await new Promise(resolve => this.rl.once('line', resolve));
        if (this.currentView === 'menu') this.displayMenu();
        else if (this.currentView === 'chat') this.displayChatDetails(this.selectedChat);
        this.promptUser();
        return;
      }
      
      if (cmd.toLowerCase() === 'search' && args.length > 0) {
        const searchTerm = args.join(' ');
        this.currentPage = 0;
        this.searchMessages(searchTerm, this.currentView === 'chat' ? this.selectedChat : null);
        this.currentView = 'search';
        this.promptUser();
        return;
      }
      
      if (cmd.toLowerCase() === 'stats' && this.currentView === 'menu') {
        this.showStatistics();
        this.currentView = 'stats';
        this.promptUser();
        return;
      }
      
      if (['live', 'l'].includes(cmd.toLowerCase())) {
        this.startLiveTailing(this.currentView === 'chat' ? this.selectedChat : null);
        return;
      }
      
      if (['back', 'b'].includes(cmd.toLowerCase())) {
        if (this.currentView === 'chat') {
          this.currentView = 'menu';
          this.selectedChat = null;
          this.displayMenu();
        } else if (this.currentView === 'search' || this.currentView === 'stats' || this.currentView === 'users') {
          if (this.selectedChat) {
            this.currentView = 'chat';
            this.displayChatDetails(this.selectedChat);
          } else {
            this.currentView = 'menu';
            this.displayMenu();
          }
        }
        this.promptUser();
        return;
      }

      // Handle view-specific commands
      if (this.currentView === 'menu') {
        const chatIndex = parseInt(cmd) - 1;
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
        if (cmd.toLowerCase() === 'all') {
          await this.showAllMessages(this.selectedChat);
          this.promptUser();
          return;
        }
        
        if (cmd.toLowerCase() === 'users') {
          this.showUserStats(this.selectedChat);
          this.currentView = 'users';
          this.promptUser();
          return;
        }
        
        if (cmd.toLowerCase() === 'export') {
          const format = args[0] || 'json';
          await this.exportChat(this.selectedChat, format);
          this.promptUser();
          return;
        }
        
        if (cmd.toLowerCase() === 'logs') {
          await this.viewAllLogs(this.selectedChat);
          this.promptUser();
          return;
        }
        
        if (cmd.toLowerCase() === 'delete') {
          await this.deleteChat(this.selectedChat);
          this.promptUser();
          return;
        }
      }
      
      if (this.currentView === 'search') {
        if (['next', 'n'].includes(cmd.toLowerCase())) {
          if ((this.currentPage + 1) * this.itemsPerPage < this.searchResults.length) {
            this.currentPage++;
            this.displaySearchResults();
          } else {
            console.log(chalk.yellow('Already on last page'));
          }
          this.promptUser();
          return;
        }
        
        if (['prev', 'p'].includes(cmd.toLowerCase())) {
          if (this.currentPage > 0) {
            this.currentPage--;
            this.displaySearchResults();
          } else {
            console.log(chalk.yellow('Already on first page'));
          }
          this.promptUser();
          return;
        }
      }
      
      console.log(chalk.red('Unknown command. Type "help" for available commands.'));
      this.promptUser();
    });
  }

  async showAllMessages(chatId) {
    console.log(CLEAR_SCREEN);
    const chat = this.chatRooms.get(chatId);
    console.log(chalk.bold.blue(`📜 All Messages: ${chat.title}`));
    console.log(chalk.gray('─'.repeat(100)));
    
    chat.allMessages.forEach((msg, index) => {
      console.log(this.formatMessage(msg, index));
    });
    
    console.log(chalk.gray('─'.repeat(100)));
    console.log(chalk.yellow(`Total: ${chat.allMessages.length} messages`));
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
        if (this.currentView === 'menu') this.displayMenu();
        else if (this.currentView === 'chat') this.displayChatDetails(this.selectedChat);
        this.promptUser();
      } else {
        this.cleanup();
      }
    });

    console.log(chalk.blue('Starting Chat Explorer...'));
    await this.loadChatRooms();
    this.displayMenu();
    this.promptUser();
  }
}

// Start the application
const explorer = new ChatExplorer();
explorer.start().catch(error => {
  console.error(chalk.red('Failed to start chat explorer:', error.message));
  process.exit(1);
});