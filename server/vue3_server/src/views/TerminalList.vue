<template>
  <v-container>
    <TerminalAdd />
    <TerminalNames @selected="selectTerminal" />
  </v-container>
</template>

<script setup>
  import TerminalAdd from '@/components/TerminalAdd.vue';
  import TerminalNames from '@/components/TerminalNames.vue';

  const selectTerminal = (terminal) => {
    window.open(`/#/terminal/${terminal.id}`, '_blank');
  };
</script>
