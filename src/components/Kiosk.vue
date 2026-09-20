<script setup lang="ts">
import { computed, ref, onBeforeUnmount, watch } from "vue";
import { HeartPulse, CheckCircle2, ArrowLeft } from "@lucide/vue";
import { workspace, execute, run } from "../workspace";
import { patient, timeLabel, dateLabel, providers } from "../../shared/domain";
import KioskHelp from "./KioskHelp.vue";
import type { KioskQuestion } from "../../shared/kiosk";
import { clinicSources } from "../../shared/patient";
const helpTopic = ref("paperwork");
defineEmits<{ exit: [] }>();
const visitId = ref(crypto.randomUUID()),
  issue = ref<KioskQuestion["issue"]>("none"),
  lastActivity = ref(Date.now()),
  idleSeconds = ref(0);
const step = ref<KioskQuestion["step"]>("welcome"),
  name = ref(""),
  dob = ref(""),
  error = ref(""),
  checked = ref(false),
  id = ref("");
const appointment = computed(() =>
  workspace.data.appointments.find((a) => a.id === id.value),
);
const example = computed(() =>
  workspace.data.appointments.find(
    (a) => a.date === workspace.data.day && a.status === "scheduled",
  ),
);
const person = computed(() =>
  appointment.value
    ? patient(workspace.data, appointment.value.patientId)
    : null,
);
function find() {
  error.value = "";
  if (!name.value.trim()) {
    issue.value = "missing-last-name";
    error.value = "Enter the fictional patient’s last name in the form.";
    return;
  }
  if (!dob.value) {
    issue.value = "missing-dob";
    error.value = "Choose the fictional patient’s date of birth in the form.";
    return;
  }
  const p = workspace.data.patients.find(
    (p) =>
      p.name.split(" ").at(-1)?.toLowerCase() ===
        name.value.trim().toLowerCase() && p.dob === dob.value,
  );
  const matches = workspace.data.appointments
    .filter(
      (a) =>
        a.patientId === p?.id &&
        a.date === workspace.data.day &&
        a.status === "scheduled",
    )
    .sort((a, b) => a.start - b.start);
  if (!matches.length) {
    issue.value = "not-found";
    error.value =
      "No scheduled appointment found for that name and birth date on the demo day. Please ask the front desk.";
    return;
  }
  id.value = matches[0].id;
  step.value = "confirm";
  issue.value = "confirmation-needed";
}
function start() {
  visitId.value = crypto.randomUUID();
  issue.value = "none";
  lastActivity.value = Date.now();
  workspace.error = "";
  step.value = "welcome";
  name.value = "";
  dob.value = "";
  id.value = "";
  checked.value = false;
  error.value = "";
}
function useExample() {
  const p = example.value && patient(workspace.data, example.value.patientId);
  if (p) {
    name.value = p.name.split(" ").at(-1)!;
    dob.value = p.dob;
  }
}
watch(checked, (v) => {
  if (step.value === "confirm")
    issue.value = v ? "none" : "confirmation-needed";
});
watch(step, () => {
  lastActivity.value = Date.now();
});
const idleTimer = setInterval(() => {
  idleSeconds.value = Math.floor((Date.now() - lastActivity.value) / 1000);
  if (
    (step.value === "done" && idleSeconds.value >= 20) ||
    idleSeconds.value >= 90
  )
    start();
}, 1000);
onBeforeUnmount(() => clearInterval(idleTimer));
async function confirmCheckIn() {
  await run(async () => {
    await execute({
      type: "status",
      id: id.value,
      status: "checked-in",
      source: "kiosk",
    });
    step.value = "done";
    name.value = "";
    dob.value = "";
    id.value = "";
    checked.value = false;
    issue.value = "none";
  });
  if (workspace.error) issue.value = "save-failed";
}
</script>
<template>
  <section
    class="kiosk"
    @pointerdown="lastActivity = Date.now()"
    @keydown="lastActivity = Date.now()"
    @input="lastActivity = Date.now()"
  >
    <div class="row-between">
      <button class="text-button" @click="$emit('exit')">
        <ArrowLeft :size="16" />Back to front desk</button
      ><span class="badge">SIMULATED KIOSK</span>
    </div>
    <div class="kiosk-card">
      <span class="kiosk-symbol"><HeartPulse :size="32" /></span>
      <p class="eyebrow">WILLOW FAMILY CARE</p>
      <template v-if="step === 'welcome'"
        ><h1>A warmer welcome.</h1>
        <p>
          Let us know you're here. Check in for your fictional appointment in a
          few simple steps.
        </p>
        <div class="callout">
          Demo day: {{ dateLabel(workspace.data.day) }}<br />Use only the
          fictional patient details in this demo.
        </div>
        <button
          class="button primary full"
          @click="
            step = 'find';
            issue = 'none';
          "
        >
          Start check-in
        </button></template
      >
      <form v-else-if="step === 'find'" @submit.prevent="find" novalidate>
        <h1>Let's find your visit.</h1>
        <p>Enter your last name and date of birth.</p>
        <label
          >Last name<input v-model="name" required autocomplete="off" /></label
        ><label
          >Date of birth<input v-model="dob" type="date" required
        /></label>
        <div v-if="example" class="inset small">
          <strong>Try a fictional patient</strong>
          <p>
            {{ patient(workspace.data, example.patientId)?.name }} ·
            {{ patient(workspace.data, example.patientId)?.dob }}
          </p>
          <button type="button" class="text-button" @click="useExample">
            Use these demo details
          </button>
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="button primary full">Find appointment</button
        ><button type="button" class="text-button full" @click="start">
          Start over
        </button>
      </form>
      <template v-else-if="step === 'confirm' && appointment"
        ><h1>Hi, {{ person?.name.split(" ")[0] }}.</h1>
        <p>Please check your appointment details.</p>
        <div class="kiosk-appointment">
          <strong>{{ person?.name }}</strong>
          <h2>
            {{ dateLabel(appointment.date) }} ·
            {{ timeLabel(appointment.start) }}
          </h2>
          <p>
            {{ providers.find((p) => p.id === appointment?.providerId)?.name }}
          </p>
          <span class="badge">{{ appointment.type }} · Main clinic</span>
        </div>
        <label class="checkbox"
          ><input v-model="checked" type="checkbox" />These are the fictional
          appointment details I want to check in.</label
        ><button
          class="button primary full"
          :disabled="!checked || workspace.busy"
          @click="confirmCheckIn"
        >
          Confirm check-in</button
        ><button class="text-button full" @click="start">
          Start over
        </button></template
      ><template v-else-if="step === 'done'"
        ><CheckCircle2 class="success-icon" :size="48" />
        <h1>You're checked in.</h1>
        <p>
          The front desk schedule has been updated. In a real clinic, you'd take
          a seat while your care team gets ready.
        </p>
        <button class="button primary full" @click="$emit('exit')">
          See the updated schedule</button
        ><button class="text-button full" @click="start">
          Start another check-in
        </button></template
      >
      <p v-if="step === 'done'" class="small muted">
        This kiosk clears automatically after 20 seconds without activity.
      </p>
      <div v-else-if="idleSeconds >= 60" class="callout" role="status">
        For privacy, this check-in clears in
        {{ 90 - idleSeconds }} seconds.<button
          class="text-button full"
          @click="lastActivity = Date.now()"
        >
          I'm still here
        </button>
      </div>
      <KioskHelp
        :key="visitId"
        :step="step"
        :issue="issue"
        :visit-id="visitId"
      />
      <details class="kiosk-help">
        <summary>Need help with your visit?</summary>
        <div class="guide-topics">
          <button
            v-for="s in clinicSources"
            :key="s.id"
            :class="{ active: helpTopic === s.id }"
            @click="helpTopic = s.id"
          >
            {{ s.section }}
          </button>
        </div>
        <article
          v-for="s in clinicSources.filter((s) => s.id === helpTopic)"
          :key="s.id"
          class="clinic-source"
        >
          <span class="source-label">Approved clinic guide</span>
          <h3>{{ s.section }}</h3>
          <p>{{ s.body }}</p>
          <small>Source: {{ s.title }} · Reviewed {{ s.reviewed }}</small>
        </article>
      </details>
      <p class="small muted kiosk-disclaimer">
        Demonstration only. This kiosk shares the staff demo session and is not
        a patient authentication system.
      </p>
    </div>
  </section>
</template>
