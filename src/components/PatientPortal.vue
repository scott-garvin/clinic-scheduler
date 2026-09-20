<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from "vue";
import {
  HeartPulse,
  ShieldCheck,
  CalendarDays,
  ArrowUpRight,
  Sparkles,
  BookOpen,
  LogOut,
  Check,
  RefreshCw,
} from "@lucide/vue";
import {
  seed,
  providers,
  visitTypes,
  timeLabel,
  dateLabel,
  slots,
  apply,
  type Workspace,
} from "../../shared/domain";
import {
  patientView,
  bindPatientChange,
  assertPatientChange,
  clinicSources,
  retrieveClinic,
  type PatientView,
  type PatientAnswer,
} from "../../shared/patient";
import type { Proposal } from "../../shared/assistant";
const sampleId = "p6";
let sample: Workspace = seed();
const data = ref<PatientView | null>(null),
  live = ref(false),
  busy = ref(false),
  error = ref(""),
  notice = ref(""),
  sessionTag = ref(""),
  expires = ref("");
const selectedId = ref(""),
  message = ref(""),
  answer = ref<PatientAnswer | null>(null),
  proposal = ref<Proposal | null>(null),
  saved = ref<Proposal[]>([]),
  reviewed = ref(false),
  guide = ref("parking");
const form = reactive({
  mode: "reschedule" as "reschedule" | "book" | "cancel",
  providerId: "cohen",
  date: "",
  type: "follow-up",
  start: -1,
});
const starts = ref<number[]>([]);
const checkingIn = ref(false),
  checkinConfirmed = ref(false);
function clearPrivateView() {
  data.value = null;
  live.value = false;
  sessionTag.value = "";
  expires.value = "";
  answer.value = null;
  proposal.value = null;
  saved.value = [];
  message.value = "";
  selectedId.value = "";
  reviewed.value = false;
  checkingIn.value = false;
  checkinConfirmed.value = false;
  starts.value = [];
  form.mode = "reschedule";
  form.date = "";
  form.start = -1;
  form.providerId = "cohen";
  form.type = "follow-up";
}
const expiryTimer = setInterval(() => {
  if (
    live.value &&
    expires.value &&
    Date.now() >= new Date(expires.value).getTime()
  ) {
    clearPrivateView();
    error.value = "Your patient session expired. Open a fresh invitation.";
  }
}, 5000);
onBeforeUnmount(() => clearInterval(expiryTimer));
const selected = computed(() =>
  data.value?.appointments.find((a) => a.id === selectedId.value),
);
const currentSource = computed(() =>
  clinicSources.find((s) => s.id === guide.value)!,
);
const after = computed(() => {
  const c = proposal.value?.change;
  return c?.type === "book" ? c.booking : c?.type === "reschedule" ? c : null;
});
const before = computed(() => {
  const c = proposal.value?.change;
  return c && c.type !== "book"
    ? data.value?.appointments.find((a) => a.id === c.id)
    : null;
});
async function api(path: string, body?: unknown) {
  const r = await fetch(`${import.meta.env.BASE_URL}api/patient/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Portal-Session": sessionTag.value,
    },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(130000),
  });
  let json;
  try {
    json = await r.json();
  } catch {
    throw new Error(
      "The live patient portal is unavailable here. Try the fictional sample.",
    );
  }
  if (!r.ok) {
    if (r.status === 401) {
      clearPrivateView();
    }
    throw new Error(json.error || "Please try again.");
  }
  return json;
}
async function run(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await action();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Please try again.";
  } finally {
    busy.value = false;
  }
}
function setData(w: PatientView) {
  data.value = w;
  if (
    !selectedId.value ||
    !w.appointments.some((a) => a.id === selectedId.value)
  )
    selectedId.value =
      w.appointments.find((a) => a.status === "scheduled")?.id || "";
  form.date = form.date || w.day;
}
function choose(id: string) {
  checkingIn.value = false;
  checkinConfirmed.value = false;
  selectedId.value = id;
  form.mode = "reschedule";
  if (selected.value) {
    form.providerId = selected.value.providerId;
    form.date = selected.value.date;
    form.type = selected.value.type;
  }
  starts.value = [];
  form.start = -1;
}
async function reload() {
  if (live.value) {
    const d = await api("session");
    if (sessionTag.value && d.sessionTag !== sessionTag.value) {
      clearPrivateView();
      throw new Error("The patient session changed. Reopen the portal.");
    }
    sessionTag.value = d.sessionTag;
    expires.value = d.expiresAt;
    setData(d);
    saved.value = await api("proposals");
  } else setData(patientView(sample, sampleId));
}
function startSample() {
  clearPrivateView();
  live.value = false;
  sessionTag.value = "";
  sample = seed();
  proposal.value = null;
  answer.value = null;
  saved.value = [];
  selectedId.value = "";
  error.value = "";
  setData(patientView(sample, sampleId));
  choose(selectedId.value);
}
onMounted(async () => {
  const invite = new URLSearchParams(location.hash.slice(1)).get("invite");
  if (invite)
    history.replaceState(null, "", location.pathname + location.search);
  await run(async () => {
    if (invite) {
      await api("redeem", { invite });
      live.value = true;
      await reload();
      choose(selectedId.value);
    } else {
      try {
        const r = await fetch(
          `${import.meta.env.BASE_URL}api/patient/session`,
          { credentials: "same-origin" },
        );
        if (r.ok) {
          const d = await r.json();
          live.value = true;
          sessionTag.value = d.sessionTag;
          expires.value = d.expiresAt;
          setData(d);
          saved.value = await api("proposals");
          choose(selectedId.value);
        }
      } catch {
        /* A static sample has no API. */
      }
    }
  });
});
async function findTimes() {
  await run(async () => {
    if (form.mode !== "book" && !selected.value)
      throw new Error("Select an appointment first.");
    const b = {
      providerId: form.providerId as "cohen",
      date: form.date,
      type: (form.mode === "book"
        ? form.type
        : selected.value!.type) as "follow-up",
      appointmentId: form.mode === "book" ? null : selectedId.value,
    };
    starts.value = live.value
      ? (await api("availability", b)).starts
      : slots(
          sample,
          { ...b, patientId: sampleId },
          b.appointmentId || undefined,
        );
    form.start = -1;
    if (!starts.value.length)
      notice.value =
        "No openings for that selection. Try another date or provider.";
  });
}
function showProposal(p: Proposal) {
  proposal.value = p;
  reviewed.value = false;
}
async function prepare() {
  await run(async () => {
    const change =
      form.mode === "book"
        ? {
            type: "book",
            booking: {
              providerId: form.providerId,
              date: form.date,
              start: Number(form.start),
              type: form.type,
            },
          }
        : form.mode === "cancel"
          ? { type: "cancel", id: selectedId.value }
          : {
              type: "reschedule",
              id: selectedId.value,
              date: form.date,
              start: Number(form.start),
              providerId: form.providerId,
            };
    if (live.value)
      showProposal(
        await api("proposals", { version: data.value!.version, change }),
      );
    else {
      const bound = bindPatientChange(change, sampleId);
      assertPatientChange(sample, sampleId, bound);
      apply(sample, bound);
      showProposal({
        id: crypto.randomUUID(),
        change: bound,
        patientId: sampleId,
        version: sample.version,
        state: "pending",
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      });
    }
    notice.value = "Proposal prepared. Confirm the details below to save it.";
  });
}
async function decide(decision: "approve" | "reject") {
  await run(async () => {
    const p = proposal.value!;
    if (live.value) {
      setData(await api(`proposals/${p.id}/review`, { decision }));
      await reload();
    } else {
      if (
        p.version !== sample.version ||
        new Date(p.expiresAt).getTime() < Date.now()
      )
        throw new Error(
          "This proposal expired or your schedule changed. Prepare a fresh change.",
        );
      if (decision === "approve") {
        assertPatientChange(sample, sampleId, p.change);
        sample = apply(sample, p.change);
        setData(patientView(sample, sampleId));
      }
    }
    p.state = decision === "approve" ? "approved" : "rejected";
    notice.value =
      decision === "approve"
        ? "Your appointment change is confirmed. No notification was sent in this demo."
        : "Proposal dismissed. Your appointment is unchanged.";
  });
}
async function ask() {
  await run(async () => {
    proposal.value = null;
    if (live.value) {
      answer.value = await api("assistant", {
        message: message.value,
        selectedId: selectedId.value || undefined,
      });
      if (answer.value?.proposal) showProposal(answer.value.proposal);
      saved.value = await api("proposals");
    } else {
      const sources = retrieveClinic(message.value);
      answer.value = {
        message: sources.length
          ? "Matching passages from the clinic guide:"
          : "The sample searches approved clinic information. Use the appointment controls for changes, or open a staff invitation to try live AI.",
        sources,
        trace: [
          {
            tool: "search_clinic_info",
            summary: "Local keyword search; no model call",
          },
        ],
        model: "Interactive sample · no model call",
      };
    }
  });
}
async function checkIn() {
  await run(async () => {
    if (!selected.value || !checkinConfirmed.value)
      throw new Error("Review your appointment first.");
    if (live.value) {
      setData(
        await api("check-in", {
          appointmentId: selectedId.value,
          version: data.value!.version,
        }),
      );
      await reload();
    } else {
      sample = apply(sample, {
        type: "status",
        id: selectedId.value,
        status: "checked-in",
        source: "kiosk",
      });
      setData(patientView(sample, sampleId));
    }
    checkingIn.value = false;
    checkinConfirmed.value = false;
    notice.value =
      "You're checked in. The front desk schedule has been updated.";
  });
}
async function signOut() {
  await run(async () => {
    try {
      if (live.value) await api("logout", {});
    } finally {
      clearPrivateView();
    }
    notice.value = "You are signed out.";
  });
}

const basePath = import.meta.env.BASE_URL;
</script>
<template>
  <div class="patient-portal">
    <header class="portal-top">
      <a :href="`${basePath}?patient=1`" class="brand"
        ><span class="brand-icon"><HeartPulse :size="23" /></span>clera<span
          class="brand-dot"
          >.</span
        ></a
      ><span class="portal-clinic"
        >Willow Family Care <span>Patient portal</span></span
      ><button
        v-if="data"
        class="text-button"
        :disabled="busy"
        @click="signOut"
      >
        <LogOut :size="15" />Sign out
      </button>
    </header>
    <main class="portal-main">
      <div class="portal-privacy">
        <ShieldCheck :size="16" /><span
          >Fictional patient demo. Do not enter real health or identity
          information.</span
        ><span class="badge">{{ live ? "PRIVATE SESSION" : "SAMPLE" }}</span>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <section v-if="!data" class="portal-welcome">
        <span class="kiosk-symbol"><HeartPulse :size="36" /></span>
        <p class="eyebrow">A LITTLE MORE PEACE OF MIND</p>
        <h1>Your care, a little easier.</h1>
        <p>
          Keep track of appointments, find a time that works, and get the
          practical details before your visit.
        </p>
        <button class="button primary" :disabled="busy" @click="startSample">
          Explore as Grace, a fictional patient
        </button>
        <div class="portal-access-note">
          <ShieldCheck :size="20" />
          <p>
            For live AI, open a patient invitation created in the staff demo.
            Invitations are single-use and bind access to one fictional patient.
          </p>
        </div>
      </section>
      <template v-else
        ><div class="portal-heading">
          <div>
            <p class="eyebrow">YOUR PATIENT SPACE</p>
            <h1>
              Good to see you, {{ data.patient.name.split(" ")[0]
              }}<span>.</span>
            </h1>
            <p>
              Your appointments and a helping hand for everything around them.
            </p>
          </div>
          <button
            class="button secondary"
            :disabled="busy"
            @click="run(reload)"
          >
            <RefreshCw :size="15" />Refresh
          </button>
        </div>
        <div class="portal-layout">
          <div>
            <section class="portal-card">
              <div class="portal-section-heading">
                <span class="portal-icon"><CalendarDays :size="19" /></span>
                <div>
                  <h2>Your appointments</h2>
                  <p>Demo day: {{ dateLabel(data.day) }} · Eastern time</p>
                </div>
              </div>
              <p v-if="!data.appointments.length" class="muted">
                No appointments yet. Book your first visit below.
              </p>
              <article
                v-for="a in data.appointments"
                :key="a.id"
                class="portal-appointment"
                :class="{ chosen: a.id === selectedId }"
              >
                <div class="portal-date">
                  <strong>{{ Number(a.date.slice(-2)) }}</strong
                  ><span>{{
                    new Date(a.date + "T12:00:00Z").toLocaleDateString(
                      "en-US",
                      { month: "short", timeZone: "UTC" },
                    )
                  }}</span>
                </div>
                <div class="portal-appointment-info">
                  <strong>{{
                    visitTypes.find((t) => t.id === a.type)?.name
                  }}</strong>
                  <p>{{ dateLabel(a.date) }} · {{ timeLabel(a.start) }}</p>
                  <small>{{
                    providers.find((p) => p.id === a.providerId)?.name
                  }}</small>
                </div>
                <div class="portal-appointment-action">
                  <span class="status" :data-status="a.status">{{
                    a.status.replace("-", " ")
                  }}</span
                  ><button
                    v-if="a.status === 'scheduled'"
                    class="text-button"
                    :disabled="busy"
                    @click="choose(a.id)"
                  >
                    {{ a.id === selectedId ? "Selected" : "Manage visit" }}
                  </button>
                </div>
              </article>
              <div
                v-if="
                  selected?.date === data.day && selected.status === 'scheduled'
                "
                class="portal-checkin"
              >
                <button
                  v-if="!checkingIn"
                  class="button secondary full"
                  :disabled="busy"
                  @click="checkingIn = true"
                >
                  I'm here. Check in for this visit</button
                ><template v-else
                  ><h3>Confirm your arrival</h3>
                  <p>
                    {{ data.patient.name }} · {{ dateLabel(selected.date) }} at
                    {{ timeLabel(selected.start) }}<br />{{
                      providers.find((p) => p.id === selected?.providerId)?.name
                    }}
                  </p>
                  <label class="checkbox"
                    ><input v-model="checkinConfirmed" type="checkbox" />I'm
                    checking in for this fictional appointment.</label
                  ><button
                    class="button primary full"
                    :disabled="busy || !checkinConfirmed"
                    @click="checkIn"
                  >
                    Confirm patient check-in</button
                  ><button
                    class="text-button full"
                    @click="
                      checkingIn = false;
                      checkinConfirmed = false;
                    "
                  >
                    Not yet
                  </button></template
                >
              </div>
            </section>
            <section class="portal-card">
              <div class="portal-section-heading">
                <span class="portal-icon"><CalendarDays :size="19" /></span>
                <div>
                  <h2>Make room for your day</h2>
                  <p>
                    Choose a change. You'll confirm it before anything is saved.
                  </p>
                </div>
              </div>
              <div class="portal-tabs">
                <button
                  v-for="item in [
                    { id: 'reschedule', label: 'Move a visit' },
                    { id: 'book', label: 'Book a visit' },
                    { id: 'cancel', label: 'Cancel a visit' },
                  ]"
                  :key="item.id"
                  :class="{ active: form.mode === item.id }"
                  :disabled="busy"
                  @click="
                    form.mode = item.id as typeof form.mode;
                    starts = [];
                    form.start = -1;
                  "
                >
                  {{ item.label }}
                </button>
              </div>
              <template
                v-if="form.mode === 'book' || selected?.status === 'scheduled'"
                ><p v-if="form.mode !== 'book'" class="small muted">
                  Selected: {{ selected && dateLabel(selected.date) }} ·
                  {{ selected && timeLabel(selected.start) }}
                </p>
                <template v-if="form.mode !== 'cancel'"
                  ><div class="form-grid">
                    <label
                      >Provider<select
                        v-model="form.providerId"
                        aria-label="Patient provider"
                        @change="
                          starts = [];
                          form.start = -1;
                        "
                      >
                        <option
                          v-for="p in providers"
                          :key="p.id"
                          :value="p.id"
                        >
                          {{ p.name }}
                        </option>
                      </select></label
                    ><label
                      >Preferred date<input
                        v-model="form.date"
                        type="date"
                        :min="data.day"
                        @change="
                          starts = [];
                          form.start = -1;
                        "
                    /></label>
                  </div>
                  <label v-if="form.mode === 'book'"
                    >Visit type<select
                      v-model="form.type"
                      aria-label="Patient visit type"
                      @change="
                        starts = [];
                        form.start = -1;
                      "
                    >
                      <option v-for="t in visitTypes" :key="t.id" :value="t.id">
                        {{ t.name }} · {{ t.duration }} min
                      </option>
                    </select></label
                  ><button
                    class="button secondary full"
                    :disabled="busy || !form.date"
                    @click="findTimes"
                  >
                    Find available times
                  </button>
                  <div v-if="starts.length" class="portal-time-picker">
                    <label
                      >Available time<select
                        v-model="form.start"
                        aria-label="Patient available time"
                      >
                        <option :value="-1" disabled>Choose a time</option>
                        <option v-for="n in starts" :key="n" :value="n">
                          {{ timeLabel(n) }}
                        </option>
                      </select></label
                    >
                  </div></template
                >
                <p v-else class="callout">
                  Cancellation releases your appointment slot. You'll confirm
                  this separately.
                </p>
                <button
                  class="button primary full portal-prepare"
                  :disabled="
                    busy ||
                    (form.mode !== 'cancel' &&
                      !starts.includes(Number(form.start)))
                  "
                  @click="prepare"
                >
                  Review
                  {{
                    form.mode === "cancel"
                      ? "cancellation"
                      : "appointment change"
                  }}
                </button></template
              >
              <p v-else class="callout">
                Select a scheduled appointment above, or book a new visit.
              </p>
            </section>
            <section class="portal-card portal-guide" id="clinic-guide">
              <div class="portal-section-heading">
                <span class="portal-icon"><BookOpen :size="19" /></span>
                <div>
                  <h2>A little preparation goes a long way</h2>
                  <p>Approved information for this fictional clinic.</p>
                </div>
              </div>
              <div class="guide-topics">
                <button
                  v-for="s in clinicSources"
                  :key="s.id"
                  :class="{ active: guide === s.id }"
                  @click="guide = s.id"
                >
                  {{ s.section }}
                </button>
              </div>
              <article class="clinic-source" :id="'guide-' + currentSource.id">
                <span class="source-label">{{ currentSource.title }}</span>
                <h3>{{ currentSource.section }}</h3>
                <p>{{ currentSource.body }}</p>
                <small
                  >Demo content reviewed {{ currentSource.reviewed }}</small
                >
              </article>
            </section>
          </div>
          <aside class="portal-concierge">
            <div class="portal-section-heading">
              <span class="sparkle"><Sparkles :size="21" /></span>
              <div>
                <h2>A helping hand</h2>
                <p>Your appointments. Your questions.</p>
              </div>
            </div>
            <p class="portal-concierge-intro">
              Ask about a time that works for you, parking, or what to bring.
              Medical questions belong with your care team.
            </p>
            <form @submit.prevent="ask">
              <label class="sr-only" for="patient-message"
                >Ask your patient assistant</label
              ><textarea
                id="patient-message"
                v-model="message"
                rows="4"
                maxlength="1500"
                placeholder="Can I move my visit to next Monday at 10 AM?"
              />
              <div class="assistant-input-footer">
                <span>{{
                  live
                    ? "Only your appointments are accessible"
                    : "Sample searches the clinic guide"
                }}</span
                ><button
                  class="send-button"
                  :disabled="busy || message.trim().length < 3"
                  aria-label="Send patient request"
                >
                  <ArrowUpRight :size="20" />
                </button>
              </div>
            </form>
            <div class="portal-suggestions">
              <button
                :disabled="busy"
                @click="
                  message = 'Where can I park and when should I arrive?';
                  ask();
                "
              >
                Where do I park?</button
              ><button
                :disabled="busy"
                @click="
                  message = 'What paperwork should I bring?';
                  ask();
                "
              >
                What should I bring?
              </button>
            </div>
            <p v-if="busy" class="callout" role="status">
              Checking your request…
            </p>
            <div v-if="answer" class="patient-answer">
              <p class="small muted">{{ answer.model }}</p>
              <p>{{ answer.message }}</p>
              <article
                v-for="s in answer.sources"
                :key="s.id"
                class="clinic-source"
              >
                <span class="source-label">APPROVED CLINIC GUIDE</span>
                <h3>{{ s.section }}</h3>
                <p>{{ s.body }}</p>
                <a href="#clinic-guide" @click="guide = s.id"
                  >Source: {{ s.title }} · {{ s.section }}</a
                >
              </article>
              <details v-if="answer.trace.length">
                <summary>How this was checked</summary>
                <ol class="tool-trace">
                  <li v-for="(t, i) in answer.trace" :key="i">
                    <Check :size="14" />
                    <div>
                      <strong>{{ t.tool.replaceAll("_", " ") }}</strong
                      ><span>{{ t.summary }}</span>
                    </div>
                  </li>
                </ol>
              </details>
            </div>
            <article v-if="proposal" class="approval-card patient-approval">
              <h3>
                {{
                  proposal.state === "pending"
                    ? "Confirm your change"
                    : proposal.state === "approved"
                      ? "Your change is confirmed"
                      : "Proposal dismissed"
                }}
              </h3>
              <p>
                <strong>{{ data.patient.name }}</strong>
              </p>
              <p v-if="before" class="small">
                Current appointment<br />{{ dateLabel(before.date) }} ·
                {{ timeLabel(before.start) }}<br />{{
                  providers.find((p) => p.id === before?.providerId)?.name
                }}
              </p>
              <div v-if="after" class="proposed-time">
                <span>Proposed appointment</span
                ><strong
                  >{{ dateLabel(after.date) }} ·
                  {{ timeLabel(after.start) }}</strong
                ><span>{{
                  providers.find((p) => p.id === after?.providerId)?.name
                }}</span
                ><span>{{
                  proposal.change.type === "book"
                    ? proposal.change.booking.type
                    : before?.type
                }}</span>
              </div>
              <p v-else class="callout">
                Your selected appointment will be cancelled.
              </p>
              <template v-if="proposal.state === 'pending'"
                ><label class="checkbox"
                  ><input v-model="reviewed" type="checkbox" />I reviewed the
                  appointment details and want this change.</label
                ><button
                  class="button primary full"
                  :disabled="busy || !reviewed"
                  @click="decide('approve')"
                >
                  Confirm
                  {{
                    proposal.change.type === "cancel"
                      ? "cancellation"
                      : "change"
                  }}</button
                ><button
                  class="text-button full"
                  :disabled="busy"
                  @click="decide('reject')"
                >
                  Keep my appointment
                </button>
                <p class="small muted">
                  Proposal expires in 15 minutes from creation. Availability is
                  checked again when you confirm.
                </p></template
              >
            </article>
            <div v-if="saved.length" class="saved-proposals">
              <h3>Your recent proposals</h3>
              <button
                v-for="p in saved"
                :key="p.id"
                class="proposal-link"
                @click="showProposal(p)"
              >
                {{ p.change.type }} · {{ p.state }}
              </button>
            </div>
            <div class="portal-access-note">
              <ShieldCheck :size="18" />
              <p>
                {{
                  live
                    ? "The server limits every request to the patient assigned to this invitation."
                    : "This browser-only sample uses fictional data. Live invitations demonstrate server-enforced patient access."
                }}<span v-if="live && expires">
                  Session ends
                  {{
                    new Date(expires).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  }}.</span
                >
              </p>
            </div>
          </aside>
        </div></template
      >
      <footer class="portal-footer">
        Clera · Fictional clinic demonstration. No medical advice, real
        notifications, or real patient information.
      </footer>
    </main>
  </div>
</template>
