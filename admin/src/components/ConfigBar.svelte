<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let currentModel = 'Loading...';
  let selectedModel = 'gpt-4o';
  
  const modelOptions = [
    'gpt-4o',
    'gpt-4.1-mini', 
    'gpt-4.1',
    'gpt-4'
  ];

  onMount(async () => {
    await loadConfig();
  });

  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      currentModel = config.model;
      selectedModel = config.model;
    } catch (error) {
      currentModel = 'Error loading config';
      dispatch('notification', { message: 'Failed to load config', type: 'error' });
    }
  }

  async function updateModel() {
    try {
      const response = await fetch('/api/config/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel })
      });
      
      const result = await response.json();
      
      if (result.success) {
        currentModel = selectedModel;
        dispatch('notification', { message: `Model updated to ${selectedModel}`, type: 'success' });
      } else {
        dispatch('notification', { message: 'Failed to update model', type: 'error' });
      }
    } catch (error) {
      dispatch('notification', { message: 'Error updating model', type: 'error' });
    }
  }
</script>

<div class="card">
  <div class="flex items-center gap-4">
    <div class="config-item">
      <span>Model:</span>
      <select bind:value={selectedModel} class="form-control" style="width: 150px; margin: 0 8px;">
        {#each modelOptions as model}
          <option value={model}>{model}</option>
        {/each}
      </select>
      <button class="btn btn-primary btn-small" on:click={updateModel}>Update</button>
    </div>
    
    <div class="config-item">
      <span>Current: {currentModel}</span>
    </div>
  </div>
</div>

<style>
  .config-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
</style>