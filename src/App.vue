<script setup lang="ts">
import { ref, computed } from 'vue';
import Sidebar from './components/Sidebar.vue';
import TopBar from './components/TopBar.vue';
import Schedule from './components/Schedule.vue';
import Patients from './components/Patients.vue';
import AppointmentModal from './components/AppointmentModal.vue';

const tab = ref('schedule');
const showModal = ref(false);
const title = computed(() => (tab.value === 'schedule' ? 'Schedule' : 'Patients'));
</script>

<template>
  <div class="shell">
    <Sidebar :active="tab" @nav="tab = $event" />
    <main>
      <TopBar :title="title" @new="showModal = true" />
      <div class="content">
        <Schedule v-if="tab === 'schedule'" />
        <Patients v-else />
      </div>
    </main>
    <AppointmentModal v-if="showModal" @close="showModal = false" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
  min-height: 100vh;
}
main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.content {
  padding: 28px;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  flex: 1;
}
@media (max-width: 720px) {
  .content {
    padding: 18px;
  }
}
</style>
