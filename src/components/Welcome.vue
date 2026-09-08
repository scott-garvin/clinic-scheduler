<script setup lang="ts">
defineEmits<{ (e: 'start'): void }>();
</script>

<template>
  <div class="card panel welcome">
    <div class="icon">👋</div>
    <h1>Welcome</h1>
    <p class="lead">Let's get you checked in for today's appointment. It only takes a minute.</p>
    <button class="kbtn kbtn-primary big" @click="$emit('start')">Start check-in →</button>
    <p class="tiny">A front-desk team member is nearby if you need help.</p>
  </div>
</template>

<style scoped>
.welcome {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 52px;
  padding-bottom: 52px;
}
.icon {
  font-size: 52px;
}
.lead {
  max-width: 40ch;
}
.kbtn.big {
  margin-top: 12px;
}
.tiny {
  font-size: 13px;
  color: var(--faint);
  margin-top: 4px;
}
</style>
