<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  appointments,
  formatTime,
  formatMoney,
  setStatus,
  statusLabel,
  providerNames,
  type Appointment,
  type CheckStatus,
} from '../store';
import { toast } from '../useToast';
import StatusPill from './StatusPill.vue';
import PatientDrawer from './PatientDrawer.vue';
import NewAppointmentModal from './NewAppointmentModal.vue';

const statuses: CheckStatus[] = ['scheduled', 'checked-in', 'roomed', 'completed', 'no-show'];
const filters: Array<'all' | CheckStatus> = ['all', ...statuses];

const statusFilter = ref<'all' | CheckStatus>('all');
const providerFilter = ref<'all' | string>('all');
const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

const pageSizes = [10, 15, 25, 50];
const pageSize = ref(15);
const page = ref(1);

type SortKey = 'appt' | 'name' | 'checkInTime' | 'provider' | 'copay' | 'status';
const sortKey = ref<SortKey>('appt');
const sortDir = ref<'asc' | 'desc'>('asc');

const columns: Array<{ key: SortKey; label: string; align?: 'right' }> = [
  { key: 'checkInTime', label: 'Checked in' },
  { key: 'name', label: 'Patient' },
  { key: 'appt', label: 'Appt' },
  { key: 'provider', label: 'Provider' },
  { key: 'copay', label: 'Copay', align: 'right' },
  { key: 'status', label: 'Status' },
];

const STATUS_RANK: Record<CheckStatus, number> = {
  scheduled: 0,
  'checked-in': 1,
  roomed: 2,
  completed: 3,
  'no-show': 4,
};

const kpis = computed(() => ({
  checkedIn: appointments.filter((a) => a.status === 'checked-in' || a.status === 'roomed').length,
  scheduled: appointments.filter((a) => a.status === 'scheduled').length,
  completed: appointments.filter((a) => a.status === 'completed').length,
  noShow: appointments.filter((a) => a.status === 'no-show').length,
}));

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return appointments.filter((a) => {
    if (statusFilter.value !== 'all' && a.status !== statusFilter.value) return false;
    if (providerFilter.value !== 'all' && a.provider !== providerFilter.value) return false;
    if (!q) return true;
    const hay = `${a.firstName} ${a.lastName} ${a.provider} ${a.insurer} ${a.mrn} ${a.phone} ${a.type}`.toLowerCase();
    return hay.includes(q);
  });
});

const sorted = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1;
  const key = sortKey.value;
  return [...filtered.value].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (key) {
      case 'appt': av = a.apptMinutes; bv = b.apptMinutes; break;
      case 'name': av = `${a.lastName} ${a.firstName}`.toLowerCase(); bv = `${b.lastName} ${b.firstName}`.toLowerCase(); break;
      case 'checkInTime': av = a.checkInTime ?? ''; bv = b.checkInTime ?? ''; break;
      case 'provider': av = a.provider; bv = b.provider; break;
      case 'copay': av = a.copayCents; bv = b.copayCents; break;
      case 'status': av = STATUS_RANK[a.status]; bv = STATUS_RANK[b.status]; break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a.apptMinutes - b.apptMinutes;
  });
});

const total = computed(() => sorted.value.length);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return sorted.value.slice(start, start + pageSize.value);
});
const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1));
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value));

const filtersActive = computed(
  () => statusFilter.value !== 'all' || providerFilter.value !== 'all' || search.value.trim() !== '',
);

// Reset to first page whenever the result set changes; clamp if the page overshoots.
watch([search, statusFilter, providerFilter, pageSize], () => {
  page.value = 1;
});
watch(pageCount, (n) => {
  if (page.value > n) page.value = n;
});

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}
function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

function onStatus(a: Appointment, e: Event) {
  const next = (e.target as HTMLSelectElement).value as CheckStatus;
  setStatus(a.id, next);
  toast(`${a.firstName} ${a.lastName} → ${statusLabel(next)}`, next === 'no-show' ? 'error' : 'success');
}

// selection / modals
const selectedId = ref<string | null>(null);
const selected = computed(() => appointments.find((a) => a.id === selectedId.value) ?? null);
const showNew = ref(false);

function onCreated(a: Appointment) {
  providerFilter.value = 'all';
  statusFilter.value = 'all';
  search.value = '';
  selectedId.value = a.id;
}

function clearSearch() {
  search.value = '';
  searchInput.value?.focus();
}

function exportCsv() {
  const header = ['Checked in', 'First name', 'Last name', 'DOB', 'MRN', 'Appt', 'Provider', 'Location', 'Visit', 'Insurance', 'Member ID', 'Copay (USD)', 'Status'];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = sorted.value.map((a) =>
    [
      formatTime(a.checkInTime),
      a.firstName,
      a.lastName,
      a.dob,
      a.mrn,
      a.timeLabel,
      a.provider,
      a.location,
      a.type,
      a.insurer,
      a.memberId,
      (a.copayCents / 100).toFixed(2),
      statusLabel(a.status),
    ]
      .map((c) => esc(String(c)))
      .join(','),
  );
  const csv = [header.join(','), ...lines].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'todays-schedule.csv';
  link.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${sorted.value.length} appointments`, 'info');
}

function onKey(e: KeyboardEvent) {
  const el = document.activeElement;
  const typing = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
  if (e.key === '/' && !typing) {
    e.preventDefault();
    searchInput.value?.focus();
  }
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="board">
    <div class="kpis">
      <div class="kpi card"><div class="lab">Checked in</div><div class="val tnum accent">{{ kpis.checkedIn }}</div></div>
      <div class="kpi card"><div class="lab">Yet to arrive</div><div class="val tnum">{{ kpis.scheduled }}</div></div>
      <div class="kpi card"><div class="lab">Completed</div><div class="val tnum">{{ kpis.completed }}</div></div>
      <div class="kpi card"><div class="lab">No-shows</div><div class="val tnum red">{{ kpis.noShow }}</div></div>
    </div>

    <div class="toolbar">
      <div class="search">
        <span class="mag" aria-hidden="true">⌕</span>
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          placeholder="Search name, provider, insurer, MRN, phone…"
          aria-label="Search appointments"
          @keydown.esc="clearSearch"
        />
        <kbd v-if="!search">/</kbd>
      </div>
      <select v-model="providerFilter" aria-label="Filter by provider" class="provsel">
        <option value="all">All providers</option>
        <option v-for="p in providerNames" :key="p" :value="p">{{ p }}</option>
      </select>
      <div class="grow"></div>
      <button class="tbtn ghost" @click="exportCsv">Export CSV</button>
      <button class="tbtn primary" @click="showNew = true">+ New appointment</button>
    </div>

    <div class="filters">
      <button v-for="f in filters" :key="f" class="chip2" :class="{ on: statusFilter === f }" @click="statusFilter = f">{{ f }}</button>
    </div>

    <div class="card wrap">
      <table>
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="{ ar: c.align === 'right', sortable: true, active: sortKey === c.key }"
              :aria-sort="ariaSort(c.key)"
              @click="toggleSort(c.key)"
            >
              {{ c.label }}<span class="arrow">{{ sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
            </th>
            <th>Location</th>
            <th>Visit</th>
            <th>Insurance</th>
            <th class="ar">Update</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in paged" :key="a.id" class="prow" @click="selectedId = a.id">
            <td class="tnum intime" :class="{ dash: !a.checkInTime }">{{ formatTime(a.checkInTime) }}</td>
            <td>
              <div class="pt">{{ a.firstName }} {{ a.lastName }}</div>
              <div class="sub tnum">{{ a.dob }} · {{ a.gender }} · {{ a.mrn }}</div>
            </td>
            <td class="tnum nowrap">{{ a.timeLabel }}</td>
            <td class="nowrap">{{ a.provider }}</td>
            <td class="ar tnum">{{ formatMoney(a.copayCents) }}</td>
            <td><StatusPill :status="a.status" /></td>
            <td>{{ a.location }}</td>
            <td>{{ a.type }}</td>
            <td class="sub">{{ a.insurer }}</td>
            <td class="ar" @click.stop>
              <select :value="a.status" aria-label="Update status" @change="onStatus(a, $event)">
                <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
              </select>
            </td>
          </tr>
          <tr v-if="total === 0">
            <td colspan="10" class="empty">
              <template v-if="filtersActive">
                No appointments match your search or filters.
                <button class="linkbtn" @click="search = ''; statusFilter = 'all'; providerFilter = 'all'">Clear all</button>
              </template>
              <template v-else>No appointments on the schedule yet.</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > 0" class="pager">
      <div class="pinfo">Showing <b class="tnum">{{ rangeStart }}–{{ rangeEnd }}</b> of <b class="tnum">{{ total }}</b></div>
      <div class="psize">
        <label>Rows
          <select v-model.number="pageSize" aria-label="Rows per page">
            <option v-for="s in pageSizes" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
      <div class="pnav">
        <button class="pbtn" :disabled="page <= 1" @click="page = 1" aria-label="First page">«</button>
        <button class="pbtn" :disabled="page <= 1" @click="page--" aria-label="Previous page">‹</button>
        <span class="ppos tnum">Page {{ page }} / {{ pageCount }}</span>
        <button class="pbtn" :disabled="page >= pageCount" @click="page++" aria-label="Next page">›</button>
        <button class="pbtn" :disabled="page >= pageCount" @click="page = pageCount" aria-label="Last page">»</button>
      </div>
    </div>

    <PatientDrawer v-if="selected" :appt="selected" @close="selectedId = null" />
    <NewAppointmentModal v-if="showNew" @close="showNew = false" @created="onCreated" />
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
.val.accent { color: var(--accent-ink); }
.val.red { color: var(--red); }

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.search {
  position: relative;
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
}
.search .mag {
  position: absolute;
  left: 13px;
  font-size: 16px;
  color: var(--faint);
  pointer-events: none;
}
.search input {
  width: 100%;
  font: inherit;
  font-size: 14px;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--border-strong);
  border-radius: 11px;
  background: #fff;
  color: var(--ink);
}
.search input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.search kbd {
  position: absolute;
  right: 12px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  color: var(--faint);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 6px;
}
.provsel {
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 11px;
  background: #fff;
  color: var(--ink-2);
}
.grow { flex: 1; }
.tbtn {
  font: inherit;
  font-weight: 700;
  font-size: 13.5px;
  padding: 10px 15px;
  border-radius: 11px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.tbtn.ghost {
  background: #fff;
  border-color: var(--border-strong);
  color: var(--ink-2);
}
.tbtn.ghost:hover { border-color: var(--muted); color: var(--ink); }
.tbtn.primary { background: var(--accent); color: #fff; }
.tbtn.primary:hover { background: var(--accent-ink); }

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
.chip2:hover { color: var(--ink); }
.chip2.on { background: var(--ink); border-color: var(--ink); color: #fff; }

.wrap { overflow-x: auto; }
table {
  width: 100%;
  min-width: 1000px;
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
  white-space: nowrap;
}
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--muted); }
th.active { color: var(--accent-ink); }
.arrow {
  display: inline-block;
  width: 12px;
  margin-left: 2px;
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
  vertical-align: middle;
}
tbody tr:last-child td { border-bottom: none; }
.prow { cursor: pointer; }
.prow:hover { background: #f7faff; }
.ar { text-align: right; }
.nowrap { white-space: nowrap; }
.intime { font-weight: 700; }
.intime.dash { color: var(--faint); font-weight: 400; }
.pt { font-weight: 700; }
.sub { font-size: 12px; color: var(--muted); }
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
  padding: 40px 20px;
}
.linkbtn {
  border: none;
  background: none;
  color: var(--accent-ink);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  margin-left: 6px;
}

.pager {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 2px 4px;
}
.pinfo { font-size: 13px; color: var(--muted); }
.pinfo b { color: var(--ink); }
.psize { font-size: 13px; color: var(--muted); }
.psize label { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.psize select { text-transform: none; }
.pnav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.pbtn {
  border: 1px solid var(--border-strong);
  background: #fff;
  color: var(--ink-2);
  font: inherit;
  font-weight: 700;
  min-width: 34px;
  height: 34px;
  border-radius: 9px;
}
.pbtn:hover:not(:disabled) { border-color: var(--muted); }
.pbtn:disabled { opacity: 0.4; cursor: default; }
.ppos { font-size: 13px; font-weight: 700; padding: 0 6px; }
@media (max-width: 820px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .pnav { margin-left: 0; }
}
</style>
