<template>
  <v-container>
<!--    <TerminalsTab @selected="selected"></TerminalsTab>-->
    <TerminalsTabPlus @selected="selected"></TerminalsTabPlus>
    <Terminal ref="terminal"></Terminal>
  </v-container>
</template>

<script>
//import TerminalsTab from '@/components/TerminalsTab.vue';
import TerminalsTabPlus from '@/components/TerminalsTabPlus.vue';
import Terminal from '@/components/Terminal.vue';
export default {
  name: 'TabTerminals',
  components: {
//    TerminalsTab,
    TerminalsTabPlus,
    Terminal,
  },
  methods: {
    selected(terminal) {
      this.$emit('selected', terminal);
      this.$refs.terminal.selectTerminal(terminal.id);
    },
    executeCommand(command) {
      this.$refs.terminal.executeCommand(command);
    },
  },
};
</script>
