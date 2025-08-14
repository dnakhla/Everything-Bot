<script>
  import { createEventDispatcher } from 'svelte';
  import LimitsEditor from './LimitsEditor.svelte';
  
  export let room;
  
  const dispatch = createEventDispatcher();
  
  let expanded = false;
  let showLimitsEditor = false;
  let showMessages = false;
  let messages = [];
  let loadingMessages = false;

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    
    return date.toLocaleDateString();
  }

  async function toggleExpanded() {
    expanded = !expanded;
    if (expanded && !messages.length) {
      await loadMessages();
    }
  }

  async function loadMessages() {
    try {
      loadingMessages = true;
      const response = await fetch(`/api/chat/${room.id}`);
      const chatData = await response.json();
      
      if (chatData.messages) {
        messages = chatData.messages.slice(-50).reverse(); // Last 50, newest first
      }
      
      showMessages = true;
      dispatch('notification', { message: 'Messages loaded', type: 'success' });
    } catch (error) {
      console.error('Error loading messages:', error);
      dispatch('notification', { message: 'Failed to load messages', type: 'error' });
    } finally {
      loadingMessages = false;
    }
  }

  async function unsendMessage(message) {
    if (!confirm('Unsend this bot message?')) return;
    
    try {
      const timestamp = message.timestamp?.unix ? new Date(message.timestamp.unix).toISOString() : (message.timestamp || new Date().toISOString());
      
      const response = await fetch(`/api/chat/${room.id}/unsend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove the message from the local array
        messages = messages.filter(msg => msg !== message);
        dispatch('notification', { message: 'Message unsent successfully', type: 'success' });
      } else {
        dispatch('notification', { message: 'Failed to unsend message', type: 'error' });
      }
    } catch (error) {
      dispatch('notification', { message: 'Error unsending message', type: 'error' });
    }
  }

  function formatMessageTime(timestamp) {
    if (timestamp && timestamp.unix) {
      return new Date(timestamp.unix).toLocaleString();
    } else if (timestamp) {
      return new Date(timestamp).toLocaleString();
    }
    return 'Unknown time';
  }

  async function deleteRoom() {
    if (confirm(`Delete chat "${room.name}"?\n\nThis cannot be undone.`)) {
      try {
        const response = await fetch(`/api/chat/${room.id}`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
          dispatch('deleted', { roomId: room.id });
        } else {
          dispatch('notification', { message: 'Failed to delete chat', type: 'error' });
        }
      } catch (error) {
        dispatch('notification', { message: 'Error deleting chat', type: 'error' });
      }
    }
  }

  function handleLimitsUpdated(event) {
    showLimitsEditor = false;
    dispatch('limitsUpdated', event.detail);
  }
</script>

<div class="room-container">
  <div class="room-card">
    <div class="room-info">
      <div class="room-name" on:click={toggleExpanded}>{room.name}</div>
      <div class="room-id">ID: {room.id} • {room.type}</div>
      <div class="last-message">{room.lastMessage?.substring(0, 60) || 'No recent messages'}...</div>
    </div>
    
    <div class="room-stats">
      <div>{room.messages} messages</div>
      <div class="text-sm text-gray">{formatTime(room.lastActivity)}</div>
    </div>
    
    <div class="room-actions">
      <button class="btn btn-small btn-primary" on:click={toggleExpanded}>
        {expanded ? '▼ Collapse' : '▶ Expand'}
      </button>
      <button class="btn btn-small btn-danger" on:click={deleteRoom}>Delete</button>
    </div>
  </div>

  {#if expanded}
    <div class="expanded-content">
      <div class="tabs">
        <button 
          class="tab {showMessages ? 'active' : ''}" 
          on:click={() => { showMessages = true; showLimitsEditor = false; }}
        >
          💬 Messages ({room.messages})
        </button>
        <button 
          class="tab {showLimitsEditor ? 'active' : ''}" 
          on:click={() => { showLimitsEditor = true; showMessages = false; }}
        >
          ⚙️ Usage Limits
        </button>
      </div>
      
      {#if showMessages}
        <div class="messages-section">
          {#if loadingMessages}
            <div class="loading">Loading messages...</div>
          {:else if messages.length > 0}
            <div class="messages-list">
              {#each messages as message}
                <div class="message {message.isBot ? 'bot-msg' : 'user-msg'}">
                  <div class="message-header">
                    <span class="sender">{message.message_from || message.from || 'Unknown'}{message.isBot ? ' (Bot)' : ''}</span>
                    <span class="time">{formatMessageTime(message.timestamp)}</span>
                    {#if message.isBot}
                      <button class="unsend-link" on:click={() => unsendMessage(message)}>🗑️ Unsend</button>
                    {/if}
                  </div>
                  <div class="message-text">{message.message_text || message.text || 'No text'}</div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="no-messages">No messages found</div>
          {/if}
        </div>
      {/if}
      
      {#if showLimitsEditor}
        <div class="limits-section">
          <LimitsEditor 
            roomId={room.id} 
            roomName={room.name}
            on:updated={handleLimitsUpdated}
            on:notification={(e) => dispatch('notification', e.detail)}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .room-container {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .room-card {
    padding: 16px;
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 16px;
    align-items: center;
  }

  .room-card:hover {
    background: #f8f9fa;
  }

  .room-name {
    font-weight: 500;
    color: #232f3e;
    cursor: pointer;
    margin-bottom: 4px;
  }

  .room-name:hover {
    color: #007bff;
    text-decoration: underline;
  }

  .room-id {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }

  .last-message {
    font-size: 12px;
    color: #888;
  }

  .room-stats {
    font-size: 14px;
  }

  .room-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .expanded-content {
    border-top: 1px solid #e9ecef;
    background: #f8f9fa;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #ddd;
  }

  .tab {
    padding: 12px 20px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    border-bottom: 2px solid transparent;
  }

  .tab:hover {
    background: #e9ecef;
  }

  .tab.active {
    border-bottom-color: #007bff;
    color: #007bff;
    font-weight: 500;
  }

  .messages-section, .limits-section {
    padding: 20px;
  }

  .loading, .no-messages {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .messages-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .message {
    margin: 12px 0;
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #ddd;
  }

  .bot-msg {
    border-left-color: #4caf50;
    background: #e8f5e8;
  }

  .user-msg {
    border-left-color: #2196f3;
    background: #e3f2fd;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .sender {
    font-weight: bold;
    color: #333;
  }

  .time {
    font-size: 11px;
    color: #666;
  }

  .unsend-link {
    background: #dc3545;
    color: white;
    border: none;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    cursor: pointer;
    text-decoration: none;
  }

  .unsend-link:hover {
    background: #c82333;
  }

  .message-text {
    line-height: 1.4;
    white-space: pre-wrap;
  }
</style>