<script>
  export let chatData;
  export let roomId;

  function formatMessageTime(timestamp) {
    if (timestamp && timestamp.unix) {
      return new Date(timestamp.unix).toLocaleString();
    } else if (timestamp) {
      return new Date(timestamp).toLocaleString();
    }
    return 'Unknown time';
  }

  async function unsendMessage(timestamp) {
    if (!confirm('Unsend this bot message?')) return;
    
    try {
      const response = await fetch(`/api/chat/${roomId}/unsend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: timestamp })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Message unsent successfully!');
        window.location.reload();
      } else {
        alert('Failed to unsend message: ' + result.message);
      }
    } catch (error) {
      alert('Error unsending message');
    }
  }
</script>

<div class="chat-viewer">
  <div class="header">
    <h2>{chatData.chatTitle || 'Chat ' + roomId}</h2>
    <p>Room ID: {roomId} • Messages: {chatData.messages?.length || 0}</p>
  </div>
  
  <div class="messages">
    {#if chatData.messages && chatData.messages.length > 0}
      {#each chatData.messages.slice(-50).reverse() as msg}
        <div class="message {msg.isBot ? 'bot-msg' : 'user-msg'}">
          {#if msg.isBot}
            <button 
              class="unsend-btn" 
              on:click={() => unsendMessage(msg.timestamp?.unix ? new Date(msg.timestamp.unix).toISOString() : (msg.timestamp || new Date().toISOString()))}
            >
              ✕ Unsend
            </button>
          {/if}
          
          <div class="message-content">
            <div class="sender">
              {msg.message_from || msg.from || 'Unknown'}{msg.isBot ? ' (Bot)' : ''}
            </div>
            <div class="text">
              {msg.message_text || msg.text || 'No text'}
            </div>
            <div class="time">
              {formatMessageTime(msg.timestamp)}
            </div>
          </div>
        </div>
      {/each}
    {:else}
      <p>No messages found</p>
    {/if}
  </div>
</div>

<style>
  .chat-viewer {
    font-family: Arial, sans-serif;
    margin: 20px;
  }

  .header {
    margin-bottom: 20px;
  }

  .header h2 {
    margin: 0 0 8px 0;
    color: #333;
  }

  .header p {
    margin: 0;
    color: #666;
    font-size: 14px;
  }

  .messages {
    max-height: 500px;
    overflow-y: auto;
  }

  .message {
    margin: 10px 0;
    padding: 12px;
    border-radius: 8px;
    position: relative;
  }

  .bot-msg {
    border-left: 4px solid #4caf50;
    background: #e8f5e8;
  }

  .user-msg {
    border-left: 4px solid #2196f3;
    background: #e3f2fd;
  }

  .unsend-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #dc3545;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    z-index: 10;
  }

  .unsend-btn:hover {
    background: #c82333;
  }

  .message-content {
    margin-right: 80px;
  }

  .sender {
    font-weight: bold;
    margin-bottom: 4px;
    color: #333;
  }

  .text {
    margin-bottom: 8px;
    line-height: 1.4;
  }

  .time {
    font-size: 11px;
    color: #666;
  }
</style>