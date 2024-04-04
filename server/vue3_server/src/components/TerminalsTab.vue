<template>
  <v-card
    class="mr-auto"
    variant="outlined"
  >
    <v-tabs
      v-model="tab"
      show-arrows
    >
      <v-tab
        v-for="terminal in terminals"
        :key="terminal.id"
        class="text-none"
        @click="selected(terminal)"
      >
        {{ terminal.name }}
      </v-tab>
    </v-tabs>
  </v-card>
</template>

<script setup>
  import { ref, inject, onMounted } from 'vue';

  const emits = defineEmits(['selected']);

  const echidna = inject("$echidna");
  const tab = ref(0);
  const terminals = ref([]);

  onMounted(() => {
    echidna.on('terminals', updateTerminalTabs);
    return updateTerminalTabs();
  });

  const updateTerminalTabs = () => {
    return echidna
      .terminals()
      .then(({ data: terms }) => {
        terminals.value = terms;
        if (terms.length) {
          selected(terms[tab.value]);
        }
      })
      .catch((error) => {
        console.log(`ERROR: update terminal tabs : ${error}`);
      });
  };

  const selected = (terminal) => {
    emits('selected', terminal);
  };
</script>
