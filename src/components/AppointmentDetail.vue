<script setup lang="ts">
import { ref, computed } from "vue";
import Dialog from "./Dialog.vue";
import {
  providers,
  patient,
  dateLabel,
  timeLabel,
  duration,
  type Appointment,
} from "../../shared/domain";
import { workspace, run, execute } from "../workspace";
const props = defineProps<{ appointment: Appointment }>();
const emit = defineEmits<{
  close: [];
  reschedule: [Appointment];
  assist: [Appointment];
}>();
const reason = ref(""),
  cancelling = ref(false);
const person = computed(() =>
  patient(workspace.data, props.appointment.patientId),
);
const actions: Record<
  string,
  Array<{
    label: string;
    status: "checked-in" | "roomed" | "completed" | "no-show";
  }>
> = {
  scheduled: [
    { label: "Check in", status: "checked-in" },
    { label: "Mark no-show", status: "no-show" },
  ],
  "checked-in": [{ label: "Mark roomed", status: "roomed" }],
  roomed: [{ label: "Complete visit", status: "completed" }],
};
</script>
<template>
  <Dialog
    :title="person?.name || 'Appointment'"
    @close="!workspace.busy && emit('close')"
    ><div class="detail-summary">
      <span class="status" :data-status="appointment.status">{{
        appointment.status
      }}</span>
      <h3>
        {{ dateLabel(appointment.date) }} · {{ timeLabel(appointment.start) }}
      </h3>
      <p>
        {{ providers.find((p) => p.id === appointment.providerId)?.name }} ·
        {{ duration(appointment.type) }} minutes
      </p>
      <p class="muted">{{ appointment.type }} · Main clinic</p>
    </div>
    <div v-if="appointment.status === 'scheduled'" class="detail-actions">
      <button class="button secondary" @click="emit('reschedule', appointment)">
        Reschedule</button
      ><button class="button secondary" @click="emit('assist', appointment)">
        Ask assistant</button
      ><button class="text-button danger" @click="cancelling = !cancelling">
        Cancel appointment
      </button>
    </div>
    <form
      v-if="cancelling && appointment.status === 'scheduled'"
      class="inset"
      @submit.prevent="
        run(async () => {
          await execute({ type: 'cancel', id: appointment.id, reason });
          cancelling = false;
          workspace.notice = 'Appointment cancelled. No message was sent.';
        })
      "
    >
      <label
        >Cancellation reason<input
          v-model="reason"
          required
          maxlength="160" /></label
      ><button class="button danger-fill" :disabled="workspace.busy">
        Confirm cancellation
      </button>
    </form>
    <div v-if="appointment.date === workspace.data.day" class="detail-actions">
      <button
        v-for="action in actions[appointment.status] || []"
        :key="action.status"
        class="button primary"
        :disabled="workspace.busy"
        @click="
          run(async () => {
            await execute({
              type: 'status',
              id: appointment.id,
              status: action.status,
              source: 'staff',
            });
          })
        "
      >
        {{ action.label }}
      </button>
    </div>
    <h3 class="section-title">Appointment activity</h3>
    <ol class="timeline">
      <li v-for="(e, n) in appointment.events" :key="n">
        <span />
        <div>
          <strong>{{ e.label }}</strong
          ><small
            >{{
              new Date(e.at).toLocaleString("en-US", {
                timeZone: "America/New_York",
              })
            }}
            ET</small
          >
        </div>
      </li>
    </ol>
    <p v-if="workspace.error" role="alert" class="error">
      {{ workspace.error }}
    </p>
    <p class="small muted">
      Fictional appointment. Notifications and visit activity are simulated.
    </p></Dialog
  >
</template>
