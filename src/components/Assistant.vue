<script setup lang="ts">
import { ref, onMounted, computed, toRaw } from "vue";
import {
  Sparkles,
  ArrowUpRight,
  Check,
  ShieldCheck,
  ChevronDown,
} from "@lucide/vue";
import { workspace, run, request, refresh, execute } from "../workspace";
import {
  describe,
  patient,
  providers,
  dateLabel,
  timeLabel,
  slots,
  shift,
  weekday,
  apply,
  type Change,
} from "../../shared/domain";
import type { AssistantResult, Proposal } from "../../shared/assistant";
const props = defineProps<{ date: string; selectedId?: string }>();
const message = ref(""),
  result = ref<AssistantResult | null>(null),
  proposals = ref<Proposal[]>([]),
  reviewed = ref(false);
const target = computed(() =>
  workspace.data.appointments.find((a) => a.id === props.selectedId),
);
const active = ref<Proposal | null>(null);
const original = computed(() => {
  const p = active.value;
  return p && p.change.type !== "book"
    ? workspace.data.appointments.find(
        (a) => a.id === (p.change as { id: string }).id,
      )
    : null;
});
async function load() {
  if (workspace.mode === "live") proposals.value = await request("proposals");
}
onMounted(() => {
  if (workspace.mode === "live")
    void load().catch(() => {
      workspace.error = "Could not load saved proposals. Use Refresh to retry.";
    });
});
function select(p: Proposal) {
  active.value = p;
  reviewed.value = false;
}
async function ask() {
  await run(async () => {
    if (workspace.mode !== "live")
      throw new Error(
        "Connect live access for your own requests, or use the guided example below.",
      );
    active.value = null;
    result.value = await request("assistant", {
      message: message.value,
      date: props.date,
      selectedId: props.selectedId,
    });
    if (result.value?.proposal) select(result.value.proposal);
    await load();
  });
}
function guided() {
  void run(async () => {
    const a = workspace.data.appointments.find((a) => a.status === "scheduled");
    if (!a) throw new Error("Create a scheduled appointment first.");
    let date = shift(a.date, 1);
    while ([0, 6].includes(weekday(date))) date = shift(date, 1);
    const start = slots(workspace.data, { ...a, date }, a.id)[0];
    if (start === undefined)
      throw new Error("No opening is available for the guided example.");
    const change: Change = {
      type: "reschedule",
      id: a.id,
      date,
      start,
      providerId: a.providerId,
      reason: "Guided example: patient requested another day",
    };
    apply(toRaw(workspace.data), change);
    const p: Proposal = {
      id: crypto.randomUUID(),
      change,
      version: workspace.data.version,
      state: "pending",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    };
    select(p);
    result.value = {
      message: describe(workspace.data, change),
      proposal: p,
      trace: [
        {
          tool: "find_appointments",
          summary: "Selected a fictional scheduled appointment",
        },
        {
          tool: "find_open_slots",
          summary: "Checked provider and patient availability",
        },
        {
          tool: "propose_reschedule",
          summary: "Prepared a change for your review",
        },
      ],
      model: "Guided example · no model call",
      inputTokens: 0,
      outputTokens: 0,
    };
  });
}
async function decide(decision: "approve" | "reject") {
  await run(async () => {
    const p = active.value!;
    if (workspace.mode === "live") {
      workspace.data = await request(`proposals/${p.id}/review`, { decision });
      await refresh();
      await load();
    } else {
      if (new Date(p.expiresAt).getTime() < Date.now())
        throw new Error("Proposal expired. Try a fresh example.");
      if (p.version !== workspace.data.version)
        throw new Error("The schedule changed. Generate a fresh example.");
      if (decision === "approve") await execute(p.change);
    }
    p.state = decision === "approve" ? "approved" : "rejected";
    workspace.notice =
      decision === "approve"
        ? "Approved change saved. Notifications are simulated."
        : "Proposal dismissed. Schedule unchanged.";
  });
}
const after = computed(() => {
  const c = active.value?.change;
  if (!c) return null;
  return c.type === "book" ? c.booking : c.type === "reschedule" ? c : null;
});
</script>
<template>
  <section class="assistant">
    <div class="assistant-heading">
      <span class="sparkle"><Sparkles :size="20" /></span>
      <div>
        <h2>Your scheduling copilot</h2>
        <p>Find a time. Review the change.</p>
      </div>
      <span class="badge">{{
        workspace.mode === "live" ? "LIVE AI" : "SAMPLE"
      }}</span>
    </div>
    <p class="context-note">
      <ShieldCheck :size="15" />Changes always need your approval.
    </p>
    <div v-if="target" class="inset">
      <span class="small muted">Selected appointment</span
      ><strong>{{ patient(workspace.data, target.patientId)?.name }}</strong>
      <p>{{ dateLabel(target.date) }} · {{ timeLabel(target.start) }}</p>
    </div>
    <form @submit.prevent="ask">
      <label class="sr-only">Scheduling request</label
      ><textarea
        v-model="message"
        aria-label="Scheduling request"
        rows="4"
        maxlength="2000"
        placeholder="Move Grace Bauer to tomorrow at 10 AM, with the same provider."
      />
      <div class="assistant-input-footer">
        <span>Fictional scheduling only</span
        ><button
          class="send-button"
          :disabled="
            workspace.busy ||
            message.trim().length < 3 ||
            workspace.mode !== 'live'
          "
          aria-label="Send scheduling request"
        >
          <ArrowUpRight :size="21" />
        </button>
      </div>
    </form>
    <p v-if="workspace.busy" role="status" class="callout">
      Checking the request and schedule…
    </p>
    <div v-if="workspace.mode === 'sample'" class="sample-guide">
      <p>
        This sample uses a prepared flow. Connect a demo key to try real tool
        calls.
      </p>
      <button
        class="button secondary full"
        :disabled="workspace.busy"
        @click="guided"
      >
        <Sparkles :size="15" />Try a guided reschedule
      </button>
    </div>
    <div v-if="result" class="assistant-response">
      <p class="small muted">
        {{ result.model
        }}<template v-if="workspace.mode === 'live'">
          · {{ result.inputTokens }} in / {{ result.outputTokens }} out
          tokens</template
        >
      </p>
      <p>{{ result.message }}</p>
      <details v-if="result.trace.length">
        <summary>How this was checked <ChevronDown :size="14" /></summary>
        <ol class="tool-trace">
          <li v-for="(t, i) in result.trace" :key="i">
            <Check :size="14" />
            <div>
              <strong>{{ t.tool.replaceAll("_", " ") }}</strong
              ><span>{{ t.summary }}</span>
            </div>
          </li>
        </ol>
      </details>
      <p class="small muted">
        Assistant text does not apply changes. Use the approval card below.
      </p>
    </div>
    <div v-if="workspace.mode === 'live'" class="saved-proposals">
      <div class="row-between">
        <h3>Saved proposals</h3>
        <button
          class="text-button"
          :disabled="workspace.busy"
          @click="run(load)"
        >
          Refresh
        </button>
      </div>
      <p v-if="!proposals.length" class="small muted">
        Proposals stay available for 15 minutes.
      </p>
      <button
        v-for="p in proposals"
        :key="p.id"
        class="proposal-link"
        @click="select(p)"
      >
        {{ describe(workspace.data, p.change) }}<span>{{ p.state }}</span>
      </button>
    </div>
    <article v-if="active" class="approval-card">
      <div class="row-between">
        <h3>
          {{
            active.state === "pending"
              ? "Review proposed change"
              : active.state === "approved"
                ? "Change approved"
                : "Proposal dismissed"
          }}
        </h3>
        <ShieldCheck :size="18" />
      </div>
      <template v-if="original"
        ><span class="small muted">Current appointment</span>
        <p>
          {{ patient(workspace.data, original.patientId)?.name }}<br />{{
            dateLabel(original.date)
          }}
          · {{ timeLabel(original.start) }}<br />{{
            providers.find((p) => p.id === original?.providerId)?.name
          }}
        </p></template
      >
      <p v-if="active.change.type === 'book'">
        {{ patient(workspace.data, active.change.booking.patientId)?.name }} ·
        {{ active.change.booking.type }}
      </p>
      <div v-if="after" class="proposed-time">
        <span class="small">Proposed time</span
        ><strong
          >{{ dateLabel(after.date) }} · {{ timeLabel(after.start) }}</strong
        ><span>{{
          providers.find((p) => p.id === after?.providerId)?.name
        }}</span>
      </div>
      <p v-else class="callout">
        This cancels the appointment and releases its time slot.
      </p>
      <p v-if="active.change.type !== 'book'" class="small">
        Reason: {{ active.change.reason }}
      </p>
      <template v-if="active.state === 'pending'"
        ><label class="checkbox"
          ><input v-model="reviewed" type="checkbox" />I checked the patient,
          appointment, and proposed change.</label
        ><button
          class="button primary full"
          :disabled="!reviewed || workspace.busy"
          @click="decide('approve')"
        >
          Approve
          {{
            active.change.type === "cancel" ? "cancellation" : "change"
          }}</button
        ><button
          class="text-button full"
          :disabled="workspace.busy"
          @click="decide('reject')"
        >
          Dismiss proposal
        </button>
        <p class="small muted">
          Expires
          {{
            new Date(active.expiresAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          }}. Availability is rechecked when you approve.
        </p></template
      >
    </article>
    <p v-if="workspace.error" role="alert" class="error">
      {{ workspace.error }}
    </p>
  </section>
</template>
