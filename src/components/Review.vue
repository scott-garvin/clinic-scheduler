<script setup lang="ts">
import { ref } from 'vue';
import { type Appointment } from '../store';

defineProps<{ appt: Appointment }>();
defineEmits<{ (e: 'ok'): void; (e: 'back'): void }>();

const flagged = ref(false);
</script>

<template>
  <div class="card panel">
    <h2>Confirm your information</h2>
    <p class="lead">Make sure everything below is current.</p>

    <div class="blocks">
      <div class="block">
        <div class="title">Contact</div>
        <div class="row"><span class="k">Phone</span><span class="v">{{ appt.phone }}</span></div>
        <div class="row"><span class="k">Address</span><span class="v">{{ appt.address }}</span></div>
      </div>
      <div class="block">
        <div class="title">Insurance</div>
        <div class="row"><span class="k">Plan</span><span class="v">{{ appt.insurer }}</span></div>
        <div class="row"><span class="k">Member ID</span><span class="v">{{ appt.memberId }}</span></div>
      </div>
    </div>

    <p v-if="flagged" class="knote">No problem — a front-desk team member will update it when you're called.</p>

    <div class="actions">
      <button class="kbtn kbtn-ghost" @click="flagged = true">Something's changed</button>
      <button class="kbtn kbtn-primary" @click="$emit('ok')">Looks correct →</button>
    </div>
    <button class="back" @click="$emit('back')">← Back</button>
  </div>
</template>

<style scoped>
.blocks {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.block {
  background: var(--frame);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px;
}
.title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--faint);
  margin-bottom: 12px;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}
.row:last-child {
  margin-bottom: 0;
}
.k {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.v {
  font-size: 15.5px;
  font-weight: 700;
}
.back {
  margin-top: 16px;
  background: none;
  border: none;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  font-size: 14px;
}
.back:hover {
  color: var(--ink);
}
@media (max-width: 520px) {
  .blocks {
    grid-template-columns: 1fr;
  }
}
</style>
