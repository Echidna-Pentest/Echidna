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
          style="height: 95vh; overflow-y: auto;"
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
              class="candidatecommand"
              style="height: 30vh; overflow-y: auto;"
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
            <v-card
              style="height: 65vh;"
            >
              <Terminal
                ref="terminal"
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
  import CandidatesCard from "@/components/CandidatesCard.vue";
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
    setTimeout(() => {  // delay is needed to determine component size after show
      terminal.value.selectTerminal(terminalId);
      terminal.value.executeCommand(command, true);
    }, 300);
  };

  defineExpose({
    show,
  });

</script>

<style>
.v-dialog {
  overflow-y: hidden;
}
</style>
