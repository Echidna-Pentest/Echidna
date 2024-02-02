<template>
  <div
    v-resize="onResize"
  >
    <v-row
      class="mr-auto ma-n2 pa-0"
      no-gutters
    >
      <v-col
        class="ma-n1 pa-0"
        style="min-width: 500px; max-height: 980px;"
      >
        <div
          ref="terminalsDiv"
          id="terminals"
        >
          <div style="color: red;">{{ error }}</div>
          <TabTerminals
            ref=terminals
            @selected="terminalSelected"
            @error="showError"
          />
        </div>
      </v-col>
      <v-col
        style="min-width: 500px; max-height: 980px;"
      >
        <v-card
          class="targettree"
          color="yellow-lighten-4"
          ref=targetsCard
          style="height: 60vh"
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
              ref=targetTree
              @selected="selectedTarget"
              style="height: 45vh; overflow-y: auto;"
            />
          </v-card-text>
        </v-card>
        <v-card
          class="candidatecommand"
          ref=candidatesCard
          color="green-lighten-4"
          style="height: 40%"
          scrollable
          outlined
        >
          <v-card-title>
            Candidate commands:
          </v-card-title>
          <v-card-text >
            <div
              style="height: 30vh; overflow-y: auto;"
            >
              <Candidates
                ref=candidates
                @selected=executeCommand
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <LogArchive />
    <ChatBot />
  </div>
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

  const adjustTargetTreeSize = (terminalWidth) => {
    //const wtargetsTop = targettreeCard.$el.clientTop;
    //const width = window.innerWidth - terminalWidth - 10;
    //const height = (window.innerHeight - wtargetsTop) / 2 - 10;
    //targetsCard.$el.style.width = `${width}px`;
    //candidatesCard.$el.style.width = `${width}px`;
    //targetsCard.$el.style.height = `${height}px`;
    //candidatesCard.$el.style.height = `${height}px`;
  };

  const showError = (message) => {
    error.value = message;
    setTimeout(() => { error.value = ""; }, 5000);
  };

  const onResize = () => {
    adjustTerminalSize()
    adjustTargetTreeSize();
  }

</script>
