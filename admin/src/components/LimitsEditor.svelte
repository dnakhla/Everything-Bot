<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let roomId;
  export let roomName;
  
  const dispatch = createEventDispatcher();
  
  let limits = {};
  let loading = true;

  // Commonly edited limits
  const editableFields = [
    { key: 'messageLimit', label: 'Message Limit', type: 'number' },
    { key: 'tokenLimit', label: 'Token Limit', type: 'number' },
    { key: 'dailyMessageLimit', label: 'Daily Messages', type: 'number' },
    { key: 'rateLimitPerMinute', label: 'Rate/Minute', type: 'number' },
    { key: 'maxWebSearches', label: 'Max Web Searches', type: 'number' },
    { key: 'maxCostPerMonth', label: 'Max Cost/Month ($)', type: 'number', step: '0.01' },
    { key: 'moderationLevel', label: 'Moderation', type: 'select', options: ['low', 'medium', 'high'] }
  ];

  onMount(async () => {
    await loadLimits();
  });

  async function loadLimits() {
    try {
      loading = true;
      const response = await fetch(`/api/room/${roomId}/limits`);
      limits = await response.json();
    } catch (error) {
      dispatch('notification', { message: 'Failed to load limits', type: 'error' });
    } finally {
      loading = false;
    }
  }

  async function saveLimits() {
    try {
      const response = await fetch(`/api/room/${roomId}/limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits)
      });
      
      const result = await response.json();
      
      if (result.success) {
        dispatch('updated', { roomId, keys: result.updatedKeys || 'limits' });
      } else {
        dispatch('notification', { message: 'Failed to update limits', type: 'error' });
      }
    } catch (error) {
      dispatch('notification', { message: 'Error updating limits', type: 'error' });
    }
  }

  function updateValue(key, value) {
    limits[key] = value;
  }
</script>

<div class="limits-editor">
  <h4>Edit Limits: {roomName}</h4>
  
  {#if loading}
    <div>Loading limits...</div>
  {:else}
    <div class="grid grid-cols-2 gap-4">
      {#each editableFields as field}
        <div class="form-group">
          <label>{field.label}:</label>
          {#if field.type === 'select'}
            <select 
              class="form-control" 
              value={limits[field.key]} 
              on:change={(e) => updateValue(field.key, e.target.value)}
            >
              {#each field.options as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          {:else}
            <input 
              type={field.type}
              class="form-control"
              value={limits[field.key] || ''}
              step={field.step}
              on:input={(e) => updateValue(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
            />
          {/if}
        </div>
      {/each}
    </div>
    
    <div style="margin-top: 16px;">
      <button class="btn btn-success" on:click={saveLimits}>Save All Limits</button>
    </div>
  {/if}
</div>

<style>
  .limits-editor {
    background: white;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  h4 {
    margin-bottom: 16px;
    color: #333;
  }
</style>