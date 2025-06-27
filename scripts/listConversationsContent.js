// scripts/listConversationsContent.js
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config'; // Load environment variables from .env file

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' }); // Use region from env or default
const bucketName = process.env.S3_BUCKET_NAME;
const prefix = 'fact_checker_bot/groups/';

if (!bucketName) {
  console.error('Error: S3_BUCKET_NAME environment variable is not set.');
  console.error('Please set it in your .env file or environment.');
  process.exit(1);
}

async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function listAndShowConversations() {
  try {
    console.log(`Fetching conversations from bucket: ${bucketName}, prefix: ${prefix}\n`);

    const listParams = {
      Bucket: bucketName,
      Prefix: prefix,
    };

    const listResponse = await s3Client.send(new ListObjectsV2Command(listParams));

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('No conversation files found.');
      return;
    }

    // Sort files by last modified date, newest first
    const sortedFiles = listResponse.Contents.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

    for (const item of sortedFiles) {
      if (!item.Key.endsWith('.json')) continue; // Skip non-JSON files
      let structureLogged = false; // Flag to log structure only once per file

      console.log(`--- Conversation: ${item.Key} ---`);

      const getParams = {
        Bucket: bucketName,
        Key: item.Key,
      };

      try {
        const getResponse = await s3Client.send(new GetObjectCommand(getParams));
        const bodyString = await streamToString(getResponse.Body);
        const conversationData = JSON.parse(bodyString);

        // Assuming the structure is { messages: [...] }
        if (conversationData && Array.isArray(conversationData.messages)) {
          const messages = conversationData.messages;
          const last10Messages = messages.slice(-10); // Get the last 10 messages

          if (last10Messages.length > 0) {
            // Log the structure of the first message once per file for debugging
            // Removed the debug logging block

            console.log(`  Last ${last10Messages.length} messages:`);
            last10Messages.forEach((msg, index) => {
              // Basic formatting, adjust as needed based on actual message structure
              const timestamp = msg.timestamp?.friendly || 'No timestamp'; // Use friendly timestamp if available
              const sender = msg.message_from || 'Unknown Sender'; // Use message_from for sender
              const text = msg.message_text ? msg.message_text.replace(/\n/g, '\n    ') : '[No text content]'; // Use message_text and indent multi-line messages
              console.log(`    ${index + 1}. [${timestamp}] ${sender}: ${text}`);
            });
          } else {
            console.log('  No messages found in this conversation file.');
          }
        } else {
          console.log("  Could not find a 'messages' array in the JSON data or data is not in expected format.");
        }

      } catch (getErr) {
        console.error(`  Error fetching or parsing ${item.Key}:`, getErr.message);
      }
      console.log(`--- End Conversation: ${item.Key} ---\n`);
    }

  } catch (err) {
    console.error('Error listing conversations:', err);
    if (err.name === 'CredentialsProviderError') {
      console.error('Hint: Ensure your AWS credentials are configured correctly (e.g., via environment variables, ~/.aws/credentials, or IAM role).');
    }
    if (err.name === 'NoSuchBucket') {
      console.error(`Hint: Ensure the bucket '${bucketName}' exists and you have permissions to access it.`);
    }
  }
}

listAndShowConversations();