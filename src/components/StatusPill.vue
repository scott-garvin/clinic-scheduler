<script setup lang="ts">
import { statusLabel, type CheckStatus } from '../store';
defineProps<{ status: CheckStatus }>();
</script>

<template>
  <span class="pill" :class="`pill-${status}`">{{ statusLabel(status) }}</span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: capitalize;
  white-space: nowrap;
}
.pill::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.pill-scheduled {
  color: var(--muted);
  background: #eef1f7;
}
.pill-checked-in {
  color: var(--accent-ink);
  background: var(--accent-soft);
}
.pill-roomed {
  color: var(--teal);
  background: var(--teal-soft);
}
.pill-completed {
  color: #3f7a52;
  background: #e7f4eb;
}
.pill-no-show {
  color: var(--red);
  background: var(--red-soft);
}
</style>
