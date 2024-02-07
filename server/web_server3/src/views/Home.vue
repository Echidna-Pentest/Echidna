<template>
  <v-row
    class="mr-auto ma-n2 pa-0"
    style="min-width: 500px; max-height: 980px;"
    v-resize="onResize"
    no-gutters
  >
    <v-col
      class="ma-n1 pa-0"
    >
      <div
        ref="terminalsDiv"
        id="terminals"
      >
        <div style="color: red;">{{ error }}</div>
        <TabTerminals
          ref="terminals"
          @selected="terminalSelected"
          @error="showError"
        />
      </div>
    </v-col>
    <v-col
      class="ma-n1 pa-0"
    >
      <TargetsCard
        @selected="(target) => candidatesCard.setTarget(target.id)"
      />
      <CandidatesCard
        ref="candidatesCard"
        @selected="executeCommand"
      />
    </v-col>
  </v-row>
  <LogArchive />
  <ChatBot />
</template>

<script setup>
  import TabTerminals from '@/components/TabTerminals.vue';
  import TargetsCard from '@/components/TargetsCard.vue'
  import CandidatesCard from '@/components/CandidatesCard.vue'
  import LogArchive from '@/components/LogArchive.vue'
  import ChatBot from '@/components/ChatBot.vue'
  import { ref } from 'vue';

  const terminalsDiv = ref();
  const terminals = ref();
  const targetsCard = ref();
  const candidatesCard = ref();
  const error = ref('');

  const terminalSelected = (terminal) => {
    document.title = terminal.name + ' - Echidna';
    candidatesCard.value.setTerminal(terminal.id);
  };

  const executeCommand = (command) => {
    const regexp = /ipad|android/;
    const appendNewline = regexp.test(navigator.userAgent.toLowerCase());
    terminals.value.executeCommand(command, appendNewline);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(command);
    } else {
      document.execCommand('copy');
    }
  };

  const adjustTerminalSize = () => {
    //const viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
    //const desiredWidth = Math.max(viewWidth * 0.6, 500);
    //terminalsDiv.value.style.width = desiredWidth + "px";
    //terminals.value.fit();
    //return desiredWidth;
  };

  const showError = (message) => {
    error.value = message;
    setTimeout(() => { error.value = ""; }, 5000);
  };

  const onResize = () => {
    adjustTerminalSize()
  }

</script>
