<script>
  import { onMount } from 'svelte';
  
  let rooms = [];
  let loading = true;
  let expandedRoom = null;
  let messages = {};
  let limits = {};
  let editingLimits = null;

  async function loadRooms() {
    try {
      console.log('Loading rooms...');
      const response = await fetch('/api/rooms');
      const data = await response.json();
      rooms = data;
      loading = false;
      console.log('Loaded rooms:', rooms.length);
    } catch (error) {
      console.error('Error:', error);
      loading = false;
    }
  }

  async function toggleRoom(roomId) {
    if (expandedRoom === roomId) {
      expandedRoom = null;
    } else {
      expandedRoom = roomId;
      if (!messages[roomId]) {
        await loadMessages(roomId);
      }
    }
  }

  async function loadMessages(roomId) {
    try {
      const response = await fetch(`/api/chat/${roomId}`);
      const data = await response.json();
      messages[roomId] = data.messages || [];
    } catch (error) {
      console.error('Error loading messages:', error);
      messages[roomId] = [];
    }
  }

  async function editLimits(roomId) {
    try {
      console.log('Loading limits for room:', roomId);
      
      // Load current limits
      const response = await fetch(`/api/room/${roomId}/limits`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received limits data:', data);
      
      // Initialize limits object for this room using bot's internal operation names
      limits[roomId] = {
        AUDIO_GENERATION: data.AUDIO_GENERATION || 5,
        SEARCH_QUERIES: data.SEARCH_QUERIES || 30,
        LLM_CALLS: data.LLM_CALLS || 100,
        LLM_TOKENS: data.LLM_TOKENS || 50000,
        // Keep legacy fields for display compatibility
        messageLimit: data.messageLimit || 50,
        tokenLimit: data.tokenLimit || 10000
      };
      
      console.log('Initialized limits for room:', limits[roomId]);
      editingLimits = roomId;
    } catch (error) {
      console.error('Error loading limits:', error);
      alert('Failed to load limits: ' + error.message);
    }
  }

  async function saveLimits(roomId) {
    try {
      console.log('Saving limits for room:', roomId);
      console.log('Limits to save:', limits[roomId]);
      
      const response = await fetch(`/api/room/${roomId}/limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits[roomId])
      });
      
      console.log('Save response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Save result:', result);
      
      if (result.success) {
        alert('Limits updated successfully!');
        editingLimits = null;
      } else {
        alert('Failed to update limits: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving limits:', error);
      alert('Error saving limits: ' + error.message);
    }
  }

  async function unsendMessage(roomId, message) {
    if (!confirm('Unsend this message?')) return;
    
    try {
      console.log('Unsending message:', message);
      
      // Use the exact timestamp format from the message
      let timestamp;
      if (message.timestamp?.unix) {
        timestamp = new Date(message.timestamp.unix).toISOString();
      } else if (message.timestamp) {
        timestamp = message.timestamp;
      } else {
        timestamp = new Date().toISOString();
      }
      
      console.log('Using timestamp:', timestamp);
      console.log('Original timestamp object:', message.timestamp);
      
      const response = await fetch(`/api/chat/${roomId}/unsend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp })
      });
      
      const result = await response.json();
      console.log('Unsend result:', result);
      
      if (result.success) {
        // Remove from local array only after successful API call
        messages[roomId] = messages[roomId].filter(m => m !== message);
        alert(`Message unsent successfully! ${result.removedCount || 1} message(s) removed from S3.`);
      } else {
        alert('Failed to unsend: ' + result.message);
        // Don't remove from local array if API call failed
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error unsending message');
    }
  }

  onMount(() => {
    loadRooms();
  });
</script>

<div style="padding: 20px; max-width: 1000px; margin: 0 auto;">
  <h1>Bot Admin</h1>
  
  {#if loading}
    <p>Loading...</p>
  {:else}
    <p>{rooms.length} rooms found</p>
    
    {#each rooms as room}
      <div style="border: 1px solid #ccc; margin: 10px 0; background: white;">
        <!-- Room Header -->
        <div style="padding: 15px; border-bottom: 1px solid #eee; cursor: pointer;" on:click={() => toggleRoom(room.id)}>
          <strong>{room.name}</strong>
          <span style="color: #666; margin-left: 10px;">({room.messages} messages)</span>
          <span style="float: right;">{expandedRoom === room.id ? '−' : '+'}</span>
        </div>
        
        <!-- Expanded Content -->
        {#if expandedRoom === room.id}
          <div style="padding: 15px; background: #f9f9f9;">
            
            <!-- Messages -->
            <h4>Messages:</h4>
            {#if messages[room.id]}
              <div style="max-height: 300px; overflow-y: auto; margin: 10px 0;">
                {#each messages[room.id].slice(-20).reverse() as msg}
                  <div style="margin: 8px 0; padding: 8px; background: {msg.isBot ? '#e8f5e8' : '#e3f2fd'}; border-radius: 4px;">
                    <div style="font-size: 12px; color: #666;">
                      <strong>{msg.message_from || 'Unknown'}</strong>
                      {#if msg.isBot}
                        <a href="#" on:click|preventDefault={() => unsendMessage(room.id, msg)} style="color: red; margin-left: 10px;">unsend</a>
                      {/if}
                    </div>
                    <div style="margin-top: 4px;">{msg.message_text || msg.text || 'No text'}</div>
                  </div>
                {/each}
              </div>
            {:else}
              <p>Loading messages...</p>
            {/if}
            
            <!-- Usage Limits -->
            <h4>Usage Limits:</h4>
            {#if editingLimits === room.id}
              <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                  <div>
                    <label>Audio Generation (Daily):</label>
                    <input type="number" bind:value={limits[room.id].AUDIO_GENERATION} style="width: 100%; padding: 4px;" />
                  </div>
                  <div>
                    <label>Search Queries (Daily):</label>
                    <input type="number" bind:value={limits[room.id].SEARCH_QUERIES} style="width: 100%; padding: 4px;" />
                  </div>
                  <div>
                    <label>LLM Calls (Daily):</label>
                    <input type="number" bind:value={limits[room.id].LLM_CALLS} style="width: 100%; padding: 4px;" />
                  </div>
                  <div>
                    <label>LLM Tokens (Daily):</label>
                    <input type="number" bind:value={limits[room.id].LLM_TOKENS} style="width: 100%; padding: 4px;" />
                  </div>
                  <div>
                    <label>Message Limit (Legacy):</label>
                    <input type="number" bind:value={limits[room.id].messageLimit} style="width: 100%; padding: 4px;" />
                  </div>
                  <div>
                    <label>Token Limit (Legacy):</label>
                    <input type="number" bind:value={limits[room.id].tokenLimit} style="width: 100%; padding: 4px;" />
                  </div>
                </div>
                <button on:click={() => saveLimits(room.id)} style="background: #28a745; color: white; padding: 5px 10px; border: none; border-radius: 3px; margin-right: 5px;">Save</button>
                <button on:click={() => editingLimits = null} style="background: #6c757d; color: white; padding: 5px 10px; border: none; border-radius: 3px;">Cancel</button>
              </div>
            {:else}
              <div>
                <p><strong>Bot Limits:</strong> Audio: {limits[room.id]?.AUDIO_GENERATION || 5} | Search: {limits[room.id]?.SEARCH_QUERIES || 30}</p>
                <p><strong>LLM Limits:</strong> Calls: {limits[room.id]?.LLM_CALLS || 100} | Tokens: {limits[room.id]?.LLM_TOKENS || 50000}</p>
                <p><strong>Legacy:</strong> Messages: {limits[room.id]?.messageLimit || 50} | Tokens: {limits[room.id]?.tokenLimit || 10000}</p>
                <button on:click={() => editLimits(room.id)} style="background: #007bff; color: white; padding: 5px 10px; border: none; border-radius: 3px;">Edit Limits</button>
              </div>
            {/if}
            
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>