<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{ (e: 'agree'): void; (e: 'back'): void }>();
const agreed = ref(false);
</script>

<template>
  <div class="card panel">
    <h2>Consent &amp; privacy</h2>
    <p class="lead">One last step before you're checked in.</p>

    <div class="box">
      <p>
        I consent to receive care at this clinic today, and I acknowledge that I have been offered a copy of the
        Notice of Privacy Practices describing how my health information may be used and disclosed.
      </p>
      <p class="demo-note">This is a demonstration. No real medical consent is being collected.</p>
    </div>

    <label class="agree">
      <input type="checkbox" v-model="agreed" />
      <span>I have read and agree to the above.</span>
    </label>

    <div class="actions">
      <button class="kbtn kbtn-ghost" @click="emit('back')">Back</button>
      <button class="kbtn kbtn-primary" :disabled="!agreed" @click="emit('agree')">Complete check-in →</button>
    </div>
  </div>
</template>

<style scoped>
.box {
  margin-top: 18px;
  background: var(--frame);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 15px;
  color: var(--ink-2);
  line-height: 1.6;
}
.demo-note {
  font-size: 13px;
  color: var(--faint);
}
.agree {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-top: 18px;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
}
.agree input {
  width: 22px;
  height: 22px;
  margin-top: 1px;
  accent-color: var(--accent);
  flex: none;
  cursor: pointer;
}
</style>
