<script setup lang="ts">
import { computed } from 'vue';
import Modal from './Modal.vue';
import StatusPill from './StatusPill.vue';
import {
  type Appointment,
  type CheckStatus,
  setStatus,
  formatDob,
  ageFromDob,
  formatMoney,
  statusLabel,
} from '../store';
import { toast } from '../useToast';

const props = defineProps<{ appt: Appointment }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const fullName = computed(() => `${props.appt.firstName} ${props.appt.lastName}`);

const actions: Array<{ status: CheckStatus; label: string; kind: 'primary' | 'ghost' | 'danger' }> = [
  { status: 'checked-in', label: 'Check in', kind: 'primary' },
  { status: 'roomed', label: 'Room patient', kind: 'ghost' },
  { status: 'completed', label: 'Complete visit', kind: 'ghost' },
  { status: 'no-show', label: 'No-show', kind: 'danger' },
];

function apply(status: CheckStatus) {
  setStatus(props.appt.id, status);
  toast(`${fullName.value} → ${statusLabel(status)}`, status === 'no-show' ? 'error' : 'success');
}
</script>

<template>
  <Modal :title="fullName" :subtitle="`${appt.mrn} · ${appt.timeLabel} · ${appt.type}`" variant="sheet" @close="emit('close')">
    <div class="head">
      <StatusPill :status="appt.status" />
      <span class="prov">{{ appt.provider }} · {{ appt.location }}</span>
    </div>

    <section>
      <h4>Quick actions</h4>
      <div class="qa">
        <button
          v-for="a in actions"
          :key="a.status"
          class="qbtn"
          :class="a.kind"
          :disabled="appt.status === a.status"
          @click="apply(a.status)"
        >
          {{ a.label }}
        </button>
      </div>
    </section>

    <section>
      <h4>Demographics</h4>
      <dl class="grid">
        <div><dt>Date of birth</dt><dd>{{ formatDob(appt.dob) }} <span class="mut">({{ ageFromDob(appt.dob) }})</span></dd></div>
        <div><dt>Gender</dt><dd>{{ appt.gender }}</dd></div>
        <div><dt>Phone</dt><dd>{{ appt.phone }}</dd></div>
        <div class="wide"><dt>Address</dt><dd>{{ appt.address }}</dd></div>
      </dl>
    </section>

    <section>
      <h4>Insurance</h4>
      <dl class="grid">
        <div><dt>Plan</dt><dd>{{ appt.insurer }}</dd></div>
        <div><dt>Member ID</dt><dd>{{ appt.memberId }}</dd></div>
        <div><dt>Copay due</dt><dd class="copay">{{ formatMoney(appt.copayCents) }}</dd></div>
      </dl>
    </section>

    <section>
      <h4>Visit timeline</h4>
      <ol class="tl">
        <li v-for="(e, i) in appt.events" :key="i">
          <span class="dot" aria-hidden="true"></span>
          <span class="tl-at tnum">{{ e.at }}</span>
          <span class="tl-lab">{{ e.label }}</span>
        </li>
      </ol>
    </section>
  </Modal>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.prov {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
section {
  margin-top: 22px;
}
h4 {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--faint);
  margin-bottom: 12px;
}
.qa {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.qbtn {
  border: 1.5px solid var(--border-strong);
  background: #fff;
  color: var(--ink-2);
  font: inherit;
  font-weight: 700;
  font-size: 13.5px;
  padding: 10px 12px;
  border-radius: 10px;
}
.qbtn:hover:not(:disabled) {
  border-color: var(--muted);
}
.qbtn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.qbtn.primary:hover:not(:disabled) {
  background: var(--accent-ink);
}
.qbtn.danger {
  color: var(--red);
  border-color: #f0c4c4;
}
.qbtn.danger:hover:not(:disabled) {
  background: var(--red-soft);
}
.qbtn:disabled {
  opacity: 0.4;
  cursor: default;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
}
.grid .wide {
  grid-column: 1 / -1;
}
dt {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 2px;
}
dd {
  font-size: 14.5px;
  font-weight: 700;
}
.mut {
  color: var(--faint);
  font-weight: 600;
}
.copay {
  color: var(--accent-ink);
}
.tl {
  list-style: none;
  border-left: 2px solid var(--border);
  margin-left: 5px;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tl li {
  position: relative;
  display: flex;
  flex-direction: column;
}
.dot {
  position: absolute;
  left: -23px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.tl-at {
  font-size: 12px;
  color: var(--muted);
  font-weight: 700;
}
.tl-lab {
  font-size: 14px;
  font-weight: 600;
}
</style>
