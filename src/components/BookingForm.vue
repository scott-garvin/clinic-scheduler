<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import Dialog from "./Dialog.vue";
import {
  providers,
  visitTypes,
  slots,
  timeLabel,
  type Appointment,
  type Booking,
} from "../../shared/domain";
import { workspace, run, execute } from "../workspace";
const props = defineProps<{
  appointment?: Appointment;
  date: string;
  patientId?: string;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const a = props.appointment;
const form = reactive({
  patientId: a?.patientId || props.patientId || "",
  providerId: a?.providerId || "nguyen",
  date: a?.date || props.date,
  type: a?.type || "follow-up",
  start: a?.start ?? -1,
  reason: "",
});
const choices = computed(() =>
  form.patientId
    ? slots(
        workspace.data,
        {
          patientId: form.patientId,
          providerId: form.providerId as Booking["providerId"],
          date: form.date,
          type: form.type as Booking["type"],
        },
        a?.id,
      )
    : [],
);
const error = ref("");
async function save() {
  error.value = "";
  await run(async () => {
    try {
      if (!choices.value.includes(Number(form.start)))
        throw new Error("Choose an available time.");
      await execute(
        a
          ? {
              type: "reschedule",
              id: a.id,
              date: form.date,
              start: Number(form.start),
              providerId: form.providerId as Booking["providerId"],
              reason: form.reason,
            }
          : {
              type: "book",
              booking: {
                patientId: form.patientId,
                providerId: form.providerId as Booking["providerId"],
                date: form.date,
                type: form.type as Booking["type"],
                start: Number(form.start),
              },
            },
      );
      workspace.notice = a
        ? "Appointment rescheduled. Notifications are simulated."
        : "Appointment booked. Notifications are simulated.";
      emit("saved");
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Check the appointment details.";
    }
  });
}
</script>
<template>
  <Dialog
    :title="appointment ? 'Reschedule appointment' : 'Book an appointment'"
    @close="!workspace.busy && emit('close')"
    ><form @submit.prevent="save">
      <p class="muted">
        Clinic time: America/New_York. Weekdays, 9 AM–5 PM; closed noon–1 PM.
      </p>
      <label
        >Patient<select
          aria-label="Patient"
          v-model="form.patientId"
          :disabled="!!appointment"
          required
        >
          <option value="" disabled>Select a patient</option>
          <option
            v-for="p in workspace.data.patients"
            :key="p.id"
            :value="p.id"
          >
            {{ p.name }}
          </option>
        </select></label
      >
      <div class="form-grid">
        <label
          >Provider<select v-model="form.providerId">
            <option v-for="p in providers" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select></label
        ><label
          >Visit type<select v-model="form.type" :disabled="!!appointment">
            <option v-for="t in visitTypes" :key="t.id" :value="t.id">
              {{ t.name }} · {{ t.duration }} min
            </option>
          </select></label
        >
      </div>
      <div class="form-grid">
        <label
          >Date<input
            v-model="form.date"
            type="date"
            required
            :min="workspace.data.day" /></label
        ><label
          >Available time<select v-model="form.start" required>
            <option :value="-1" disabled>Choose a time</option>
            <option v-for="n in choices" :key="n" :value="n">
              {{ timeLabel(n) }}
            </option>
          </select></label
        >
      </div>
      <p v-if="form.patientId && !choices.length" class="callout">
        No openings for this selection. Try another provider or weekday.
      </p>
      <label v-if="appointment"
        >Reason for rescheduling<input
          v-model="form.reason"
          maxlength="160"
          required
          placeholder="e.g. Patient requested a later appointment"
      /></label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <footer class="dialog-actions">
        <button type="button" class="button secondary" @click="emit('close')">
          Cancel</button
        ><button
          class="button primary"
          :disabled="workspace.busy || !choices.includes(Number(form.start))"
        >
          {{ appointment ? "Save new time" : "Book appointment" }}
        </button>
      </footer>
    </form></Dialog
  >
</template>
