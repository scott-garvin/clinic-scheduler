import { reactive } from 'vue';

export type CheckStatus = 'scheduled' | 'checked-in' | 'roomed' | 'completed' | 'no-show';

export interface TimelineEvent {
  at: string; // display time, e.g. "8:52 AM" or "Booked"
  label: string;
}

export interface Appointment {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  gender: string;
  mrn: string;
  timeLabel: string; // appointment time, display
  apptMinutes: number; // minutes since midnight, for reliable sorting
  provider: string;
  location: string;
  type: string;
  phone: string;
  address: string;
  insurer: string;
  memberId: string;
  copayCents: number;
  status: CheckStatus;
  checkInTime: string | null; // ISO, set when the patient checks in
  events: TimelineEvent[];
}

function isoAt(totalMin: number): string {
  const d = new Date();
  d.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
  return d.toISOString();
}

function timeStr(totalMin: number): string {
  let h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
}

const FIRST = ['Jordan', 'Sofia', 'Wes', 'Lena', 'Caleb', 'Grace', 'Diego', 'Hana', 'Noah', 'Aria', 'Malik', 'Priya', 'Owen', 'Ruth', 'Sana', 'Ivy', 'Leo', 'Nora', 'Theo', 'Zoe', 'Ravi', 'Elena', 'Andre', 'Dana', 'Kofi', 'Mei', 'Luca', 'Fatima', 'Sean', 'Yuki', 'Omar', 'Bea', 'Cyrus', 'Talia'];
const LAST = ['Avery', 'Marin', 'Okafor', 'Petrova', 'Ross', 'Bauer', 'Salas', 'Kim', 'Bennett', 'Nomura', 'Reyes', 'Chen', 'Delgado', 'Abbott', 'Farah', 'Sokolov', 'Duarte', 'Whitfield', 'Haddad', 'Lindqvist', 'Osei', 'Moretti', 'Baptiste', 'Ellery', 'Mensah', 'Tanaka', 'Ferraro', 'Nasser', 'Doyle', 'Sato', 'Rahman', 'Ashby', 'Cardoso', 'Weiss'];
const STREETS = ['Maple St', 'Cedar Ave', 'Birch Ln', 'Oak Blvd', 'Pine Ct', 'Elm Way', 'Willow Rd', 'Aspen Dr', 'Juniper Pl', 'Chestnut Row', 'Magnolia Ct', 'Sycamore St'];
const GENDERS = ['Female', 'Male', 'Female', 'Male', 'Nonbinary'];

const PROVIDERS: Array<{ name: string; location: string; types: string[] }> = [
  { name: 'Dr. Alice Nguyen', location: 'Main Clinic', types: ['Follow-up', 'Annual physical', 'Lab review', 'Medication check'] },
  { name: 'Dr. Marcus Bell', location: 'Cardiology Suite', types: ['Cardiology consult', 'Follow-up', 'Stress test', 'Device check'] },
  { name: 'Dr. Priya Rao', location: 'Pediatrics', types: ['New patient', 'Well-child visit', 'Follow-up', 'Immunization'] },
  { name: 'Dr. Sarah Cohen', location: 'Main Clinic', types: ['Annual physical', 'Follow-up', 'Telehealth', 'Lab review'] },
  { name: 'Dr. James Park', location: 'Orthopedics', types: ['Post-op check', 'Injury eval', 'Follow-up', 'Injection'] },
];
const INSURERS: Array<[string, string]> = [['BlueCross BlueShield', 'BCBS'], ['Aetna', 'AET'], ['UnitedHealthcare', 'UHC'], ['Cigna', 'CIG'], ['Medicare', 'MED'], ['Humana', 'HUM'], ['Kaiser Permanente', 'KP']];
const COPAYS = [2500, 0, 4000, 3000, 2000, 1500, 0, 2500, 3500, 1000];

// Realistic distribution across the day: the morning is largely worked through,
// the afternoon is still to come. checked-in(7)+roomed(4)=11 in-clinic, 15 scheduled,
// 5 completed, 3 no-shows.
const STATUS_PLAN: CheckStatus[] = [
  'completed', 'completed', 'completed', 'roomed', 'completed', 'no-show', 'roomed', 'checked-in',
  'completed', 'roomed', 'checked-in', 'checked-in', 'roomed', 'no-show', 'checked-in', 'checked-in',
  'scheduled', 'scheduled', 'checked-in', 'scheduled', 'scheduled', 'scheduled', 'scheduled', 'scheduled',
  'scheduled', 'scheduled', 'scheduled', 'no-show', 'scheduled', 'scheduled', 'scheduled', 'scheduled',
  'scheduled', 'scheduled',
];

function buildSeed(): Appointment[] {
  const out: Appointment[] = [];
  for (let i = 0; i < STATUS_PLAN.length; i++) {
    const prov = PROVIDERS[i % PROVIDERS.length];
    const status = STATUS_PLAN[i];
    const apptMin = 480 + i * 15; // 8:00 AM onward, every 15 min
    const arrived = status === 'completed' || status === 'roomed' || status === 'checked-in';
    const [insurer, code] = INSURERS[i % INSURERS.length];
    const year = 1948 + ((i * 7) % 56);
    const month = (i % 12) + 1;
    const day = ((i * 3) % 27) + 1;
    const dob = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const events: TimelineEvent[] = [{ at: 'Booked', label: 'Appointment scheduled' }];
    if (arrived) events.push({ at: timeStr(apptMin - 6), label: 'Checked in at kiosk' });
    if (status === 'roomed' || status === 'completed') events.push({ at: timeStr(apptMin + 4), label: `Roomed — ${prov.name}` });
    if (status === 'completed') events.push({ at: timeStr(apptMin + 28), label: 'Visit completed' });
    if (status === 'no-show') events.push({ at: timeStr(apptMin + 10), label: 'Marked no-show' });

    out.push({
      id: `a${i + 1}`,
      firstName: FIRST[i],
      lastName: LAST[i],
      dob,
      gender: GENDERS[i % GENDERS.length],
      mrn: `MRN-${480200 + i * 13}`,
      timeLabel: timeStr(apptMin),
      apptMinutes: apptMin,
      provider: prov.name,
      location: prov.location,
      type: prov.types[i % prov.types.length],
      phone: `(555) ${200 + i}-${((i * 137) % 9000 + 1000).toString()}`,
      address: `${100 + i * 3} ${STREETS[i % STREETS.length]}, Springfield`,
      insurer,
      memberId: `${code}-${1000000 + i * 11317}`,
      copayCents: COPAYS[i % COPAYS.length],
      status,
      checkInTime: arrived ? isoAt(apptMin - 6) : null,
      events,
    });
  }
  return out;
}

export const appointments = reactive<Appointment[]>(buildSeed());

let idSeq = appointments.length;

function nowLabel(): string {
  return formatTime(new Date().toISOString());
}

export function findAppointment(lastName: string, dob: string): Appointment | undefined {
  const ln = lastName.trim().toLowerCase();
  return appointments.find((a) => a.lastName.toLowerCase() === ln && a.dob === dob);
}

const STATUS_EVENT: Record<CheckStatus, string> = {
  scheduled: 'Reset to scheduled',
  'checked-in': 'Checked in',
  roomed: 'Roomed',
  completed: 'Visit completed',
  'no-show': 'Marked no-show',
};

export function checkIn(id: string): void {
  const a = appointments.find((x) => x.id === id);
  if (!a) return;
  a.status = 'checked-in';
  a.checkInTime = new Date().toISOString();
  a.events.push({ at: nowLabel(), label: 'Checked in at kiosk' });
}

export function setStatus(id: string, status: CheckStatus): void {
  const a = appointments.find((x) => x.id === id);
  if (!a || a.status === status) return;
  a.status = status;
  if (status === 'checked-in' && !a.checkInTime) a.checkInTime = new Date().toISOString();
  a.events.push({ at: nowLabel(), label: STATUS_EVENT[status] });
}

export interface NewAppointmentInput {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  timeLabel: string;
  apptMinutes: number;
  provider: string;
  type: string;
  insurer: string;
  copayCents: number;
}

export function providerLocation(name: string): string {
  return PROVIDERS.find((p) => p.name === name)?.location ?? 'Main Clinic';
}

export const providerNames = PROVIDERS.map((p) => p.name);
export const insurerNames = INSURERS.map(([n]) => n);

export function addAppointment(input: NewAppointmentInput): Appointment {
  idSeq += 1;
  const seq = idSeq;
  const appt: Appointment = {
    id: `a${seq}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    dob: input.dob,
    gender: input.gender,
    mrn: `MRN-${480200 + seq * 13}`,
    timeLabel: input.timeLabel,
    apptMinutes: input.apptMinutes,
    provider: input.provider,
    location: providerLocation(input.provider),
    type: input.type,
    phone: '(555) 000-0000',
    address: '—',
    insurer: input.insurer,
    memberId: 'Pending verification',
    copayCents: input.copayCents,
    status: 'scheduled',
    checkInTime: null,
    events: [{ at: nowLabel(), label: 'Appointment scheduled at front desk' }],
  };
  appointments.push(appt);
  return appt;
}

export function formatDob(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function ageFromDob(iso: string): number {
  const b = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
export function statusLabel(s: CheckStatus): string {
  return s.replace('-', ' ');
}
