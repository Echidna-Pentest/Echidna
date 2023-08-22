<template>
  <div>
    <div ref="networkContainer" style="width: 95vw; height: 95vh"></div>
    <v-dialog v-model="dialog" :style="{ maxWidth: '95vw', height: '95vh' }">
      <v-row no-gutters>
        <v-col
          id="targetDialog"
          cols="6"
          class="ma-0 pa-0 overflow-y-auto"
          style="max-height: 90vh"
        >
          <v-card>
            <v-card-title>Child Nodes</v-card-title>
            <v-card-text>
              <v-treeview
                :open-all="true"
                :open.sync="open"
                activatable
                :active="active"
                @update:active="selected"
                :items="targets"
                return-object
                dense
                item-text="value"
                item-key="id"
                hoverable
              >
                <template v-slot:label="{ item }">
                  <v-list-item-content>
                    <v-list-item-title>{{ item.value }}</v-list-item-title>
                  </v-list-item-content>
                </template>
              </v-treeview>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-col
            id="commandDialog"
            v-show="commandDialog"
            v-resize="onResize"
            class="ma-0 pa-0 overflow-y-auto"
            style="max-height: 45vh, maxWidth: 45vw;"
          >
            <v-card
              ref="candidateCard"
              class="overflow-x-auto candidatecommand"
              outlined
            >
              <v-subheader>Candidate Command</v-subheader>
              <Candidates
                ref="graphcandidate"
                @selected="selectCommand"
              ></Candidates>
            </v-card>
          </v-col>

          <v-col
            id="terminalDialog"
            v-show="terminalDialog"
            class="ma-0 pa-0 overflow-y-auto"
            style="max-height: 45vh, maxWidth: 45vw;"
          >         
              <GraphTerminal
                ref="graphterminal"
                @selected="selectCommand"
              ></GraphTerminal>
          </v-col>
        </v-col>
      </v-row>
    </v-dialog>
  </div>
</template>

<style scoped>
.custom-dialog .v-dialog__content {
  width: 50% !important;
  max-width: 50% !important;
  left: 0 !important;
  position: fixed !important;
  top: 0 !important;
  bottom: 0 !important;
}
</style>

<script>
import { EchidnaAPI } from "@echidna/api";
import {
  Network,
  DataSet,
} from "vis-network/standalone/esm/vis-network.min.js";
//import GraphCandidate from '@/components/GraphCandidate.vue';
import Candidates from "@/components/Candidates.vue";
import GraphTerminal from '@/components/GraphTerminal.vue';

const echidna = new EchidnaAPI(location.hostname);
var targetsData = [{ id: 0, name: "targets", parent: null, children: [] }];

export default {
  name: "NetworkGraph",
  data() {
    return {
      network: null,
      targets: targetsData,
      candidate: false,
      selectedChildren: [],
      active: [],
      open: [],
      dialog: false,
      commandDialog: false,
      terminalDialog: false,
    };
  },
  components: {
    //    GraphCandidate
    Candidates,
    GraphTerminal,
  },
  mounted() {
    this.updateTargets();
    echidna.on("targets", this.updateTargets);
    //    this.handleItemSelected(1);
  },
  methods: {
    showDialog(children) {
      this.selectedChildren = children;
      this.dialog = true;
    },
    handleItemClick(item) {
      console.log("clicked item:", item);
    },
    handleItemSelected(selectedItemIds) {
      console.log("Selected item IDs:", selectedItemIds);
      const selectedItems = this.selectedChildren.filter((child) =>
        selectedItemIds.includes(child.id),
      );
      console.log("Selected items:", selectedItems);
    },
    updateTargets() {
      echidna
        .targets()
        .then(({ data: targets }) => {
          this.targets.splice(0, this.targets.length);
          this.drawTargets(targets);
        })
        .catch((error) => {
          console.error(error);
        });
    },
    selected(targets) {
      this.commandDialog = true;
      console.log("targets=", targets);
      //      console.log("this.$refs.graphcandidate=", this.$refs.graphcandidate);
      //      this.$refs.graphcandidate.updateCandidates(targets);
      //      this.$refs.graphcandidate.selected(targets);
      this.$refs.graphcandidate.updateCandidatesFromGraph(targets);
      console.log("this.$refs.graphcandidate=", this.$refs.candidateCard);
      this.candidate = targets.length > 0;
      console.log("commandDialog=", this.commandDialog);
      console.log("this.candidate=", this.candidate);
    },
    selectCommand(command) {
      console.log("command=", command);
      this.terminalDialog = true;
      //this.$refs.graphterminal.addTerminal();
      echidna.addTerminal("graph")
        .then(({ data: id }) => {
          console.log("terminal id is", id.id);
          this.$refs.graphterminal.selectTerminal(id.id);
          this.name = '';
          this.$refs.graphterminal.executeCommand(command+ "\n");
/*          echidna
          .keyin(id.id, command + "\n", this.targetId)
          .catch((error) => {
            console.log(error);
          });*/
        })
        .catch((error) => {
          console.log(error);
          this.name = '';
        });

    },
    drawTargets(targets) {
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

      const container = this.$refs.networkContainer;
      const data = { nodes, edges };
      const options = {};

      this.network = new Network(container, data, options);

      this.network.on("click", (properties) => {
        if (properties.nodes[0] == undefined) {
          // return if the empty space is clicked
          return;
        }
        const nodeId = properties.nodes[0];
        echidna.getAllChildren(nodeId).then(({ data: childtarget }) => {
          // get all children of the clicked node and draw by v-treeview
          this.targets.splice(0, 1, this.convertTargets(childtarget));
          this.showDialog(this.targets);
        });
      });
    },
    showCommand() {
      this.$refs.graphcandidate.executeCommand();
    },
    convertTargets(targets) {
      if (!targets?.length) return {};
      return this.convertTarget(targets[0], null, targets);
    },
    convertTarget(target, parent, targets) {
      const node = {
        id: target.id,
        parent,
        name: target.value,
        value: target.value,
        metadata: target.metadata,
      };
      node.children = target.children.map((child) =>
        this.convertTarget(
          targets.find((item) => item.id === child),
          node,
          targets,
        ),
      );
      this.open = this.open.concat(target.id);
      return node;
    },
    onResize() {
      //      const terminalSize = this.adjustTerminalSize();
      //      this.adjustTargetTreeSize(terminalSize);
    },
  },
};
</script>
