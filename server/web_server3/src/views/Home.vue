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
        style="height: 50vh; overflow-y: auto;"
        color="yellow-lighten-4"
        @selected="(target) => candidatesCard.setTarget(target.id)"
      />
      <CandidatesCard
        style="height: 50vh; overflow-y: auto;"
        color="green-lighten-4"
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

  const terminals = ref();
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

  const showError = (message) => {
    error.value = message;
    setTimeout(() => { error.value = ""; }, 5000);
  };

  const onResize = () => {
    terminals.value.fit();
  }

</script>
