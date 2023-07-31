<template>
  <v-row style="height: 480px">
    <v-col>
      <v-list
        class="overlflow-x-auto overflow-y-auto"
        max-height="430"
        outlined
        rounded
        dense
      >
        <v-list-item-group v-model="select" color="pink">
          <v-list-item
            v-for="(command, index) in histories"
            :key="index"
            @click="selected(command, index)"
          >
            <v-tooltip top>
              <template v-slot:activator="{ on }">
                <v-list-item-content v-on="on">
                  <v-list-item-title>{{ command.command }}</v-list-item-title>
                </v-list-item-content>
              </template>
              <span>{{ command.date }}</span>
            </v-tooltip>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-col>
    <v-col>
      <div id="terminalLog"></div>
    </v-col>
  </v-row>
</template>

<script>
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  data: () => ({
    logs: [],
    histories: [],
    terminalId: 0,
    terminals: [],
    select: undefined,
    log: null,
  }),
  title() {
    return this.terminalName;
  },
  mounted() {
    this.log = new Terminal({
      theme: {
        background: '#391919',
      }
    });
    this.log.open(document.getElementById('terminalLog'));
    echidna.on('logs', this.logsEventListener);
  },
  methods: {
    selectTerminal(terminalId) {
      this.terminalId = terminalId;
      this.updateHistories();
    },
    updateHistories() {
      echidna
        .logs(this.terminalId)
        .then(({ data: logs }) => {
          let histories = [];
          logs
            ?.filter((log) => log.seqId == 1 && log.command.match(/.*(\r|\n)$/))
            .forEach((log) => {
              let command = {
                command: log.command.trim(),
                date: new Date(log.date).toLocaleString(),
                logsIndex: logs.indexOf(log),
              };
              histories.push(command);
            });
          this.$set(this, 'logs', logs);
          this.$set(this, 'histories', histories);
        })
        .catch((error) => {
          console.log(`ERROR: update history : ${error}`);
        });
    },
    selected(command, index) {
      this.log.reset();
      if (index === this.select) return; // select off
      let seqId = 0;
      for (let i = command.logsIndex; i < this.logs.length; i++) {
        if (seqId >= this.logs[i].seqId) break;
        seqId = this.logs[i].seqId;
        this.log.write(this.logs[i].output);
      }
    },
    logsEventListener(event) {
      if (event.terminalId != this.terminalId) return;
      this.updateHistories();
    },
  },
};
</script>
