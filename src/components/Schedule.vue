<script setup lang="ts">
import {
  todaysAppointments,
  kpis,
  weekVolume,
  formatTime,
  patientName,
  provider,
  setStatus,
  removeAppointment,
  type Status,
} from '../store';
import StatCard from './StatCard.vue';
import StatusPill from './StatusPill.vue';
import WeekChart from './WeekChart.vue';

const statuses: Status[] = ['scheduled', 'checked-in', 'in-progress', 'completed', 'no-show', 'cancelled'];
function onStatus(id: string, e: Event) {
  setStatus(id, (e.target as HTMLSelectElement).value as Status);
}
</script>

<template>
  <div class="page">
    <div class="stats">
      <StatCard label="Today's appointments" :value="String(kpis.today)" tone="accent" />
      <StatCard label="Checked in / in room" :value="String(kpis.active)" tone="teal" />
      <StatCard label="Completed" :value="String(kpis.completed)" />
      <StatCard
        label="No-shows"
        :value="String(kpis.noShow)"
        :sub="kpis.noShow ? 'needs follow-up' : 'none today'"
        tone="red"
      />
    </div>

    <div class="row">
      <div class="card sched">
        <div class="card-head">
          <h3>Today's schedule</h3>
          <span class="muted">{{ kpis.today }} appointments</span>
        </div>
        <ul>
          <li v-for="a in todaysAppointments" :key="a.id" class="appt">
            <div class="time tnum">{{ formatTime(a.start) }}</div>
            <div class="who">
              <div class="pt">{{ patientName(a.patientId) }}</div>
              <div class="sub">{{ a.type }} · {{ provider(a.providerId)?.name }}</div>
            </div>
            <div class="right">
              <StatusPill :status="a.status" />
              <select :value="a.status" aria-label="Change status" @change="onStatus(a.id, $event)">
                <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
              </select>
              <button class="del" title="Remove appointment" @click="removeAppointment(a.id)">✕</button>
            </div>
          </li>
          <li v-if="todaysAppointments.length === 0" class="empty">No appointments today.</li>
        </ul>
      </div>

      <div class="card chart-card">
        <div class="card-head">
          <h3>Appointment volume</h3>
          <span class="muted">last 7 days</span>
        </div>
        <div class="chart-fill"><WeekChart :data="weekVolume" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.row {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
  align-items: stretch;
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.card-head h3 {
  font-size: 15px;
  font-weight: 800;
}
.muted {
  color: var(--faint);
  font-size: 12.5px;
}
.sched {
  padding: 18px 20px;
}
.sched ul {
  list-style: none;
}
.appt {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.appt:last-child {
  border-bottom: none;
}
.time {
  font-weight: 800;
  font-size: 14px;
  width: 74px;
  flex: none;
  color: var(--ink);
}
.who {
  flex: 1;
  min-width: 160px;
}
.pt {
  font-weight: 700;
  font-size: 14px;
}
.sub {
  font-size: 12.5px;
  color: var(--muted);
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.right select {
  font: inherit;
  font-size: 12.5px;
  text-transform: capitalize;
  padding: 5px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink-2);
}
.del {
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--muted);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 12px;
}
.del:hover {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-soft);
}
.empty {
  text-align: center;
  color: var(--faint);
  padding: 30px;
}
.chart-card {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
}
.chart-fill {
  flex: 1;
  min-height: 180px;
}
@media (max-width: 980px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .row {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
