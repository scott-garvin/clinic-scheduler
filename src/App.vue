<script setup lang="ts">
import { ref } from 'vue';
import StaffBoard from './components/StaffBoard.vue';
import KioskFlow from './components/KioskFlow.vue';

const mode = ref<'staff' | 'kiosk'>('staff');
</script>

<template>
  <div class="app">
    <header class="appbar">
      <div class="brand"><span class="mark">✚</span> Riverside Family Health</div>
      <div class="seg" role="tablist">
        <button role="tab" :class="{ on: mode === 'staff' }" @click="mode = 'staff'">Staff board</button>
        <button role="tab" :class="{ on: mode === 'kiosk' }" @click="mode = 'kiosk'">Patient kiosk</button>
      </div>
    </header>

    <main class="content" :class="mode">
      <StaffBoard v-if="mode === 'staff'" />
      <KioskFlow v-else />
    </main>

    <footer class="foot">Demonstration · sample data only · no real patient data</footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.appbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.01em;
}
.mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
}
.seg {
  display: flex;
  background: var(--accent-soft);
  border-radius: 11px;
  padding: 3px;
}
.seg button {
  border: none;
  background: none;
  font: inherit;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--accent-ink);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}
.seg button.on {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(20, 32, 60, 0.12);
}
.content {
  flex: 1;
  min-width: 0;
  padding: 24px;
  overflow-x: hidden;
}
.content.kiosk {
  padding: 26px 20px 40px;
}
.foot {
  text-align: center;
  font-size: 12px;
  color: var(--faint);
  padding: 16px;
}
@media (max-width: 560px) {
  .appbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .content {
    padding: 18px;
  }
}
</style>
