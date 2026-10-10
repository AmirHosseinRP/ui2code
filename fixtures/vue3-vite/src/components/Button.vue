<template>
  <button :class="['btn', variant]">
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  variant?: "primary" | "secondary" | "outline";
}>();
</script>

<style lang="scss" scoped>
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
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
}
</style>