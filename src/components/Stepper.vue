<script setup lang="ts">
defineProps<{ current: number }>(); // 1-based
const labels = ['Find', 'Confirm', 'Details', 'Consent'];
</script>

<template>
  <div class="stepper" role="list">
    <template v-for="(l, i) in labels" :key="l">
      <div
        class="step"
        role="listitem"
        :class="{ done: current > i + 1, active: current === i + 1 }"
      >
        <span class="bubble">{{ current > i + 1 ? '✓' : i + 1 }}</span>
        <span class="lbl">{{ l }}</span>
      </div>
      <span v-if="i < labels.length - 1" class="line" :class="{ done: current > i + 1 }"></span>
    </template>
  </div>
</template>

<style scoped>
.stepper {
  width: 100%;
  max-width: 620px;
  display: flex;
  align-items: center;
  margin-bottom: 22px;
}
.step {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: none;
}
.bubble {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  background: #fff;
  border: 1.5px solid var(--border-strong);
  color: var(--muted);
}
.lbl {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
}
.step.active .bubble {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.step.active .lbl {
  color: var(--ink);
}
.step.done .bubble {
  background: var(--accent-soft);
  border-color: var(--accent-soft);
  color: var(--accent-ink);
}
.line {
  flex: 1;
  height: 2px;
  background: var(--border-strong);
  margin: 0 10px;
}
.line.done {
  background: var(--accent);
}
@media (max-width: 520px) {
  .lbl {
    display: none;
  }
  .line {
    margin: 0 6px;
  }
}
</style>
