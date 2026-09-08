import { reactive } from 'vue';

export interface Appointment {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  timeLabel: string;
  provider: string;
  type: string;
  phone: string;
  address: string;
  insurer: string;
  memberId: string;
  checkedIn: boolean;
}

// Today's appointments a patient can check in against (sample data only).
export const appointments = reactive<Appointment[]>([
  { id: 'a1', firstName: 'Jordan', lastName: 'Avery', dob: '1985-04-12', timeLabel: '9:00 AM', provider: 'Dr. Alice Nguyen', type: 'Follow-up', phone: '(555) 201-4412', address: '118 Maple St, Springfield', insurer: 'BlueCross BlueShield', memberId: 'BCBS-4471902', checkedIn: false },
  { id: 'a2', firstName: 'Sofia', lastName: 'Marin', dob: '1992-11-03', timeLabel: '9:30 AM', provider: 'Dr. Alice Nguyen', type: 'Annual physical', phone: '(555) 288-1190', address: '42 Cedar Ave, Springfield', insurer: 'Aetna', memberId: 'AET-5563008', checkedIn: false },
  { id: 'a3', firstName: 'Wes', lastName: 'Okafor', dob: '1978-06-21', timeLabel: '10:00 AM', provider: 'Dr. Marcus Bell', type: 'Cardiology consult', phone: '(555) 419-7723', address: '9 Birch Ln, Springfield', insurer: 'UnitedHealthcare', memberId: 'UHC-9902141', checkedIn: false },
  { id: 'a4', firstName: 'Lena', lastName: 'Petrova', dob: '2001-02-15', timeLabel: '10:30 AM', provider: 'Dr. Priya Rao', type: 'New patient', phone: '(555) 662-3308', address: '305 Oak Blvd, Springfield', insurer: 'Cigna', memberId: 'CIG-3341887', checkedIn: false },
  { id: 'a5', firstName: 'Caleb', lastName: 'Ross', dob: '1966-09-30', timeLabel: '11:00 AM', provider: 'Dr. Marcus Bell', type: 'Follow-up', phone: '(555) 774-9021', address: '77 Pine Ct, Springfield', insurer: 'Medicare', memberId: 'MED-1120394', checkedIn: false },
]);

export function findAppointment(lastName: string, dob: string): Appointment | undefined {
  const ln = lastName.trim().toLowerCase();
  return appointments.find((a) => a.lastName.toLowerCase() === ln && a.dob === dob);
}

export function checkIn(id: string): void {
  const a = appointments.find((x) => x.id === id);
  if (a) a.checkedIn = true;
}

export function formatDob(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
