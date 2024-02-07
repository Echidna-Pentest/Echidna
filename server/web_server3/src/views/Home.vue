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
      <v-card
        class="targettree mr-4"
        color="yellow-lighten-4"
        ref="targetsCard"
        style="height: 50vh; overflow-y: auto;"
        scrollable
        outlined
      >
        <v-card-title>
          <div
            class="d-flex flex-row align-center"
          >
            Targets:
            <TargetSearch
              @search="searchTarget"
            />
            <TargetExport />
          </div>
        </v-card-title>
        <v-card-text>
          <TargetTree
            ref="targetTree"
            @selected="selectedTarget"
          />
        </v-card-text>
      </v-card>
      <v-card
        title="Candidate commands:"
        class="candidatecommand mr-4"
        ref="candidatesCard"
        color="green-lighten-4"
        style="height: 50vh; overflow-y: auto;"
        scrollable
        outlined
      >
        <v-card-text >
          <Candidates
            ref="candidates"
            @selected="executeCommand"
          />
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <LogArchive />
  <ChatBot />
</template>

<script setup>
  import TabTerminals from '@/components/TabTerminals.vue';
  import TargetSearch from '@/components/TargetSearch.vue'
  import TargetExport from '@/components/TargetExport.vue'
  import TargetTree from '@/components/TargetTree.vue'
  import Candidates from '@/components/Candidates.vue'
  import LogArchive from '@/components/LogArchive.vue'
  import ChatBot from '@/components/ChatBot.vue'
  import { ref } from 'vue';

  const terminalsDiv = ref();
  const terminals = ref();
  const targetsCard = ref();
  const targetTree = ref();
  const candidatesCard = ref();
  const candidates = ref();
  const error = ref('');

  const terminalSelected = (terminal) => {
    document.title = terminal.name + ' - Echidna';
  };

  const searchTarget = (text) => targetTree.value.setFilter(text);

  const selectedTarget = (target) => {
    candidates.value.setTarget(target.id);
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
