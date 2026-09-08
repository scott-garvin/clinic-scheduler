<script setup lang="ts">
import { ref } from 'vue';
import { appointments, findAppointment, type Appointment } from '../store';

const emit = defineEmits<{ (e: 'found', a: Appointment): void; (e: 'cancel'): void }>();

const lastName = ref('');
const dob = ref('');
const error = ref('');
const samples = appointments.filter((a) => a.status === 'scheduled').slice(0, 3);

function submit() {
  const a = findAppointment(lastName.value, dob.value);
  if (!a) {
    error.value = "We couldn't find an appointment with that name and date of birth. Please check with the front desk.";
    return;
  }
  if (a.status !== 'scheduled') {
    error.value = `${a.firstName} is already checked in.`;
    return;
  }
  emit('found', a);
}
function useSample(a: Appointment) {
  lastName.value = a.lastName;
  dob.value = a.dob;
  error.value = '';
}
</script>

<template>
  <div class="card panel">
    <h2>Find your appointment</h2>
    <p class="lead">Enter your last name and date of birth.</p>

    <div class="form">
      <div class="kfield">
        <label>Last name</label>
        <input v-model="lastName" placeholder="e.g. Avery" autocomplete="off" @keyup.enter="submit" />
      </div>
      <div class="kfield">
        <label>Date of birth</label>
        <input v-model="dob" type="date" @keyup.enter="submit" />
      </div>
    </div>

    <p v-if="error" class="kerr">{{ error }}</p>

    <div class="actions">
      <button class="kbtn kbtn-ghost" @click="emit('cancel')">Cancel</button>
      <button class="kbtn kbtn-primary" @click="submit">Find my appointment →</button>
    </div>

    <div class="demo">
      <span class="dlabel">Demo — tap a sample patient to fill this in:</span>
      <div class="chips">
        <button v-for="s in samples" :key="s.id" class="chip" @click="useSample(s)">{{ s.lastName }} · {{ s.dob }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 22px;
}
.demo {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-strong);
}
.dlabel {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
@media (max-width: 520px) {
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
