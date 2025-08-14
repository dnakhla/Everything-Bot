<script>
  export let message = '';
  export let type = 'info';
  export let show = false;
</script>

{#if show}
  <div class="notification notification-{type}">
    {message}
  </div>
{/if}

<style>
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    max-width: 400px;
  }

  .notification-success {
    background: #28a745;
  }

  .notification-error {
    background: #dc3545;
  }

  .notification-info {
    background: #17a2b8;
  }
</style>