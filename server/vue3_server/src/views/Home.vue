<template>
  <v-row
    no-gutters
  >
    <v-col
      ref="terminalCol"
      cols="12" md="7" lg="7" xl="7"
    >
      <div style="color: red;">{{ error }}</div>
      <TabTerminals
        ref="terminals"
        @selected="terminalSelected"
        @error="showError"
      />
    </v-col>
    <v-col
      cols="12" md="5" lg="5" xl="5"
    >
     <TargetsCard
       class="mr-1"
       color="yellow-lighten-4"
       style="height: 50vh; overflow-y: auto;"
       @selected="(target) => candidatesCard.setTarget(target.id)"
     />
     <CandidatesCard
       ref="candidatesCard"
       class="mr-1"
       color="green-lighten-4"
       style="height: 50vh; overflow-y: auto;"
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
  const terminalCol = ref();
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

</script>
