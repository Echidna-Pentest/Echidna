<template>
  <div 
    @paste="handlePaste"
    v-resize="adjustHeight"
  >
    <v-sheet
      class="mr-auto"
      variant="outlined"
    >
      <div
        ref="terminalDiv"
        id="terminal"
      />
    </v-sheet>
  </div>
</template>

<script setup>
import "@xterm/xterm/css/xterm.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ref, onMounted, inject } from "vue";

const { id = 1 } = defineProps(["id"]);
const terminalDiv = ref();
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
  return selectTerminal(id);
});

const adjustHeight = () => {
  const rect = terminalDiv.value.getBoundingClientRect();
  const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
  terminalDiv.value.style.height = (viewHeight - rect.top) + "px";
  fitAddon.fit();
};

const handlePaste = (event) => {
  const text = event.clipboardData.getData("Text");    
  return echidna
    .keyin(terminalId, text, targetId)
    .catch((error) => console.error("Terminal.handlePaste:", error));
};

const selectTerminal = (id) => {
  terminal.reset();
  terminalId = id;
  updateTerminal();
  lastLogId = -1;
  if (id <= 0) return;
  updateLog();
  adjustHeight();
  return echidna.resizeTerminal(id, terminal.cols, terminal.rows);
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
  adjustHeight,
  selectTerminal,
  executeCommand,
});
</script>
