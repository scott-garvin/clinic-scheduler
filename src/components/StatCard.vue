<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'accent' | 'red' | 'teal';
}>();
</script>

<template>
  <div class="card stat">
    <div class="label">{{ label }}</div>
    <div class="value tnum" :class="tone">{{ value }}</div>
    <div v-if="sub" class="sub">{{ sub }}</div>
  </div>
</template>

<style scoped>
.stat {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.value {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.value.accent {
  color: var(--accent-ink);
}
.value.red {
  color: var(--red);
}
.value.teal {
  color: var(--teal);
}
.sub {
  font-size: 12.5px;
  color: var(--faint);
}
</style>
