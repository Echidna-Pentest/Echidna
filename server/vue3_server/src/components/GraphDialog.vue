<template>
  <v-dialog
    v-model="dialog"
  >
    <v-row
      no-gutters
    >
      <v-col
        id="targetDialog"
        cols="6"
      >
        <v-card
          title="Child Nodes"
          max-height="95vh"
          class="overflow-y-auto"
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

      <v-col
        cols="6"
      >
        <v-row
          no-gutters
        >
          <v-col
            cols="12"
            v-show="showCommand"
            id="commandDialog"
          >
            <CandidatesCard
              ref="graphcandidate"
              title="Candidate Command"
              class="candidatecommand overflow-y-auto"
              max-height="30vh"
              color="green-lighten-4"
              @selected="selectedCommand"
              scrollable
              outlined
            />
          </v-col>
          <v-col
            cols="12"
            v-show="showTerminal"
            id="terminalDialog"
          >
            <v-card>
              <Terminal
                ref="terminal"
                style="height: 65vh;"
              />
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-dialog>
</template>

<script setup>
  import GraphTargetTree from "@/components/GraphTargetTree.vue";
  //import GraphCandidate from '@/components/GraphCandidate.vue';
  import CandidatesCard from "@/components/CandidatesCard.vue";
  //import GraphTerminal from '@/components/GraphTerminal.vue';
  import Terminal from '@/components/Terminal.vue';
  import { ref } from 'vue';
  
  const targettree = ref();
  const graphcandidate = ref();
  const terminal = ref();

  const dialog = ref(false);
  const showCommand = ref(false);
  const showTerminal = ref(false);

  let terminalId = 1;

  const show = (targetId) => {
    if (targetId == undefined) return;
    dialog.value = true;
    showCommand.value = false;
    showTerminal.value = false;
    setTimeout(() => {
      targettree.value.changeRoot(targetId);
    }, 300);
  };

  const selectedTarget = (target) => {
    showCommand.value = true;
    graphcandidate.value.setTarget(target.id);
  };

  const selectedCommand = (command) => {
    showTerminal.value = true;
    terminal.value.selectTerminal(terminalId);
    terminal.value.executeCommand(command, true);
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
