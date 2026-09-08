<script setup lang="ts">
import { ref } from 'vue';
import { state, addAppointment } from '../store';

const emit = defineEmits<{ (e: 'close'): void }>();

const types = ['New patient', 'Follow-up', 'Annual physical', 'Consult', 'Lab review', 'Telehealth'];

const patientId = ref(state.patients[0]?.id ?? '');
const providerId = ref(state.providers[0]?.id ?? '');
const time = ref('09:00');
const type = ref('Follow-up');
const durationMin = ref(30);
const error = ref('');

function save() {
  if (!patientId.value || !providerId.value) {
    error.value = 'Select a patient and a provider.';
    return;
  }
  if (!time.value) {
    error.value = 'Pick a time.';
    return;
  }
  addAppointment({
    patientId: patientId.value,
    providerId: providerId.value,
    time: time.value,
    durationMin: Number(durationMin.value),
    type: type.value,
  });
  emit('close');
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="modal card" role="dialog" aria-modal="true" aria-label="New appointment">
      <div class="mhead">
        <h3>New appointment</h3>
        <button class="x" aria-label="Close" @click="emit('close')">✕</button>
      </div>
      <div class="body">
        <div class="field">
          <label>Patient</label>
          <select v-model="patientId">
            <option v-for="p in state.patients" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Provider</label>
          <select v-model="providerId">
            <option v-for="pr in state.providers" :key="pr.id" :value="pr.id">{{ pr.name }} — {{ pr.specialty }}</option>
          </select>
        </div>
        <div class="two">
          <div class="field">
            <label>Time (today)</label>
            <input v-model="time" type="time" />
          </div>
          <div class="field">
            <label>Duration</label>
            <select v-model="durationMin">
              <option :value="15">15 min</option>
              <option :value="20">20 min</option>
              <option :value="30">30 min</option>
              <option :value="45">45 min</option>
              <option :value="60">60 min</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Type</label>
          <select v-model="type">
            <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <p v-if="error" class="err">{{ error }}</p>
      </div>
      <div class="mfoot">
        <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="save">Schedule</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 32, 58, 0.4);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 50;
}
.modal {
  width: 460px;
  max-width: 100%;
  box-shadow: var(--shadow);
}
.mhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
.mhead h3 {
  font-size: 16px;
  font-weight: 800;
}
.x {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 14px;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  cursor: pointer;
}
.x:hover {
  background: var(--grey-soft);
  color: var(--ink);
}
.body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.err {
  color: var(--red);
  font-size: 13px;
  font-weight: 600;
}
.mfoot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 0 0 var(--radius) var(--radius);
}
</style>
