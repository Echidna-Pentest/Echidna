<template>
  <v-card class="mr-auto ml-5" flat>
    <v-row>
      <v-col>
        <TerminalsTab @selected="selectedTerminal"></TerminalsTab>
      </v-col>
    </v-row>
    <v-row style="height: 700px" dense>
      <v-col cols="4">
        <HistoryCommands ref="history" @selected="selectedHistory"></HistoryCommands>
      </v-col>
      <v-col>
        <div id="terminalLog" style="height: 700px"></div>
      </v-col>
    </v-row>
  </v-card>
</template>

<script>
import TerminalsTab from '@/components/TerminalsTab.vue';
import HistoryCommands from '@/components/HistoryCommands.vue';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
export default {
  name: 'History',
  components: {
    TerminalsTab,
    HistoryCommands,
  },
  data: () => ({
    terminalId: 0,
    select: undefined,
    terminal: undefined,
  }),
  title() {
    return `${this.terminalName} hisotry`;
  },
  mounted() {
    const fitAddon = new FitAddon();
    this.terminal = new Terminal({
      theme: {
        background: '#391919',
      }
    });
    this.terminal.loadAddon(fitAddon);
    this.terminal.open(document.getElementById('terminalLog'));
    fitAddon.fit();
    function onSize() {
      fitAddon.fit(); // note: fitAddon.proposeDimensions() only will produce the correct result
    }
    onSize();
  },
  methods: {
    selectedTerminal(terminal) {
      this.$refs.history.selectTerminal(terminal);
    },
    selectedHistory(command) {
      this.terminal.reset();
      if (command.output) {
        this.terminal.write(command.output);
      }
    },
  },
};
</script>
