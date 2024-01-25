<template>
  <div>
    <div
      ref="networkContainer"
      style="width: 95vw; height: 95vh"
    />
    <v-dialog
      v-model="dialog"
      :style="{ maxWidth: '95vw', height: '100vh' }"
    >
      <v-row no-gutters>
        <v-col
          id="targetDialog"
          cols="6"
          class="ma-0 pa-0 overflow-y-auto"
          style="max-height: 100vh"
        >
          <v-card>
            <v-card-title>Child Nodes</v-card-title>
            <v-card-text>
              <Tree
                v-model:open="open"
                :open-all="true"
                activatable
                :active="active"
                :items="targets"
                return-object
                dense
                item-text="value"
                item-key="id"
                hoverable
                @update:active="selected"
              >
                <template #label="{ item }">
                  <v-list-item-title>{{ item.value }}</v-list-item-title>
                </template>
              </Tree>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-col
            v-show="commandDialog"
            id="commandDialog"
            v-resize="onResize"
            class="ma-0 pa-0 overflow-y-auto"
            style="max-height: 31vh; max-width: 50vw"
          >
            <v-card
              ref="candidateCard"
              class="overflow-x-auto candidatecommand"
              variant="outlined"
            >
              <v-card-title>Candidate Command</v-card-title>
              <v-card-text>
                <Candidates
                  ref="graphcandidate"
                  @selected="selectCommand"
                />
              </v-card-text>
            </v-card>
          </v-col>

          <v-col
            v-show="terminalDialog"
            id="terminalDialog"
            class="ma-0 pa-0"
            style="max-height: 40vh; max-width: 50vw"
          >
            <Terminal
              ref="terminal"
              @selected="selectCommand"
            />
          </v-col>
        </v-col>
      </v-row>
    </v-dialog>
  </div>
</template>

<script setup>
  import { Network, DataSet } from "vis-network/standalone/esm/vis-network.min.js";
  //import GraphCandidate from '@/components/GraphCandidate.vue';
  import Candidates from "@/components/Candidates.vue";
  //import GraphTerminal from '@/components/GraphTerminal.vue';
  import Terminal from '@/components/Terminal.vue';
  import Tree from 'vue3-treeview';
  import { ref, reactive, inject, onMounted } from 'vue';
  
  const candidateCard = ref();
  const networkContainer = ref();
  const graphcandidate = ref();
  const terminal = ref();

  const echidna = inject("$echidna");

  const targets = reactive([{ id: 0, name: "targets", parent: null, children: [] }]);
  const dialog = ref(false);
  const open = ref([]);
  const commandDialog = ref(false);
  const terminalDialog = ref(false);

  let network = null;
  let selectedChildren = [];

  let terminalId = 0;
  let active = [];
  let clickedId = 0;

  onMounted(() => {
    updateTargets();
  //  echidna.on("targets", showDialog(targets));
    echidna.on("targets", () => {
      echidna.getAllChildren(clickedId).then(({ data: childtarget }) => {
      // get all children of the clicked node and draw by v-treeview
        targets.splice(0, 1, convertTargets(childtarget));
        showDialog(targets);
      });
    });
    handleItemSelected(1);
  });

  const showDialog = (children) => {
    selectedChildren = children;
    dialog.value = true;
  };

  const handleItemSelected = (selectedItemIds) => {
    const selectedItems = selectedChildren.filter((child) =>
      selectedItemIds.includes(child.id),
    );
    console.debug("Selected items:", selectedItems);
  };

  const updateTargets = () => {
    return echidna
      .targets()
      .then(({ data: newTargets }) => {
        targets.splice(0, targets.length);
        drawTargets(newTargets);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const selected = (targets) => {
    commandDialog.value = true;
    graphcandidate.value.updateCandidatesFromGraph(targets);
    return echidna
      .terminals()
      .then(({ data: terminals }) => {
//        console.log("terminals=", terminals);
        const graphItem = terminals.find(item => item.name == "graphterm");
        if (graphItem) {
            terminalId = graphItem.id;
        } else {
            console.debug("Name 'graphterm' not found.");
        }
      })
      .catch((error) => {
        console.log(`ERROR: update terminal tabs : ${error}`);
      });
  };

  const selectCommand = (command) => {
    terminalDialog.value = true;
    //terminal.value.addTerminal();
    if (terminalId == 0){
      terminalDialog.value = true;
      echidna.addTerminal("graphterm")
        .then(({ data: id }) => {
          terminalId = id.id;
          console.log("terminalId=", terminalId);
          terminal.value.selectTerminal(terminalId);
          terminal.value.executeCommand(command, true);
      })
        .catch((error) => {
          console.log(error);
        });
      }else{
        console.log("terminalId=", terminalId);
        terminal.value.selectTerminal(terminalId);
        terminal.value.executeCommand(command, true);
      }
  };

  const drawTargets = (targets) => {
    const rootIds = targets
      .filter((node) => node.value === "host" || node.parent === -1)
      .map((node) => node.id);
    const directChildrenIds = targets
      .filter((node) => rootIds.includes(node.parent))
      .map((node) => node.id);
    const allowedIds = [...rootIds, ...directChildrenIds]; // Render target up to parent element is "host"

    const filteredJsonData = targets.filter((node) => {
      if (node.id === 3) return false; // skip local host (kali) information
      if (node.value === "host" && !targets.some((n) => n.parent === node.id))
        return false;
      return allowedIds.includes(node.id);
    });

    const nodes = new DataSet(
      filteredJsonData.map((node) => {
        const isChildOfHost = targets.some(
          (n) => n.id === node.parent && n.value === "host",
        );
        if (isChildOfHost) {
          // use image icon if the node is child of host
          let icon;
          if (node.metadata.os === "Windows") {
            icon = "icons8-windows-100.png";
          } else if (node.metadata.os === "Linux") {
            icon = "icons8-linux-48.png";
          } else {
            icon = "icons8-server-50.png";
          }
          if (node.metadata.root == "yes") {
            return {
              id: node.id,
              label: node.value,
              font: { color: "red" },
              shape: "image",
              image: icon,
            };
          } else {
            return {
              id: node.id,
              label: node.value,
              font: { color: "black" },
              shape: "image",
              image: icon,
            };
          }
        } else {
          return {
            id: node.id,
            label: node.value,
          };
        }
      }),
    );

    let edgesArray = [];
    filteredJsonData.forEach((node) => {
      node.children.forEach((childId) => {
        if (allowedIds.includes(childId)) {
          edgesArray.push({ from: node.id, to: childId });
        }
      });
    });
    let edges = new DataSet(edgesArray);

    const container = networkContainer.value;
    const data = { nodes, edges };
    const options = {};

    network = new Network(container, data, options);

    network.on("click", (properties) => {
      setTimeout(() => {
        properties.event.preventDefault();
        if (properties.nodes[0] == undefined) {
          // return if the empty space is clicked
          return;
        }
        clickedId = properties.nodes[0];
        echidna.getAllChildren(clickedId).then(({ data: childtarget }) => {
          // get all children of the clicked node and draw by v-treeview
          targets.splice(0, 1, convertTargets(childtarget));
          showDialog(targets);
        });
      }, 300);
    });
  };

  const convertTargets = (targets) => {
    if (!targets?.length) return {};
    return convertTarget(targets[0], null, targets);
  };

  const convertTarget = (target, parent, targets) => {
    const node = {
      id: target.id,
      parent,
      name: target.value,
      value: target.value,
      metadata: target.metadata,
    };
    node.children = target.children.map((child) =>
      convertTarget(
        targets.find((item) => item.id === child),
        node,
        targets,
      ),
    );
    open.value = open.value.concat(target.id);
    return node;
  };

  const onResize = () => {
    //      const terminalSize = adjustTerminalSize();
    //      adjustTargetTreeSize(terminalSize);
  };
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
