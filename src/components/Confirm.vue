<script setup lang="ts">
import { formatDob, type Appointment } from '../store';

defineProps<{ appt: Appointment }>();
defineEmits<{ (e: 'yes'): void; (e: 'no'): void }>();
</script>

<template>
  <div class="card panel">
    <h2>Is this you?</h2>
    <p class="lead">Please confirm this is your appointment.</p>

    <div class="appt">
      <div class="name">{{ appt.firstName }} {{ appt.lastName }}</div>
      <div class="dob">Date of birth · {{ formatDob(appt.dob) }}</div>
      <div class="rows">
        <div class="r"><span class="k">Time</span><span class="v">{{ appt.timeLabel }}, today</span></div>
        <div class="r"><span class="k">Provider</span><span class="v">{{ appt.provider }}</span></div>
        <div class="r"><span class="k">Visit</span><span class="v">{{ appt.type }}</span></div>
      </div>
    </div>

    <div class="actions">
      <button class="kbtn kbtn-ghost" @click="$emit('no')">No, that's not me</button>
      <button class="kbtn kbtn-primary" @click="$emit('yes')">Yes, that's me →</button>
    </div>
  </div>
</template>

<style scoped>
.appt {
  margin-top: 20px;
  background: var(--accent-soft);
  border: 1px solid #d4e4ff;
  border-radius: 14px;
  padding: 22px 24px;
}
.name {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.dob {
  font-size: 14px;
  color: var(--ink-2);
  margin-top: 2px;
}
.rows {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.r {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 15.5px;
  padding-bottom: 10px;
  border-bottom: 1px solid #d9e6fb;
}
.r:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.k {
  color: var(--muted);
  font-weight: 600;
}
.v {
  font-weight: 700;
  text-align: right;
}
</style>
