<template>
  <div 
    @paste="handlePaste"
    >
  <v-card  class="mr-auto" outlined>
    <div id="terminal" style="height: 900px"></div>
    <v-row v-show="false">
      <v-col>
        <v-text-field>{{ terminalId }}</v-text-field>
      </v-col>
      <v-col>
        <v-text-field>{{ targetId }}</v-text-field>
      </v-col>
      <v-col>
        <v-text-field>{{ command }}</v-text-field>
      </v-col>
    </v-row>
  </v-card>
  </div>
</template>

<script>
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
const fitAddon = new FitAddon();
export default {
  name: "Terminal",
  data: () => ({
    terminal: null,
    terminalId: 0,
    terminalName: '',
    lastLogId: -1,
    requesting: false,
    pending: false,
    targetId: 0,
    command: '',
  }),
  title() {
    return this.terminalName;
  },
  mounted() {
    console.log("GraphTerminal mount");
    this.terminal = new Terminal();
    this.terminal.loadAddon(fitAddon);
    this.terminal.open(document.getElementById('terminal'));
    fitAddon.fit();
    this.terminal.onKey((event) => {
      console.log("event=", event, " this.terminalId=", this.terminalId);
      if (event.domEvent.code == 'KeyV' && event.domEvent.ctrlKey) {  //Paste Event
        navigator.clipboard.readText()
          .then(text => {
            echidna
              .keyin(this.terminalId, text, this.targetId)
              .catch((error) => {
                console.log(error);
              });
            //      }
          })
        return false;
      }
      echidna
        .keyin(this.terminalId, event.key, this.targetId)
        .catch((error) => {
          console.log(error);
        });
    });
    echidna.on('logs', this.logsEventListener);
//    echidna.on('terminals', this.terminalsEventListener);
    if (this.$route.params.id) {
        this.selectTerminal(this.$route.params.id);
    }
  },
  methods: {
    adjustDivHeight() {
      var div = document.getElementById('terminal');
      var rect = div.getBoundingClientRect();
      var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      var remainingHeight = viewHeight - rect.top -10;
      div.style.height = remainingHeight + "px";
      fitAddon.fit();
    }, 
    handlePaste(event) {
      console.log("handlePaste");
      const text = event.clipboardData.getData('Text');    
      echidna.keyin(this.terminalId, text, this.targetId)
        .catch((error) => {
          console.log(error);
        });
    },
    selectTerminal(terminalId) {
      this.adjustDivHeight();
      this.terminal.reset();
      this.terminalId = terminalId;
      this.updateTerminal();
      this.lastLogId = -1;
      if (!terminalId) return;
      this.updateLog();
      const cols = this.terminal.cols;
      const rows = this.terminal.rows;
      echidna
        .resizeTerminal(terminalId, cols, rows)
        .then(({ data: terminal }) => {
          console.debug("terminal=", terminal);
        })
    },
    updateTargetId(targets) {
      this.targetId = (targets.length) ? targets[targets.length - 1].id : 0;
    },
    executeCommand(command) {
      console.log("executeCommand=", command);
      echidna
        .keyin(this.terminalId, command, this.targetId)
        .catch((error) => {
          console.log(error);
        });
    },
    terminalsEventListener() {
      this.updateTerminal();
    },
    updateTerminal() {
      echidna
        .terminals()
        .then(({ data: terminals}) => {
          terminals
            .filter((terminal) => terminal.id == this.terminalId)
            .forEach((terminal) => this.changeTerminalName(terminal.name));
        })
        .catch((error) => {
          console.log(`ERROR: update title : ${error}`);
        });
    },
    changeTerminalName(name) {
        this.$set(this, 'terminalName', name);
        document.title = name + ' - Echidna';
    },
    updateLog() {
      if (this.requesting) {
        this.pending = true;
        return;
      }
      this.pending = false;
      this.requesting = true;
      let output = "";
      echidna
        .logs(this.terminalId, this.lastLogId + 1)
        .then(({ data: logs }) => {
          logs
            ?.filter((log) => log.id > this.lastLogId)
            .forEach((log) => {
              output += log.output;
              this.lastLogId = log.id;
            });
          const MAX_OUTPUT_LENGTH = 300000;       // limit the terminal output length 
          if (output.length > MAX_OUTPUT_LENGTH) {
            output = output.slice(-MAX_OUTPUT_LENGTH);
          }
          this.terminal.write(output);
          this.requesting = false;
          if (this.pending) {
            this.updateLog();
          }
        })
        .catch((error) => {
          console.log(`ERROR: update log : ${error}`);
        });
    },
    logsEventListener(event) {
      if (event.terminalId != this.terminalId) return;
      this.updateLog();
    },
  },
};
</script>
