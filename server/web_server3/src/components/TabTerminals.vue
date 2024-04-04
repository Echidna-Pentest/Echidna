<template>
  <div>
    <!--    <TerminalsTab @selected="selected"></TerminalsTab>-->
    <TerminalsTabPlus
      @selected="selected"
      @error="showError"
    />
    <Terminal
      ref="terminal"
    />
  </div>
</template>

<script setup>
import TerminalsTabPlus from '@/components/TerminalsTabPlus.vue';
import Terminal from '@/components/Terminal.vue';
import { ref } from 'vue';

const terminal = ref();
const emits = defineEmits(['selected', 'error']);

const selected = (term) => {
  emits('selected', term);
  terminal.value.selectTerminal(term?.id);
};

const executeCommand = (command, appendNewline=false) => {
  terminal.value.executeCommand(command, appendNewline);
};

const showError = (message) => {
  emits('error', message);
};

defineExpose({
  executeCommand,
});
</script>
