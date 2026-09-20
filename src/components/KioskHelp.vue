<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from "vue";
import { Sparkles, LifeBuoy, Send, ShieldCheck } from "@lucide/vue";
import { workspace, request, requestAssistance } from "../workspace";
import {
  sampleKioskHelp,
  stepGuides,
  issueGuides,
  helpLabels,
  type KioskQuestion,
  type KioskAnswer,
  type HelpRequest,
} from "../../shared/kiosk";
const props = defineProps<{
  step: KioskQuestion["step"];
  issue: KioskQuestion["issue"];
  visitId: string;
}>();
const question = ref(""),
  answer = ref<KioskAnswer | null>(null),
  busy = ref(false),
  error = ref(""),
  reviewHelp = ref(false),
  category = ref<keyof typeof helpLabels>("general"),
  sent = ref<HelpRequest | null>(null);
let generation = 0;
const guidance = computed(() =>
  props.issue === "none" ? stepGuides[props.step] : issueGuides[props.issue],
);
watch(
  () => [props.step, props.visitId],
  () => {
    generation++;
    question.value = "";
    answer.value = null;
    error.value = "";
    reviewHelp.value = false;
    busy.value = false;
    if (props.step === "welcome") sent.value = null;
  },
);
onBeforeUnmount(() => generation++);
async function ask(text = question.value) {
  const current = ++generation;
  busy.value = true;
  error.value = "";
  try {
    const input = { step: props.step, issue: props.issue, question: text };
    const result =
      workspace.mode === "live"
        ? await request("kiosk/help", input)
        : sampleKioskHelp(input);
    if (current !== generation) return;
    answer.value = result;
    if (result.suggestedCategory) category.value = result.suggestedCategory;
  } catch (e) {
    if (current === generation)
      error.value =
        e instanceof Error ? e.message : "Use the approved guidance below.";
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function send() {
  const current = ++generation;
  busy.value = true;
  error.value = "";
  try {
    const result = await requestAssistance({
      visitId: props.visitId,
      step: props.step,
      category: category.value,
    });
    if (current !== generation) return;
    sent.value = result;
    reviewHelp.value = false;
  } catch (e) {
    if (current === generation)
      error.value =
        e instanceof Error ? e.message : "The help request was not sent.";
  } finally {
    if (current === generation) busy.value = false;
  }
}
</script>
<template>
  <section class="embedded-guide">
    <div class="row-between">
      <h2><Sparkles :size="18" />Check-in guide</h2>
      <span class="badge">{{
        workspace.mode === "live" ? "LANGCHAIN AI" : "SAMPLE"
      }}</span>
    </div>
    <p class="guide-context">
      Help for this step: {{ stepGuides[step].section }}
    </p>
    <div class="inline-step-guidance">
      <strong>{{ guidance.section }}</strong>
      <p>{{ guidance.body }}</p>
    </div>
    <form @submit.prevent="ask()">
      <label for="kiosk-question">What would you like help with?</label
      ><textarea
        id="kiosk-question"
        v-model="question"
        rows="2"
        maxlength="500"
        placeholder="What does this step need me to do?"
      />
      <div class="guide-input-actions">
        <small>Keep names, dates of birth, and health details out.</small
        ><button
          class="send-button"
          aria-label="Ask check-in guide"
          :disabled="busy || question.trim().length < 3"
        >
          <Send :size="17" />
        </button>
      </div>
    </form>
    <div class="guide-suggestions">
      <button
        :disabled="busy"
        @click="
          question = 'Explain this step in simple terms';
          ask();
        "
      >
        Explain this step</button
      ><button
        :disabled="busy"
        @click="
          question = 'What paperwork should I bring?';
          ask();
        "
      >
        What should I bring?
      </button>
    </div>
    <p v-if="busy" role="status" class="small muted">Checking your request…</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div v-if="answer" class="kiosk-guide-answer">
      <p>{{ answer.message }}</p>
      <article v-for="s in answer.sources" :key="s.id" class="clinic-source">
        <h3>{{ s.section }}</h3>
        <p>{{ s.body }}</p>
        <small
          >Source: {{ s.title }} · {{ s.section }} · Reviewed
          {{ s.reviewed }}</small
        >
      </article>
      <details>
        <summary>How this answer was prepared</summary>
        <ol>
          <li v-for="t in answer.trace" :key="t">{{ t }}</li>
        </ol>
      </details>
    </div>
    <div class="kiosk-help-action">
      <button
        v-if="!reviewHelp && !sent"
        class="button secondary full"
        :disabled="busy"
        @click="reviewHelp = true"
      >
        <LifeBuoy :size="16" />Request front-desk help
      </button>
      <form v-if="reviewHelp" @submit.prevent="send">
        <h3>Review your help request</h3>
        <label
          >What kind of help?<select
            v-model="category"
            aria-label="Help category"
          >
            <option v-for="(label, key) in helpLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select></label
        >
        <p class="small muted">
          The staff demo will receive this category, your current check-in step,
          and a request code. No form details or assistant conversation are
          included.
        </p>
        <button class="button primary full" :disabled="busy">
          Send help request</button
        ><button
          type="button"
          class="text-button full"
          :disabled="busy"
          @click="reviewHelp = false"
        >
          Never mind
        </button>
      </form>
      <div v-if="sent" class="help-sent" role="status">
        <ShieldCheck :size="20" />
        <div>
          <strong>Help request queued</strong>
          <p>
            Request {{ sent.id.slice(0, 8).toUpperCase() }} ·
            {{ helpLabels[sent.category] }}
          </p>
          <small
            >Visible in this session's staff dashboard. No external message was
            sent.</small
          >
        </div>
      </div>
    </div>
  </section>
</template>
