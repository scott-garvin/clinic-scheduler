<script setup lang="ts">
import { computed } from 'vue';
import { state } from '../store';

const rows = computed(() =>
  state.patients.map((p) => {
    const mine = state.appointments.filter((a) => a.patientId === p.id);
    const upcoming = mine.filter(
      (a) => a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'in-progress',
    ).length;
    const initials = p.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return { ...p, upcoming, total: mine.length, initials };
  }),
);
</script>

<template>
  <div class="grid">
    <div v-for="p in rows" :key="p.id" class="card patient">
      <div class="top">
        <div class="avatar">{{ p.initials }}</div>
        <div>
          <div class="name">{{ p.name }}</div>
          <div class="mrn tnum">{{ p.mrn }}</div>
        </div>
      </div>
      <div class="meta">
        <div class="cell">
          <span class="k">Upcoming</span>
          <span class="v tnum">{{ p.upcoming }}</span>
        </div>
        <div class="cell">
          <span class="k">Total visits</span>
          <span class="v tnum">{{ p.total }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.patient {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.top {
  display: flex;
  gap: 13px;
  align-items: center;
}
.avatar {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 15px;
}
.name {
  font-weight: 700;
  font-size: 15px;
}
.mrn {
  font-size: 12.5px;
  color: var(--muted);
}
.meta {
  display: flex;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.k {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.v {
  font-weight: 800;
  font-size: 15px;
}
</style>
