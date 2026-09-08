<script setup lang="ts">
import { ref, computed } from 'vue';
import { appointments, formatTime, formatMoney, setStatus, type CheckStatus } from '../store';
import StatusPill from './StatusPill.vue';

const statuses: CheckStatus[] = ['scheduled', 'checked-in', 'roomed', 'completed', 'no-show'];
const filters: Array<'all' | CheckStatus> = ['all', ...statuses];
const filter = ref<'all' | CheckStatus>('all');

const rows = computed(() => appointments.filter((a) => filter.value === 'all' || a.status === filter.value));
const kpis = computed(() => ({
  checkedIn: appointments.filter((a) => a.status === 'checked-in' || a.status === 'roomed').length,
  scheduled: appointments.filter((a) => a.status === 'scheduled').length,
  completed: appointments.filter((a) => a.status === 'completed').length,
  noShow: appointments.filter((a) => a.status === 'no-show').length,
}));

function onStatus(id: string, e: Event) {
  setStatus(id, (e.target as HTMLSelectElement).value as CheckStatus);
}
</script>

<template>
  <div class="board">
    <div class="kpis">
      <div class="kpi card"><div class="lab">Checked in</div><div class="val tnum accent">{{ kpis.checkedIn }}</div></div>
      <div class="kpi card"><div class="lab">Yet to arrive</div><div class="val tnum">{{ kpis.scheduled }}</div></div>
      <div class="kpi card"><div class="lab">Completed</div><div class="val tnum">{{ kpis.completed }}</div></div>
      <div class="kpi card"><div class="lab">No-shows</div><div class="val tnum red">{{ kpis.noShow }}</div></div>
    </div>

    <div class="filters">
      <button v-for="f in filters" :key="f" class="chip2" :class="{ on: filter === f }" @click="filter = f">{{ f }}</button>
    </div>

    <div class="card wrap">
      <table>
        <thead>
          <tr>
            <th>Checked in</th>
            <th>Patient</th>
            <th>Appt</th>
            <th>Provider</th>
            <th>Location</th>
            <th>Visit</th>
            <th>Insurance</th>
            <th class="ar">Copay</th>
            <th>Status</th>
            <th class="ar">Update</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td class="tnum intime" :class="{ dash: !a.checkInTime }">{{ formatTime(a.checkInTime) }}</td>
            <td>
              <div class="pt">{{ a.firstName }} {{ a.lastName }}</div>
              <div class="sub tnum">{{ a.dob }} · {{ a.gender }}</div>
            </td>
            <td class="tnum nowrap">{{ a.timeLabel }}</td>
            <td class="nowrap">{{ a.provider }}</td>
            <td>{{ a.location }}</td>
            <td>{{ a.type }}</td>
            <td class="sub">{{ a.insurer }}</td>
            <td class="ar tnum">{{ formatMoney(a.copayCents) }}</td>
            <td><StatusPill :status="a.status" /></td>
            <td class="ar">
              <select :value="a.status" aria-label="Update status" @change="onStatus(a.id, $event)">
                <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
              </select>
            </td>
          </tr>
          <tr v-if="rows.length === 0"><td colspan="10" class="empty">No patients match this filter.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.kpi {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lab {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
}
.val {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.val.accent {
  color: var(--accent-ink);
}
.val.red {
  color: var(--red);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip2 {
  border: 1px solid var(--border);
  background: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 12.5px;
  text-transform: capitalize;
  color: var(--muted);
  padding: 7px 13px;
  border-radius: 999px;
  cursor: pointer;
}
.chip2:hover {
  color: var(--ink);
}
.chip2.on {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}
.wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
}
th {
  text-align: left;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--faint);
  padding: 13px 14px;
  border-bottom: 1px solid var(--border);
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
  vertical-align: middle;
}
tbody tr:last-child td {
  border-bottom: none;
}
tbody tr:hover {
  background: #f7faff;
}
.ar {
  text-align: right;
}
.nowrap {
  white-space: nowrap;
}
.intime {
  font-weight: 700;
}
.intime.dash {
  color: var(--faint);
  font-weight: 400;
}
.pt {
  font-weight: 700;
}
.sub {
  font-size: 12px;
  color: var(--muted);
}
select {
  font: inherit;
  font-size: 12.5px;
  text-transform: capitalize;
  padding: 5px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: #fff;
  color: var(--ink-2);
}
.empty {
  text-align: center;
  color: var(--faint);
  padding: 34px;
}
@media (max-width: 820px) {
  .kpis {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
