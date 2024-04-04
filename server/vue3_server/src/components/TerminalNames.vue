<template>
  <v-container
    class="mr-auto"
    outlined
  >
    <a
      v-for="terminal in terminals"
      :key="terminal.id"
      class="text-none"
      @click="selected(terminal)"
    >
      #{{ terminal.id }}: {{ terminal.name }}
      <p />
    </a>
  </v-container>
</template>

<script setup>
  import { ref, inject, onMounted } from 'vue';

  const emits = defineEmits(['selected']);

  const echidna = inject("$echidna");
  const terminals = ref([]);

  onMounted(() => {
    updateTerminals();
    echidna.on('terminals', updateTerminals);
  });

  const updateTerminals = () => {
    return echidna
      .terminals()
      .then(({ data: terms }) => {
        terminals.value = terms.filter(terminal => !terminal.hidden);
      })
      .catch((error) => {
        console.log(`ERROR: update terminal tabs : ${error}`);
      });
  };

  const selected = (terminal) => {
      emits('selected', terminal);
  };
</script>
