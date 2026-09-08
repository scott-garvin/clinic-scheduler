<script setup lang="ts">
import { statusLabel, type Status } from '../store';
defineProps<{ status: Status }>();
</script>

<template>
  <span class="pill" :class="`pill-${status}`">{{ statusLabel(status) }}</span>
</template>
