<script setup lang="ts">
import { computed, ref, watch } from "vue";
const liveDemoUrl = import.meta.env.VITE_LIVE_DEMO_URL as string | undefined;
import {
  CalendarDays,
  Users,
  Activity,
  Monitor,
  KeyRound,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Columns3,
  Sparkles,
  RotateCcw,
  Download,
  X,
  HeartPulse,
  Menu,
} from "@lucide/vue";
import {
  workspace,
  request,
  run,
  execute,
  connect,
  disconnect,
  refresh,
} from "./workspace";
import {
  day,
  providers,
  patient,
  dateLabel,
  timeLabel,
  duration,
  shift,
  visitTypes,
  type Appointment,
} from "../shared/domain";
import Dialog from "./components/Dialog.vue";
import BookingForm from "./components/BookingForm.vue";
import AppointmentDetail from "./components/AppointmentDetail.vue";
import Assistant from "./components/Assistant.vue";
import HelpInbox from "./components/HelpInbox.vue";
import Kiosk from "./components/Kiosk.vue";
import PatientPortal from "./components/PatientPortal.vue";
const isPatientPortal = new URLSearchParams(location.search).has("patient");
const patientInvite = ref("");
async function createPatientInvite(patientId: string) {
  await run(async () => {
    const result = await request("patient-invites", { patientId });
    patientInvite.value =
      location.origin +
      import.meta.env.BASE_URL +
      "?patient=1#invite=" +
      result.invite;
  });
}
const page = ref("schedule"),
  date = ref(workspace.data.day),
  search = ref(""),
  provider = ref(""),
  status = ref(""),
  view = ref("list"),
  copilot = ref(true),
  menu = ref(false);
const access = ref(false),
  key = ref(""),
  reset = ref(false),
  booking = ref(false),
  editing = ref<Appointment>(),
  bookingPatient = ref(""),
  selected = ref(""),
  assistantSelected = ref(""),
  epoch = ref(0);
const selectedAppointment = computed(() =>
  workspace.data.appointments.find((a) => a.id === selected.value),
);
const dates = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    shift(
      date.value,
      -((new Date(date.value + "T12:00:00Z").getUTCDay() + 6) % 7) + i,
    ),
  ),
);
const dayAppointments = computed(() =>
  workspace.data.appointments.filter((a) => a.date === date.value),
);
const filtered = computed(() =>
  dayAppointments.value
    .filter(
      (a) =>
        (!search.value ||
          patient(workspace.data, a.patientId)
            ?.name.toLowerCase()
            .includes(search.value.toLowerCase())) &&
        (!provider.value || a.providerId === provider.value) &&
        (!status.value || a.status === status.value),
    )
    .sort(
      (a, b) => a.start - b.start || a.providerId.localeCompare(b.providerId),
    ),
);
const people = computed(() =>
  workspace.data.patients.filter((p) =>
    (p.name + " " + p.id).toLowerCase().includes(search.value.toLowerCase()),
  ),
);
const events = computed(() =>
  workspace.data.appointments
    .flatMap((a) =>
      a.events.map((e, i) => ({ ...e, key: a.id + i, appointment: a })),
    )
    .sort((a, b) => b.at.localeCompare(a.at)),
);
const stats = computed(() => [
  {
    label: "Appointments",
    value: dayAppointments.value.filter(
      (a) => !["cancelled", "no-show"].includes(a.status),
    ).length,
    note: "On the schedule",
    color: "blue",
  },
  {
    label: "Waiting",
    value: dayAppointments.value.filter((a) => a.status === "checked-in")
      .length,
    note: "Checked in & ready",
    color: "amber",
  },
  {
    label: "With a provider",
    value: dayAppointments.value.filter((a) => a.status === "roomed").length,
    note: "Visits in progress",
    color: "purple",
  },
  {
    label: "Completed",
    value: dayAppointments.value.filter((a) => a.status === "completed").length,
    note: "Care, delivered",
    color: "teal",
  },
]);
watch(page, () => {
  search.value = "";
  menu.value = false;
  workspace.error = "";
});
function book(p = "") {
  editing.value = undefined;
  bookingPatient.value = p;
  booking.value = true;
}
function reschedule(a: Appointment) {
  selected.value = "";
  editing.value = a;
  booking.value = true;
}
function assist(a: Appointment) {
  selected.value = "";
  assistantSelected.value = a.id;
  copilot.value = true;
  page.value = "schedule";
}
async function unlock() {
  await run(async () => {
    await connect(key.value.trim());
    date.value = workspace.data.day;
    key.value = "";
    access.value = false;
    epoch.value++;
    workspace.notice = "Connected. Your private demo session is ready.";
  });
}
function setDate(event: Event) {
  const input = event.target as HTMLInputElement;
  const result = day.safeParse(input.value);
  if (result.success) date.value = result.data;
  else input.value = date.value;
}
function exportCsv() {
  const rows = [
    ["Patient", "Date", "Time", "Provider", "Visit", "Status"],
    ...filtered.value.map((a) => [
      patient(workspace.data, a.patientId)?.name || "",
      a.date,
      timeLabel(a.start),
      providers.find((p) => p.id === a.providerId)!.name,
      a.type,
      a.status,
    ]),
  ];
  const csv = rows
    .map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `clera-${date.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const basePath = import.meta.env.BASE_URL;
</script>
<template>
  <PatientPortal v-if="isPatientPortal" />
  <div v-else class="app-shell">
    <aside class="sidebar" :class="{ open: menu }">
      <a class="brand" href="#" @click.prevent="page = 'schedule'"
        ><span class="brand-icon"><HeartPulse :size="24" /></span>clera<span
          class="brand-dot"
          >.</span
        ></a
      >
      <p class="workspace-label">WORKSPACE</p>
      <div class="clinic-switch">
        <span class="clinic-avatar">W</span>
        <div><strong>Willow Family Care</strong><small>Demo clinic</small></div>
        <span class="online-dot" />
      </div>
      <nav aria-label="Main navigation">
        <button
          v-for="item in [
            { id: 'schedule', label: 'Schedule', icon: CalendarDays },
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'activity', label: 'Activity', icon: Activity },
            { id: 'kiosk', label: 'Patient kiosk', icon: Monitor },
          ]"
          :key="item.id"
          :class="{ active: page === item.id }"
          @click="page = item.id"
        >
          <component :is="item.icon" :size="19" />{{ item.label }}
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="demo-card">
          <span class="badge">PORTFOLIO DEMO</span
          ><strong>A little less admin.<br />More room for care.</strong>
          <p>Explore a fictional clinic with a complete scheduling workflow.</p>
          <button class="text-button" @click="reset = true">
            <RotateCcw :size="14" />Reset my session
          </button>
        </div>
        <button class="profile" @click="access = true">
          <span class="avatar">SG</span
          ><span
            ><strong>Front desk</strong
            ><small>{{
              workspace.mode === "live"
                ? "Private demo session"
                : "Sample workspace"
            }}</small></span
          ><KeyRound :size="16" />
        </button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="icon-button mobile-menu"
            aria-label="Toggle navigation"
            @click="menu = !menu"
          >
            <Menu :size="20" /></button
          ><span>Workspace</span><span>/</span
          ><strong>{{
            page === "schedule"
              ? "Schedule"
              : page === "patients"
                ? "Patients"
                : page === "activity"
                  ? "Activity"
                  : "Patient kiosk"
          }}</strong>
        </div>
        <div class="topbar-actions">
          <span class="connection"
            ><i :class="{ live: workspace.mode === 'live' }" />{{
              workspace.mode === "live" ? "Live demo" : "Interactive sample"
            }}</span
          ><button
            class="icon-button"
            aria-label="Demo access"
            title="Demo access"
            @click="access = true"
          >
            <KeyRound :size="18" /></button
          ><span class="avatar small-avatar">SG</span>
        </div>
      </header>
      <main>
        <div v-if="workspace.notice" class="notice" role="status">
          {{ workspace.notice
          }}<button
            class="icon-button"
            aria-label="Dismiss notice"
            @click="workspace.notice = ''"
          >
            <X :size="15" />
          </button>
        </div>
        <p v-if="workspace.error && !access" class="error" role="alert">
          {{ workspace.error }}
        </p>
        <template v-if="page === 'schedule'"
          ><div class="page-heading">
            <div>
              <div class="eyebrow">FRONT DESK, IN SYNC</div>
              <h1>Keep the day moving<span>.</span></h1>
              <p>A clear view of every appointment and every next step.</p>
            </div>
            <div class="heading-actions">
              <button
                class="button secondary"
                :class="{ pressed: copilot }"
                @click="copilot = !copilot"
              >
                <Sparkles :size="17" />Copilot</button
              ><button
                class="button primary"
                :disabled="workspace.busy"
                @click="book()"
              >
                <Plus :size="18" />Book appointment
              </button>
            </div>
          </div>
          <HelpInbox />
          <section class="stats" aria-label="Day overview">
            <article v-for="s in stats" :key="s.label">
              <div class="row-between">
                <span>{{ s.label }}</span
                ><span class="metric-dot" :class="s.color" />
              </div>
              <strong>{{ String(s.value).padStart(2, "0") }}</strong
              ><small>{{ s.note }}</small>
            </article>
          </section>
          <div class="schedule-layout" :class="{ withAssistant: copilot }">
            <section class="schedule-panel">
              <div class="calendar-header">
                <div>
                  <h2>
                    {{
                      new Date(date + "T12:00:00Z").toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric", timeZone: "UTC" },
                      )
                    }}
                  </h2>
                  <p class="small muted">
                    Eastern time ·
                    {{
                      date === workspace.data.day ? "Demo day" : dateLabel(date)
                    }}
                  </p>
                </div>
                <div class="date-controls">
                  <button
                    class="icon-button"
                    aria-label="Previous day"
                    @click="date = shift(date, -1)"
                  >
                    <ChevronLeft :size="18" /></button
                  ><button
                    class="button secondary compact"
                    @click="date = workspace.data.day"
                  >
                    Demo day</button
                  ><button
                    class="icon-button"
                    aria-label="Next day"
                    @click="date = shift(date, 1)"
                  >
                    <ChevronRight :size="18" /></button
                  ><input
                    :value="date"
                    aria-label="Schedule date"
                    type="date"
                    required
                    @change="setDate"
                  />
                </div>
              </div>
              <div class="week-strip">
                <button
                  v-for="d in dates"
                  :key="d"
                  :class="{
                    selected: d === date,
                    weekend: [0, 6].includes(
                      new Date(d + 'T12:00:00Z').getUTCDay(),
                    ),
                  }"
                  @click="date = d"
                >
                  <span>{{
                    new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone: "UTC",
                    })
                  }}</span
                  ><strong>{{ Number(d.slice(-2)) }}</strong
                  ><i
                    v-if="workspace.data.appointments.some((a) => a.date === d)"
                  />
                </button>
              </div>
              <div class="schedule-toolbar">
                <div class="search-field">
                  <Search :size="16" /><input
                    v-model="search"
                    aria-label="Search appointments"
                    placeholder="Find a patient…"
                  />
                </div>
                <select v-model="provider" aria-label="Filter provider">
                  <option value="">All providers</option>
                  <option v-for="p in providers" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option></select
                ><select v-model="status" aria-label="Filter status">
                  <option value="">All statuses</option>
                  <option
                    v-for="s in [
                      'scheduled',
                      'checked-in',
                      'roomed',
                      'completed',
                      'cancelled',
                      'no-show',
                    ]"
                    :key="s"
                  >
                    {{ s }}
                  </option></select
                ><button
                  v-if="workspace.mode === 'live'"
                  class="icon-button"
                  aria-label="Refresh schedule"
                  :disabled="workspace.busy"
                  @click="run(refresh)"
                >
                  <RotateCcw :size="15" />
                </button>
                <div class="view-toggle">
                  <button
                    class="icon-button"
                    :class="{ active: view === 'list' }"
                    aria-label="List view"
                    @click="view = 'list'"
                  >
                    <LayoutList :size="17" /></button
                  ><button
                    class="icon-button"
                    :class="{ active: view === 'calendar' }"
                    aria-label="Provider calendar"
                    @click="view = 'calendar'"
                  >
                    <Columns3 :size="17" />
                  </button>
                </div>
              </div>
              <div v-if="!filtered.length" class="empty">
                <CalendarDays :size="32" />
                <h3>No appointments here.</h3>
                <p>Try another day or filter, or book a new appointment.</p>
                <button class="button secondary" @click="book()">
                  Book appointment
                </button>
              </div>
              <div v-else-if="view === 'list'" class="appointment-list">
                <div class="list-header">
                  <span>TIME</span><span>PATIENT / VISIT</span
                  ><span>PROVIDER</span><span>STATUS</span><span />
                </div>
                <button
                  v-for="a in filtered"
                  :key="a.id"
                  class="appointment-row"
                  @click="selected = a.id"
                >
                  <div class="appointment-time">
                    <strong>{{ timeLabel(a.start).split(" ")[0] }}</strong
                    ><small
                      >{{ timeLabel(a.start).split(" ")[1] }} ·
                      {{ duration(a.type) }}m</small
                    >
                  </div>
                  <div class="patient-cell">
                    <span
                      class="patient-avatar"
                      :class="
                        providers.find((p) => p.id === a.providerId)?.color
                      "
                      >{{
                        patient(workspace.data, a.patientId)
                          ?.name.split(" ")
                          .map((n) => n[0])
                          .join("")
                      }}</span
                    ><span
                      ><strong>{{
                        patient(workspace.data, a.patientId)?.name
                      }}</strong
                      ><small>{{
                        visitTypes.find((t) => t.id === a.type)?.name
                      }}</small></span
                    >
                  </div>
                  <span class="provider-cell">{{
                    providers.find((p) => p.id === a.providerId)?.name
                  }}</span
                  ><span class="status" :data-status="a.status">{{
                    a.status.replace("-", " ")
                  }}</span
                  ><ChevronRight class="row-arrow" :size="16" />
                </button>
              </div>
              <div v-else class="calendar-scroll">
                <div class="provider-calendar">
                  <div class="calendar-times">
                    <div class="provider-heading">ET</div>
                    <div v-for="h in 8" :key="h" class="hour-label">
                      {{ timeLabel((h + 8) * 60) }}
                    </div>
                  </div>
                  <div
                    v-for="p in providers.filter(
                      (p) => !provider || p.id === provider,
                    )"
                    :key="p.id"
                    class="provider-lane"
                  >
                    <div class="provider-heading">
                      <span class="patient-avatar" :class="p.color">{{
                        p.initials
                      }}</span
                      ><strong>{{ p.name.replace("Dr. ", "") }}</strong>
                    </div>
                    <div class="day-track">
                      <div v-for="h in 8" :key="h" class="hour-line" />
                      <div class="lunch">Lunch break</div>
                      <button
                        v-for="a in filtered.filter(
                          (a) =>
                            a.providerId === p.id &&
                            !['cancelled', 'no-show'].includes(a.status),
                        )"
                        :key="a.id"
                        class="calendar-appointment"
                        :class="p.color"
                        :style="{
                          top: (a.start - 540) * 1.8 + 'px',
                          height: duration(a.type) * 1.8 - 3 + 'px',
                        }"
                        @click="selected = a.id"
                      >
                        <strong>{{
                          patient(workspace.data, a.patientId)?.name
                        }}</strong
                        ><small
                          >{{ timeLabel(a.start) }} ·
                          {{ a.status.replace("-", " ") }}</small
                        >
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <footer class="panel-footer">
                <span
                  >{{ filtered.length }} appointments · Fictional patients</span
                ><button class="text-button" @click="exportCsv">
                  <Download :size="14" />Export
                </button>
              </footer>
            </section>
            <Assistant
              v-if="copilot"
              :key="workspace.mode + assistantSelected + epoch"
              :date="date"
              :selected-id="assistantSelected || undefined"
            /></div
        ></template>
        <template v-else-if="page === 'patients'"
          ><div class="page-heading">
            <div>
              <div class="eyebrow">PEOPLE, BEFORE PAPERWORK</div>
              <h1>Your patient directory<span>.</span></h1>
              <p>
                Fictional patients, ready for your next scheduling walkthrough.
              </p>
            </div>
            <div class="search-field">
              <Search :size="17" /><input
                v-model="search"
                aria-label="Search patients"
                placeholder="Find a patient…"
              />
            </div>
          </div>
          <div class="patient-grid">
            <article v-for="p in people" :key="p.id" class="patient-card">
              <span class="patient-avatar blue">{{
                p.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
              }}</span>
              <h2>{{ p.name }}</h2>
              <p class="small muted">DEMO ID · {{ p.id.toUpperCase() }}</p>
              <dl>
                <dt>Date of birth</dt>
                <dd>{{ p.dob }}</dd>
                <dt>Phone</dt>
                <dd>{{ p.phone }}</dd>
                <dt>Appointments</dt>
                <dd>
                  {{
                    workspace.data.appointments.filter(
                      (a) => a.patientId === p.id,
                    ).length
                  }}
                </dd>
              </dl>
              <button class="button secondary full" @click="book(p.id)">
                Book appointment</button
              ><button
                v-if="workspace.mode === 'live'"
                class="text-button full"
                :disabled="workspace.busy"
                @click="createPatientInvite(p.id)"
              >
                Create patient invitation</button
              ><a
                v-else
                class="text-button full"
                :href="`${basePath}?patient=1`"
                target="_blank"
                rel="noopener"
                >Explore patient portal sample</a
              >
            </article>
          </div>
          <p v-if="!people.length" class="empty">
            No patients match your search.
          </p></template
        >
        <template v-else-if="page === 'activity'"
          ><div class="page-heading">
            <div>
              <div class="eyebrow">EVERY STEP, ACCOUNTED FOR</div>
              <h1>The story of your day<span>.</span></h1>
              <p>
                Appointment changes and simulated visit activity in this
                session.
              </p>
            </div>
            <button
              v-if="workspace.mode === 'live'"
              class="button secondary"
              @click="run(refresh)"
            >
              Refresh
            </button>
          </div>
          <section class="activity-panel">
            <button
              v-for="e in events"
              :key="e.key"
              class="activity-row"
              @click="selected = e.appointment.id"
            >
              <span class="activity-icon"><Activity :size="17" /></span
              ><span
                ><strong>{{
                  patient(workspace.data, e.appointment.patientId)?.name
                }}</strong
                ><span>{{ e.label }}</span></span
              ><time
                >{{
                  new Date(e.at).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                }}
                ET</time
              ><ChevronRight :size="17" />
            </button></section
        ></template>
        <Kiosk v-else @exit="page = 'schedule'" />
        <footer class="app-footer">
          <span
            ><HeartPulse :size="14" />Clera · Thoughtful clinic operations</span
          ><span
            >Simulated care workflow. No clinical advice or real
            notifications.</span
          >
        </footer>
      </main>
    </div>
    <AppointmentDetail
      v-if="selectedAppointment"
      :appointment="selectedAppointment"
      @close="selected = ''"
      @reschedule="reschedule"
      @assist="assist"
    />
    <BookingForm
      v-if="booking"
      :date="date"
      :appointment="editing"
      :patient-id="bookingPatient"
      @close="booking = false"
      @saved="booking = false"
    />
    <Dialog
      v-if="patientInvite"
      title="Patient invitation ready"
      @close="patientInvite = ''"
    >
      <p>
        This single-use link opens the selected fictional patient's portal. It
        expires in 10 minutes and grants 30 minutes of patient access.
      </p>
      <p class="small muted">
        Anyone with this link can act as that demo patient. The staff access key
        is not included.
      </p>
      <a
        class="button primary full"
        :href="patientInvite"
        target="_blank"
        rel="noopener noreferrer"
        >Open patient portal</a
      >
    </Dialog>
    <Dialog
      v-if="access"
      title="Connect your demo session"
      @close="access = false"
      ><p class="muted">
        A demo access key connects to the backend and enables real AI tool
        calls. Your OpenAI API key belongs on the server, never in this form.
      </p>
      <div v-if="liveDemoUrl" class="callout">
        <p>
          This page is the browser-only sample. Open the hosted demo to use your
          invitation key and live AI.
        </p>
        <a class="button primary full" :href="liveDemoUrl"
          >Open live Clera demo</a
        >
      </div>
      <form v-else-if="workspace.mode === 'sample'" @submit.prevent="unlock">
        <label
          >Demo access key<input
            v-model="key"
            type="password"
            autocomplete="off"
            required
            placeholder="Enter your Clera demo key"
        /></label>
        <p class="small muted">
          The key stays in memory. Your browser's private session lasts up to 24
          hours. All data is fictional.
        </p>
        <p v-if="workspace.error" class="error" role="alert">
          {{ workspace.error }}
        </p>
        <button class="button primary full" :disabled="workspace.busy">
          Connect live demo
        </button>
      </form>
      <template v-else
        ><p class="callout">Connected to your private demo workspace.</p>
        <button
          class="button secondary full"
          @click="
            disconnect();
            access = false;
            date = workspace.data.day;
            epoch++;
          "
        >
          Return to sample
        </button></template
      ></Dialog
    >
    <Dialog v-if="reset" title="Start a fresh demo?" @close="reset = false"
      ><p>
        This replaces appointments and removes saved proposals in your session
        with the original fictional clinic day.
      </p>
      <footer class="dialog-actions">
        <button class="button secondary" @click="reset = false">
          Keep my work</button
        ><button
          class="button primary"
          :disabled="workspace.busy"
          @click="
            run(async () => {
              await execute({ type: 'reset' });
              reset = false;
              menu = false;
              selected = '';
              assistantSelected = '';
              epoch++;
              date = workspace.data.day;
              workspace.notice = 'Fresh demo ready.';
            })
          "
        >
          Reset session
        </button>
      </footer></Dialog
    >
  </div>
</template>
