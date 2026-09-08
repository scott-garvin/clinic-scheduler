<script setup lang="ts">
import { reactive, ref } from 'vue';
import Modal from './Modal.vue';
import { addAppointment, providerNames, insurerNames, type Appointment } from '../store';
import { toast } from '../useToast';

const emit = defineEmits<{ (e: 'close'): void; (e: 'created', appt: Appointment): void }>();

const form = reactive({
  firstName: '',
  lastName: '',
  dob: '',
  gender: 'Female',
  provider: providerNames[0],
  type: '',
  insurer: insurerNames[0],
  time: '',
  copay: '',
});
const errors = reactive<Record<string, string>>({});

function labelFromTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ap}`;
}

function validate(): boolean {
  for (const k of Object.keys(errors)) delete errors[k];
  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!form.dob) errors.dob = 'Date of birth is required.';
  else if (new Date(`${form.dob}T00:00:00`) > new Date()) errors.dob = 'Date of birth cannot be in the future.';
  if (!form.type.trim()) errors.type = 'Visit type is required.';
  if (!form.time) errors.time = 'Appointment time is required.';
  const copayNum = Number(form.copay);
  if (form.copay !== '' && (Number.isNaN(copayNum) || copayNum < 0)) errors.copay = 'Enter a valid copay amount.';
  return Object.keys(errors).length === 0;
}

const submitted = ref(false);
function submit() {
  submitted.value = true;
  if (!validate()) return;
  const [h, m] = form.time.split(':').map(Number);
  const appt = addAppointment({
    firstName: form.firstName,
    lastName: form.lastName,
    dob: form.dob,
    gender: form.gender,
    timeLabel: labelFromTime(form.time),
    apptMinutes: h * 60 + m,
    provider: form.provider,
    type: form.type.trim(),
    insurer: form.insurer,
    copayCents: form.copay === '' ? 0 : Math.round(Number(form.copay) * 100),
  });
  toast(`Appointment booked for ${appt.firstName} ${appt.lastName}`, 'success');
  emit('created', appt);
  emit('close');
}
</script>

<template>
  <Modal
    title="New appointment"
    subtitle="Add a patient to today's schedule"
    variant="center"
    @close="emit('close')"
  >
    <form class="form" @submit.prevent="submit">
      <div class="row2">
        <label class="fld">
          <span>First name</span>
          <input v-model="form.firstName" :class="{ bad: submitted && errors.firstName }" />
          <em v-if="submitted && errors.firstName">{{ errors.firstName }}</em>
        </label>
        <label class="fld">
          <span>Last name</span>
          <input v-model="form.lastName" :class="{ bad: submitted && errors.lastName }" />
          <em v-if="submitted && errors.lastName">{{ errors.lastName }}</em>
        </label>
      </div>

      <div class="row2">
        <label class="fld">
          <span>Date of birth</span>
          <input v-model="form.dob" type="date" :class="{ bad: submitted && errors.dob }" />
          <em v-if="submitted && errors.dob">{{ errors.dob }}</em>
        </label>
        <label class="fld">
          <span>Gender</span>
          <select v-model="form.gender">
            <option>Female</option>
            <option>Male</option>
            <option>Nonbinary</option>
            <option>Prefer not to say</option>
          </select>
        </label>
      </div>

      <div class="row2">
        <label class="fld">
          <span>Provider</span>
          <select v-model="form.provider">
            <option v-for="p in providerNames" :key="p">{{ p }}</option>
          </select>
        </label>
        <label class="fld">
          <span>Appointment time</span>
          <input v-model="form.time" type="time" :class="{ bad: submitted && errors.time }" />
          <em v-if="submitted && errors.time">{{ errors.time }}</em>
        </label>
      </div>

      <div class="row2">
        <label class="fld">
          <span>Visit type</span>
          <input v-model="form.type" placeholder="e.g. Follow-up" :class="{ bad: submitted && errors.type }" />
          <em v-if="submitted && errors.type">{{ errors.type }}</em>
        </label>
        <label class="fld">
          <span>Copay (USD)</span>
          <input v-model="form.copay" inputmode="decimal" placeholder="0.00" :class="{ bad: submitted && errors.copay }" />
          <em v-if="submitted && errors.copay">{{ errors.copay }}</em>
        </label>
      </div>

      <label class="fld">
        <span>Insurance</span>
        <select v-model="form.insurer">
          <option v-for="i in insurerNames" :key="i">{{ i }}</option>
        </select>
      </label>
    </form>

    <template #footer>
      <button class="fbtn ghost" @click="emit('close')">Cancel</button>
      <button class="fbtn primary" @click="submit">Book appointment</button>
    </template>
  </Modal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fld > span {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink-2);
}
.fld input,
.fld select {
  font: inherit;
  font-size: 14.5px;
  padding: 9px 11px;
  border: 1.5px solid var(--border-strong);
  border-radius: 9px;
  background: #fff;
  color: var(--ink);
}
.fld input:focus,
.fld select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.fld input.bad {
  border-color: var(--red);
}
.fld em {
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
  color: var(--red);
}
.fbtn {
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1.5px solid transparent;
}
.fbtn.ghost {
  background: #fff;
  border-color: var(--border-strong);
  color: var(--ink-2);
}
.fbtn.ghost:hover {
  border-color: var(--muted);
}
.fbtn.primary {
  background: var(--accent);
  color: #fff;
}
.fbtn.primary:hover {
  background: var(--accent-ink);
}
@media (max-width: 480px) {
  .row2 {
    grid-template-columns: 1fr;
  }
}
</style>
