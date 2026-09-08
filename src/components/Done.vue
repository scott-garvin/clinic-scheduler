<script setup lang="ts">
import { type Appointment } from '../store';

defineProps<{ appt: Appointment }>();
defineEmits<{ (e: 'restart'): void }>();
</script>

<template>
  <div class="card panel done">
    <div class="check">✓</div>
    <h1>You're checked in, {{ appt.firstName }}!</h1>
    <p class="lead">
      You're all set for your <strong>{{ appt.timeLabel }}</strong> appointment with
      <strong>{{ appt.provider }}</strong>. Please have a seat — you'll be called shortly.
    </p>
    <button class="kbtn kbtn-ghost" @click="$emit('restart')">Check in another patient</button>
  </div>
</template>

<style scoped>
.done {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-top: 48px;
  padding-bottom: 48px;
}
.check {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--teal-soft);
  color: var(--teal);
  display: grid;
  place-items: center;
  font-size: 38px;
  font-weight: 800;
}
.lead {
  max-width: 44ch;
}
.done .kbtn {
  margin-top: 10px;
}
</style>
