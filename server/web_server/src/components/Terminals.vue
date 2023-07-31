<template>
  <v-container>
    <TerminalNames @selected="selectTerminal"></TerminalNames>
  </v-container>
</template>

<script>
import TerminalNames from '@/components/TerminalNames.vue';
export default {
  name: 'TerminalList',
  components: {
    TerminalNames,
  },
  methods: {
    selectTerminal(terminal) {
      window.open(`/#/terminal/${terminal.id}`, '_blank');
    },
  },
};
</script>
