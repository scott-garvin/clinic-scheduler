<script setup lang="ts">
import { resetDemo } from '../store';
defineProps<{ title: string }>();
const emit = defineEmits<{ (e: 'new'): void }>();
</script>

<template>
  <header class="top">
    <h1>{{ title }}</h1>
    <div class="actions">
      <button class="btn btn-ghost btn-sm" @click="resetDemo">Reset demo</button>
      <button class="btn btn-primary btn-sm" @click="emit('new')">+ New appointment</button>
    </div>
  </header>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
h1 {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.actions {
  display: flex;
  gap: 10px;
}
</style>
