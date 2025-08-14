<script>
  import { onMount } from 'svelte';
  import RoomCard from './components/RoomCard.svelte';
  import ConfigBar from './components/ConfigBar.svelte';
  import StatusNotification from './components/StatusNotification.svelte';
  
  let rooms = [];
  let loading = true;
  let statusMessage = '';
  let statusType = '';
  let showStatus = false;

  function showNotification(message, type = 'info', duration = 4000) {
    statusMessage = message;
    statusType = type;
    showStatus = true;
    setTimeout(() => {
      showStatus = false;
    }, duration);
  }

  async function loadRooms() {
    try {
      console.log('Starting to load rooms...');
      loading = true;
      const response = await fetch('/api/rooms');
      console.log('Response status:', response.status, response.ok);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      rooms = await response.json();
      console.log('Loaded rooms:', rooms.length);
      // Sort by last activity (newest first)
      rooms.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      
      showNotification(`Loaded ${rooms.length} rooms`, 'success', 2000);
    } catch (error) {
      console.error('Error loading rooms:', error);
      showNotification('Failed to load rooms: ' + error.message, 'error');
    } finally {
      loading = false;
    }
  }

  function handleRoomDeleted(event) {
    const roomId = event.detail.roomId;
    rooms = rooms.filter(room => room.id !== roomId);
    showNotification('Room deleted successfully', 'success');
  }

  function handleLimitsUpdated(event) {
    const { roomId, keys } = event.detail;
    showNotification(`Updated limits for room ${roomId}: ${keys}`, 'success', 3000);
  }

  onMount(() => {
    loadRooms();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadRooms, 30000);
    
    // Cleanup on destroy
    return () => clearInterval(interval);
  });
</script>

<main>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h1>🤖 Everything Bot Admin</h1>
      <button class="btn btn-success" on:click={loadRooms}>
        🔄 Refresh
      </button>
    </div>
  </div>

  <ConfigBar on:notification={(e) => showNotification(e.detail.message, e.detail.type)} />

  <div class="card">
    <h2 class="mb-4">Chat Rooms ({rooms.length})</h2>
    
    {#if loading}
      <div style="text-align: center; padding: 40px; color: #666;">
        Loading rooms...
      </div>
    {:else if rooms.length === 0}
      <div style="text-align: center; padding: 40px; color: #666;">
        No rooms found
      </div>
    {:else}
      <div class="grid gap-4">
        {#each rooms as room (room.id)}
          <RoomCard 
            {room} 
            on:deleted={handleRoomDeleted}
            on:limitsUpdated={handleLimitsUpdated}
            on:notification={(e) => showNotification(e.detail.message, e.detail.type)}
          />
        {/each}
      </div>
    {/if}
  </div>
</main>

<StatusNotification 
  message={statusMessage} 
  type={statusType} 
  show={showStatus} 
/>

<style>
  main {
    max-width: 1200px;
    margin: 0 auto;
  }

  h1 {
    font-size: 24px;
    color: #232f3e;
  }

  h2 {
    font-size: 20px;
    color: #333;
  }
</style>