import { reactive } from 'vue';

export type CheckStatus = 'scheduled' | 'checked-in' | 'roomed' | 'completed' | 'no-show';

export interface Appointment {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  gender: string;
  timeLabel: string; // appointment time
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
}

// Today's schedule (sample data only). A few are still 'scheduled' so they can be
// checked in via the patient kiosk — doing so updates the staff board live.
export const appointments = reactive<Appointment[]>([
  { id: 'a1', firstName: 'Jordan', lastName: 'Avery', dob: '1985-04-12', gender: 'Female', timeLabel: '9:00 AM', provider: 'Dr. Alice Nguyen', location: 'Main Clinic', type: 'Follow-up', phone: '(555) 201-4412', address: '118 Maple St, Springfield', insurer: 'BlueCross BlueShield', memberId: 'BCBS-4471902', copayCents: 2500, status: 'completed', checkInTime: isoAt(8, 52) },
  { id: 'a2', firstName: 'Sofia', lastName: 'Marin', dob: '1992-11-03', gender: 'Female', timeLabel: '9:30 AM', provider: 'Dr. Alice Nguyen', location: 'Main Clinic', type: 'Annual physical', phone: '(555) 288-1190', address: '42 Cedar Ave, Springfield', insurer: 'Aetna', memberId: 'AET-5563008', copayCents: 0, status: 'roomed', checkInTime: isoAt(9, 21) },
  { id: 'a3', firstName: 'Wes', lastName: 'Okafor', dob: '1978-06-21', gender: 'Male', timeLabel: '10:00 AM', provider: 'Dr. Marcus Bell', location: 'Cardiology Suite', type: 'Cardiology consult', phone: '(555) 419-7723', address: '9 Birch Ln, Springfield', insurer: 'UnitedHealthcare', memberId: 'UHC-9902141', copayCents: 4000, status: 'checked-in', checkInTime: isoAt(9, 48) },
  { id: 'a4', firstName: 'Lena', lastName: 'Petrova', dob: '2001-02-15', gender: 'Female', timeLabel: '10:30 AM', provider: 'Dr. Priya Rao', location: 'Pediatrics', type: 'New patient', phone: '(555) 662-3308', address: '305 Oak Blvd, Springfield', insurer: 'Cigna', memberId: 'CIG-3341887', copayCents: 3000, status: 'scheduled', checkInTime: null },
  { id: 'a5', firstName: 'Caleb', lastName: 'Ross', dob: '1966-09-30', gender: 'Male', timeLabel: '11:00 AM', provider: 'Dr. Marcus Bell', location: 'Cardiology Suite', type: 'Follow-up', phone: '(555) 774-9021', address: '77 Pine Ct, Springfield', insurer: 'Medicare', memberId: 'MED-1120394', copayCents: 2000, status: 'no-show', checkInTime: null },
  { id: 'a6', firstName: 'Grace', lastName: 'Bauer', dob: '1989-07-08', gender: 'Female', timeLabel: '11:30 AM', provider: 'Dr. Alice Nguyen', location: 'Main Clinic', type: 'Lab review', phone: '(555) 330-8821', address: '12 Elm Way, Springfield', insurer: 'BlueCross BlueShield', memberId: 'BCBS-7781234', copayCents: 1500, status: 'scheduled', checkInTime: null },
  { id: 'a7', firstName: 'Diego', lastName: 'Salas', dob: '1974-12-19', gender: 'Male', timeLabel: '1:00 PM', provider: 'Dr. Priya Rao', location: 'Pediatrics', type: 'Follow-up', phone: '(555) 556-2093', address: '88 Willow Rd, Springfield', insurer: 'Aetna', memberId: 'AET-2240117', copayCents: 2500, status: 'scheduled', checkInTime: null },
  { id: 'a8', firstName: 'Hana', lastName: 'Kim', dob: '1996-03-27', gender: 'Female', timeLabel: '1:30 PM', provider: 'Dr. Marcus Bell', location: 'Cardiology Suite', type: 'Telehealth', phone: '(555) 771-6650', address: '260 Aspen Dr, Springfield', insurer: 'UnitedHealthcare', memberId: 'UHC-6653321', copayCents: 0, status: 'scheduled', checkInTime: null },
]);

function isoAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function findAppointment(lastName: string, dob: string): Appointment | undefined {
  const ln = lastName.trim().toLowerCase();
  return appointments.find((a) => a.lastName.toLowerCase() === ln && a.dob === dob);
}

export function checkIn(id: string): void {
  const a = appointments.find((x) => x.id === id);
  if (a) {
    a.status = 'checked-in';
    a.checkInTime = new Date().toISOString();
  }
}

export function setStatus(id: string, status: CheckStatus): void {
  const a = appointments.find((x) => x.id === id);
  if (a) a.status = status;
}

export function formatDob(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
export function statusLabel(s: CheckStatus): string {
  return s.replace('-', ' ');
}
