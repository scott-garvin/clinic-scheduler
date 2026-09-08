<script setup lang="ts">
import { ref, computed } from 'vue';
import { type Appointment, checkIn } from '../store';
import Stepper from './Stepper.vue';
import Welcome from './Welcome.vue';
import Find from './Find.vue';
import Confirm from './Confirm.vue';
import Review from './Review.vue';
import Consent from './Consent.vue';
import Done from './Done.vue';

type Step = 'welcome' | 'find' | 'confirm' | 'review' | 'consent' | 'done';

const step = ref<Step>('welcome');
const appt = ref<Appointment | null>(null);

const middle: Step[] = ['find', 'confirm', 'review', 'consent'];
const showStepper = computed(() => middle.includes(step.value));
const stepIndex = computed(() => middle.indexOf(step.value) + 1);

function found(a: Appointment) {
  appt.value = a;
  step.value = 'confirm';
}
function complete() {
  if (appt.value) checkIn(appt.value.id);
  step.value = 'done';
}
function restart() {
  appt.value = null;
  step.value = 'welcome';
}
</script>

<template>
  <div class="flow">
    <Stepper v-if="showStepper" :current="stepIndex" />
    <div class="stage">
      <Welcome v-if="step === 'welcome'" @start="step = 'find'" />
      <Find v-else-if="step === 'find'" @found="found" @cancel="restart" />
      <Confirm v-else-if="step === 'confirm' && appt" :appt="appt" @yes="step = 'review'" @no="step = 'find'" />
      <Review v-else-if="step === 'review' && appt" :appt="appt" @ok="step = 'consent'" @back="step = 'confirm'" />
      <Consent v-else-if="step === 'consent'" @agree="complete" @back="step = 'review'" />
      <Done v-else-if="step === 'done' && appt" :appt="appt" @restart="restart" />
    </div>
    <p class="hint">This is the patient-facing kiosk. Complete a check-in and switch to <strong>Staff board</strong> — the patient moves to “checked in” there.</p>
  </div>
</template>

<style scoped>
.flow {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stage {
  width: 100%;
}
.hint {
  margin-top: 20px;
  font-size: 12.5px;
  color: var(--faint);
  text-align: center;
  max-width: 46ch;
}
</style>
