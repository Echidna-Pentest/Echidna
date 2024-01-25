<template>
  <v-container>
    <TerminalAdd />
    <TerminalNames @selected="selectTerminal" />
  </v-container>
</template>

<script>
import TerminalAdd from '@/components/TerminalAdd.vue';
import TerminalNames from '@/components/TerminalNames.vue';
export default {
  name: 'TerminalList',
  components: {
    TerminalAdd,
    TerminalNames,
  },
  methods: {
    selectTerminal(terminal) {
      window.open(`/#/terminal/${terminal.id}`, '_blank');
    },
  },
};
</script>
