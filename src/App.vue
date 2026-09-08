<script setup lang="ts">
import { ref, computed } from 'vue';
import { type Appointment, checkIn } from './store';
import Stepper from './components/Stepper.vue';
import Welcome from './components/Welcome.vue';
import Find from './components/Find.vue';
import Confirm from './components/Confirm.vue';
import Review from './components/Review.vue';
import Consent from './components/Consent.vue';
import Done from './components/Done.vue';

type Step = 'welcome' | 'find' | 'confirm' | 'review' | 'consent' | 'done';

const step = ref<Step>('welcome');
const appt = ref<Appointment | null>(null);

const middleSteps: Step[] = ['find', 'confirm', 'review', 'consent'];
const showStepper = computed(() => middleSteps.includes(step.value));
const stepIndex = computed(() => middleSteps.indexOf(step.value) + 1); // 1..4

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
  <div class="kiosk">
    <header class="khead">
      <div class="clinic"><span class="mark">✚</span> Riverside Family Health</div>
      <div class="tag">Self check-in</div>
    </header>

    <Stepper v-if="showStepper" :current="stepIndex" />

    <main class="stage">
      <Welcome v-if="step === 'welcome'" @start="step = 'find'" />
      <Find v-else-if="step === 'find'" @found="found" @cancel="restart" />
      <Confirm v-else-if="step === 'confirm' && appt" :appt="appt" @yes="step = 'review'" @no="step = 'find'" />
      <Review v-else-if="step === 'review' && appt" :appt="appt" @ok="step = 'consent'" @back="step = 'confirm'" />
      <Consent v-else-if="step === 'consent'" @agree="complete" @back="step = 'review'" />
      <Done v-else-if="step === 'done' && appt" :appt="appt" @restart="restart" />
    </main>

    <footer class="kfoot">Demonstration kiosk · sample patients only · no real data is collected</footer>
  </div>
</template>

<style scoped>
.kiosk {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 40px;
}
.khead {
  width: 100%;
  max-width: 620px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26px;
}
.clinic {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.01em;
}
.mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
}
.tag {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  background: #fff;
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 999px;
}
.stage {
  width: 100%;
  max-width: 620px;
  flex: 1;
  display: flex;
  align-items: flex-start;
}
.kfoot {
  margin-top: 28px;
  font-size: 12.5px;
  color: var(--faint);
  text-align: center;
}
</style>
