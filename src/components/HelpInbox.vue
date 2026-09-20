<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { LifeBuoy, RefreshCw } from "@lucide/vue";
import { workspace, refreshHelp, resolveAssistance } from "../workspace";
import { helpLabels, stepGuides } from "../../shared/kiosk";
const error = ref(""),
  busy = ref(false);
const open = computed(() =>
  workspace.helpRequests.filter((h) => !h.resolvedAt),
);
const resolved = computed(() =>
  workspace.helpRequests.filter((h) => h.resolvedAt).slice(0, 5),
);
let timer: ReturnType<typeof setInterval>;
async function load() {
  if (busy.value) return;
  busy.value = true;
  try {
    await refreshHelp();
    error.value = "";
  } catch {
    error.value = "Could not refresh the help queue. Try Refresh.";
  } finally {
    busy.value = false;
  }
}
async function resolve(id: string) {
  if (busy.value) return;
  busy.value = true;
  try {
    await resolveAssistance(id);
    error.value = "";
  } catch {
    error.value = "Could not resolve this request. Try again.";
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  void load();
  timer = setInterval(() => {
    if (workspace.mode === "live") void load();
  }, 15000);
});
onBeforeUnmount(() => clearInterval(timer));
watch(
  () => workspace.mode,
  () => {
    void load();
  },
);
</script>
<template>
  <section class="help-inbox">
    <div class="row-between">
      <h2>
        <LifeBuoy :size="18" />Front-desk help
        <span class="badge">{{ open.length }} OPEN</span>
      </h2>
      <button
        class="text-button"
        aria-label="Refresh help requests"
        :disabled="busy"
        @click="load"
      >
        <RefreshCw :size="14" />Refresh
      </button>
    </div>
    <p v-if="!open.length" class="small muted">
      No open requests. Patients can ask for assistance from any check-in step.
    </p>
    <article v-for="h in open" :key="h.id" class="help-inbox-row">
      <span class="portal-icon"><LifeBuoy :size="18" /></span>
      <div>
        <strong>{{ helpLabels[h.category] }}</strong>
        <p>
          Kiosk · {{ stepGuides[h.step].section }} ·
          {{ h.id.slice(0, 8).toUpperCase() }}
        </p>
        <small
          >{{
            new Date(h.createdAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          }}
          · No patient details collected</small
        >
      </div>
      <button
        class="button secondary compact"
        :disabled="busy"
        @click="resolve(h.id)"
      >
        Mark resolved
      </button>
    </article>
    <details v-if="resolved.length">
      <summary>Recently resolved ({{ resolved.length }})</summary>
      <p v-for="h in resolved" :key="h.id" class="small muted">
        {{ helpLabels[h.category] }} · {{ h.id.slice(0, 8).toUpperCase() }} ·
        Resolved
      </p>
    </details>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
