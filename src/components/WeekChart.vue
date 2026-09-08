<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: Array<{ label: string; count: number }> }>();
const max = computed(() => Math.max(1, ...props.data.map((d) => d.count)));
</script>

<template>
  <div class="chart">
    <div v-for="d in data" :key="d.label" class="col">
      <div class="bar-wrap">
        <div class="count tnum">{{ d.count }}</div>
        <div class="bar" :style="{ height: `${(d.count / max) * 100}%` }" :title="`${d.count} appointments`"></div>
      </div>
      <div class="mlabel">{{ d.label }}</div>
    </div>
  </div>
</template>

<style scoped>
.chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 100%;
  min-height: 180px;
  padding-top: 8px;
}
.col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 100%;
}
.bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
}
.count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
}
.bar {
  width: 64%;
  max-width: 38px;
  background: linear-gradient(180deg, var(--accent) 0%, #6aa0f7 100%);
  border-radius: 6px 6px 0 0;
  min-height: 4px;
  transition: height 0.55s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.mlabel {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
</style>
