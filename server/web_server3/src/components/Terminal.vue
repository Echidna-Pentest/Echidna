<template>
  <div 
    @paste="handlePaste"
  >
    <v-card
      class="mr-auto"
      variant="outlined"
    >
      <div
        id="terminal"
        style="height: 900px"
      />
    </v-card>
  </div>
</template>

<script setup>
import "xterm/css/xterm.css";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { onMounted, inject } from "vue";

const { id = 1 } = defineProps(["id"]);
const emits = defineEmits(["name"]);

const echidna = inject("$echidna");
const terminal = new Terminal()
const fitAddon = new FitAddon();

let terminalId = 1;
let targetId = 0;
let lastLogId = -1;
let requesting = false;
let pending = false;

onMounted(() => {
  terminalId = id;
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById('terminal'));
  fitAddon.fit();
  terminal.onKey((event) => {
    if (event.domEvent.code == "KeyV" && event.domEvent.ctrlKey) {  //Paste Event
      return navigator.clipboard.readText()
        .then(text => {
          return echidna
            .keyin(terminalId, text, targetId)
            .catch((error) => console.error("terminal.paste:", error));
        });
    }
    return echidna
      .keyin(terminalId, event.key, targetId)
      .catch((error) => console.error("Terminal.onMount:", error));
  });
  echidna.on("logs", logsEventListener);
  // echidna.on("terminals", updateTerminal);
  return selectTerminal(id);
});

const fit = () => {
  fitAddon.fit();
};

const adjustHeight = () => {
  let div = document.getElementById('terminal');
  let rect = div.getBoundingClientRect();
  let viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
  let remainingHeight = viewHeight - rect.top -10;
  div.style.height = remainingHeight + "px";
  fitAddon.fit();
};

const handlePaste = (event) => {
  console.debug("handlePaste");
  const text = event.clipboardData.getData("Text");    
  return echidna
    .keyin(terminalId, text, targetId)
    .catch((error) => console.error("Terminal.handlePaste:", error));
};

const selectTerminal = (id) => {
  //console.debug("Terminal.selectTerminal:", id);
  adjustHeight();
  terminal.reset();
  terminalId = id;
  updateTerminal();
  lastLogId = -1;
  if (id <= 0) return;
  updateLog();
  const cols = terminal.cols;
  const rows = terminal.rows;
  return echidna.resizeTerminal(id, cols, rows);
};

const executeCommand = (command, appendNewLine=false) => {
  return echidna
    .keyin(terminalId, command + (appendNewLine ? "\n" : ""), targetId)
    .catch((error) => console.error("Terminal.executeCommand:", error));
};

const updateTerminal = () => {
  return echidna
    .terminals()
    .then(({ data: terminals }) => {
      terminals
        .filter((terminal) => terminal.id == terminalId)
        .forEach((terminal) => emits("name", terminal.name));
    })
    .catch((error) => {
      console.error("Terminal.updateTerminal:", error);
    });
};

const updateLog = () => {
  if (requesting) {
    pending = true;
    return;
  }
  pending = false;
  requesting = true;
  let output = "";
  return echidna
    .logs(terminalId, lastLogId + 1)
    .then(({ data: logs }) => {
      logs
        ?.filter((log) => log.id > lastLogId)
        .forEach((log) => {
          output += log.output;
          lastLogId = log.id;
        });
      const MAX_OUTPUT_LENGTH = 300000;       // limit the terminal output length 
      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(-MAX_OUTPUT_LENGTH);
      }
      terminal.write(output);
      requesting = false;
      if (pending) {
        updateLog();
      }
    })
    .catch((error) => {
      console.error("Terminal.updateLog:", error);
    });
};

const logsEventListener = (event) => {
  if (event.terminalId != terminalId) return;
  return updateLog();
};

defineExpose({
  fit,
  selectTerminal,
  executeCommand,
});
</script>
