<template>
  <v-card
    class="mr-auto ml-5"
    flat
  >
    <v-row>
      <v-col>
        <TerminalsTab @selected="selectedTerminal" />
      </v-col>
    </v-row>
    <v-row
      style="height: 700px"
      dense
    >
      <v-col cols="4">
        <HistoryCommands
          ref="history"
          @selected="selectedHistory"
        />
      </v-col>
      <v-col>
        <div
          id="terminalLog"
          style="height: 700px"
        />
      </v-col>
    </v-row>
  </v-card>
</template>

<script setup>
  import TerminalsTab from '@/components/TerminalsTab.vue';
  import HistoryCommands from '@/components/HistoryCommands.vue';
  import '@xterm/xterm/css/xterm.css';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { ref, onMounted } from 'vue';
  
  const history = ref();
  let terminal = new Terminal({
    theme: {
      background: '#391919',
    }
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  
  onMounted(() => {
    terminal.open(document.getElementById('terminalLog'));
    fitAddon.fit();
  });
  
  const selectedTerminal = (terminal) => {
    history.value.selectTerminal(terminal);
    document.title = `${terminal.name} hisotry`;
  };
  
  const selectedHistory = (command) => {
    terminal.reset();
    if (command.output) {
      terminal.write(command.output);
    }
  };

</script>
