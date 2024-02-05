<template>
  <v-dialog
    v-model="dialog"
    style="max-width: 95vw; max-height: 95vh;"
  >
    <v-row
      class="mr-auto ma-n2 pa-0"
    >
      <v-col
        id="targetDialog"
        cols="6"
        class="ma-0 pa-0 overflow-y-auto"
      >
        <v-card
          title="Child Nodes"
          color="yellow-lighten-4"
        >
          <v-card-text>
            <GraphTargetTree
              ref="targettree"
              @selected="selectedTarget"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6">
        <v-row>
          <v-col
            v-show="commandDialog"
            id="commandDialog"
            v-resize="onResize"
            class="ma-0 pa-0 overflow-y-auto"
          >
            <v-card
              title="Candidate Command"
              class="candidatecommand"
              ref="candidateCard"
              color="green-lighten-4"
              scrollable
              outlined
            >
              <v-card-text>
                <div
                  style="height: 30vh; overflow-y: auto;"
                >
                  <Candidates
                    ref="graphcandidate"
                    @selected="selectedCommand"
                  />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <v-col
            v-show="terminalDialog"
            id="terminalDialog"
            class="ma-0 pa-0"
          >
            <Terminal
              ref="terminal"
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-dialog>
</template>

<script setup>
  import GraphTargetTree from "@/components/GraphTargetTree.vue";
  //import GraphCandidate from '@/components/GraphCandidate.vue';
  import Candidates from "@/components/Candidates.vue";
  //import GraphTerminal from '@/components/GraphTerminal.vue';
  import Terminal from '@/components/Terminal.vue';
  import { ref } from 'vue';
  
  const candidateCard = ref();
  const targettree = ref();
  const graphcandidate = ref();
  const terminal = ref();

  const dialog = ref(false);
  const commandDialog = ref(false);
  const terminalDialog = ref(false);

  let terminalId = 1;

  const show = (targetId) => {
    if (targetId == undefined) return;
    dialog.value = true;
    setTimeout(() => {
      console.debug("targettree", targettree);
      targettree.value.changeRoot(targetId);
    }, 300);
  };

  const selectedTarget = (target) => {
    commandDialog.value = true;
    graphcandidate.value.setTarget(target.id);
  };

  const selectedCommand = (command) => {
    terminalDialog.value = true;
    terminal.value.selectTerminal(terminalId);
    terminal.value.executeCommand(command, true);
  };

  const onResize = () => {
    //      const terminalSize = adjustTerminalSize();
    //      adjustTargetTreeSize(terminalSize);
  };

  defineExpose({
    show,
  });

</script>

<style>
.v-dialog {
  overflow-y: hidden;
}

.custom-dialog .v-dialog__content {
  width: 50% !important;
  max-width: 50% !important;
  left: 0 !important;
  position: fixed !important;
  top: 0 !important;
  bottom: 0 !important;
}
</style>
