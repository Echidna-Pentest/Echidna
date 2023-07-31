<template>
  <v-list
    class="overlflow-x-auto overflow-y-auto"
    max-height="430"
    outlined
    rounded
    dense
  >
    <v-list-item-group v-model="select" color="pink">
      <v-list-item
        v-for="(history, index) in histories"
        :key="index"
        @click="selected(history, index)"
      >
        <v-tooltip top>
          <template v-slot:activator="{ on }">
            <v-list-item-content v-on="on">
              <v-list-item-title>{{ history.command }}</v-list-item-title>
            </v-list-item-content>
          </template>
          <span>{{ history.date }}</span>
        </v-tooltip>
      </v-list-item>
    </v-list-item-group>
  </v-list>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  name: 'HistoryCommands',
  data: () => ({
    terminalId: 0,
    lastLogId: -1,
    logs: [],
    select: undefined,
    historiesIndex: undefined,
    histories: [],
  }),
  title() {
    return `${this.terminalName} hisotry`;
  },
  mounted() {
    echidna.on('logs', () => this.updateLogs());
    this.updateLogs();
  },
  methods: {
    selectTerminal(terminal) {
      this.terminalId = terminal.id;
      this.lastLogId = -1;
      this.logs = [];
      this.historiesIndex = undefined;
      this.select = undefined;
      this.$set(this, 'histories', []);
      this.$emit('selected', {});
      this.updateLogs();
    },
    updateLogs() {
      echidna
        .logs(this.terminalId, this.lastLogId + 1)
        .then(({ data: logs }) => {
          if (logs.length) {
            this.logs = [...this.logs, ...logs];
            this.lastLogId = logs.slice(-1)[0].id;
          }
          this.updateHistories();
        })
        .catch((error) => {
          console.log(`ERROR: update history logs: ${error}`);
        });
    },
    updateHistories() {
      const histories = this.logs
        ?.filter((log) => log.seqId == 1 && log.command.match(/.*(\r|\n)$/))
        .map((log) => ({
            command: log.command.trim(),
            date: new Date(log.date).toLocaleString(),
            logsIndex: this.logs.indexOf(log),
          })
        );
      this.$set(this, 'histories', histories);
    },
    selected(history, index) {
      if (index === this.historiesIndex) {  // select off
        this.$emit('selected', {});
        return;
      }
      this.historiesIndex = index;
      let seqId = 0;
      let output = '';
      for (const log of this.logs.slice(history.logsIndex)) {
        if (log.seqId < seqId) break;
        seqId = log.seqId + 1;
        output += log.output;
      }
      this.$emit('selected', {...history, output});
    },
  },
};
</script>
