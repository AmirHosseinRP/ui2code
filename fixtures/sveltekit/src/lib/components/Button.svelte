<script lang="ts">
  export let variant: "primary" | "secondary" | "outline" = "primary";
</script>

<button class="btn {variant}" on:click>
  <slot />
</button>

<style>
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
  }
  .primary {
    background: #3b82f6;
    color: white;
  }
  .secondary {
    background: #6b7280;
    color: white;
  }
  .outline {
    border: 1px solid #d1d5db;
    background: transparent;
  }
</style>