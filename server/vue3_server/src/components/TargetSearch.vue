<template>
  <v-text-field
    v-model="target"
    placeholder="Search Target Name"
    flat
    hide-details
    rows="1"
    density="compact"
    @update:modelValue="$emit('search', target)"
  />
</template>

<script setup>
import { ref } from 'vue';
const target = ref("");
//const emits = defineEmits(['search']);
</script>
