import { reactive, computed, watch } from 'vue';

export type Status = 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'no-show' | 'cancelled';

export interface Provider {
  id: string;
  name: string;
  specialty: string;
}
export interface Patient {
  id: string;
  name: string;
  mrn: string;
}
export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  start: string; // ISO datetime
  durationMin: number;
  type: string;
  status: Status;
}

interface Persisted {
  providers: Provider[];
  patients: Patient[];
  appointments: Appointment[];
}

const KEY = 'clera.v1';

function uid(p: string): string {
  return `${p}_${Math.random().toString(36).slice(2, 9)}`;
}
function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function dayAt(daysAgo: number, h: number, m: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const seedProviders: Provider[] = [
  { id: 'p1', name: 'Dr. Alice Nguyen', specialty: 'Family Medicine' },
  { id: 'p2', name: 'Dr. Marcus Bell', specialty: 'Cardiology' },
  { id: 'p3', name: 'Dr. Priya Rao', specialty: 'Pediatrics' },
];

const seedPatients: Patient[] = [
  { id: 'pt1', name: 'Jordan Avery', mrn: 'MRN-10241' },
  { id: 'pt2', name: 'Sofia Marin', mrn: 'MRN-10255' },
  { id: 'pt3', name: 'Wes Okafor', mrn: 'MRN-10262' },
  { id: 'pt4', name: 'Lena Petrova', mrn: 'MRN-10274' },
  { id: 'pt5', name: 'Caleb Ross', mrn: 'MRN-10288' },
  { id: 'pt6', name: 'Imani Clarke', mrn: 'MRN-10291' },
  { id: 'pt7', name: 'Diego Salas', mrn: 'MRN-10305' },
  { id: 'pt8', name: 'Hana Kim', mrn: 'MRN-10318' },
  { id: 'pt9', name: 'Tomas Vidal', mrn: 'MRN-10327' },
  { id: 'pt10', name: 'Grace Bauer', mrn: 'MRN-10339' },
];

const types = ['New patient', 'Follow-up', 'Annual physical', 'Consult', 'Lab review', 'Telehealth'];

function seedAppointments(): Appointment[] {
  // patientId, providerId, hour, min, durationMin, type, status
  const today: Array<[string, string, number, number, number, string, Status]> = [
    ['pt1', 'p1', 9, 0, 30, 'Follow-up', 'completed'],
    ['pt2', 'p1', 9, 30, 30, 'Annual physical', 'completed'],
    ['pt3', 'p2', 10, 0, 45, 'Consult', 'checked-in'],
    ['pt4', 'p1', 10, 30, 30, 'Follow-up', 'in-progress'],
    ['pt5', 'p3', 11, 0, 20, 'New patient', 'scheduled'],
    ['pt6', 'p2', 11, 30, 30, 'Lab review', 'no-show'],
    ['pt7', 'p1', 13, 0, 30, 'Follow-up', 'scheduled'],
    ['pt8', 'p3', 13, 30, 20, 'Telehealth', 'scheduled'],
    ['pt9', 'p2', 14, 0, 45, 'Consult', 'scheduled'],
    ['pt10', 'p1', 15, 0, 30, 'Annual physical', 'scheduled'],
  ];
  const appts: Appointment[] = today.map(([patientId, providerId, h, m, dur, type, status]) => ({
    id: uid('apt'),
    patientId,
    providerId,
    start: todayAt(h, m),
    durationMin: dur,
    type,
    status,
  }));

  // prior days, for the weekly volume chart
  const perDay = [6, 8, 5, 9, 7, 4]; // 1..6 days ago
  perDay.forEach((count, idx) => {
    const daysAgo = idx + 1;
    for (let k = 0; k < count; k++) {
      appts.push({
        id: uid('apt'),
        patientId: seedPatients[k % seedPatients.length].id,
        providerId: seedProviders[k % seedProviders.length].id,
        start: dayAt(daysAgo, 9 + (k % 7), (k % 2) * 30),
        durationMin: 30,
        type: types[k % types.length],
        status: 'completed',
      });
    }
  });
  return appts;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* fall through to seed */
  }
  return { providers: seedProviders, patients: seedPatients, appointments: seedAppointments() };
}

export const state = reactive<Persisted>(load());

watch(
  state,
  (s) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function patientName(id: string): string {
  return state.patients.find((p) => p.id === id)?.name ?? 'Unknown';
}
export function provider(id: string): Provider | undefined {
  return state.providers.find((p) => p.id === id);
}
export function statusLabel(s: Status): string {
  return s.replace('-', ' ');
}
function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export const todaysAppointments = computed(() =>
  state.appointments.filter((a) => isToday(a.start)).sort((a, b) => a.start.localeCompare(b.start)),
);

export const kpis = computed(() => {
  const t = todaysAppointments.value;
  return {
    today: t.length,
    active: t.filter((a) => a.status === 'checked-in' || a.status === 'in-progress').length,
    completed: t.filter((a) => a.status === 'completed').length,
    noShow: t.filter((a) => a.status === 'no-show').length,
  };
});

export const weekVolume = computed(() => {
  const out: Array<{ label: string; count: number }> = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date();
    d.setDate(d.getDate() - k);
    const count = state.appointments.filter((a) => new Date(a.start).toDateString() === d.toDateString()).length;
    out.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), count });
  }
  return out;
});

export function addAppointment(input: {
  patientId: string;
  providerId: string;
  time: string; // "HH:MM"
  durationMin: number;
  type: string;
}): void {
  const [h, m] = input.time.split(':').map((n) => Number(n));
  state.appointments.push({
    id: uid('apt'),
    patientId: input.patientId,
    providerId: input.providerId,
    start: todayAt(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0),
    durationMin: input.durationMin,
    type: input.type,
    status: 'scheduled',
  });
}
export function setStatus(id: string, status: Status): void {
  const a = state.appointments.find((x) => x.id === id);
  if (a) a.status = status;
}
export function removeAppointment(id: string): void {
  const i = state.appointments.findIndex((x) => x.id === id);
  if (i >= 0) state.appointments.splice(i, 1);
}
export function resetDemo(): void {
  state.providers = seedProviders.map((x) => ({ ...x }));
  state.patients = seedPatients.map((x) => ({ ...x }));
  state.appointments = seedAppointments();
}
