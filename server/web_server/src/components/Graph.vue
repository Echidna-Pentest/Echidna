<template>
  <div>
    <div ref="networkContainer" style="width: 2000px; height: 1500px;"></div>
    <v-dialog v-model="dialog" max-width="1400px">
      <v-card>
        <v-card-title>Child Nodes</v-card-title>
        <v-card-text>
          <v-treeview
            :items="selectedChildren"
            :open-all=true
            :open.sync="open"
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
    </v-dialog>
  </div>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
import { Network, DataSet } from 'vis-network/standalone/esm/vis-network.min.js';
const echidna = new EchidnaAPI(location.hostname);
var targetsData = [{ id: 0, name: 'targets', parent: null, children: [] }];

export default {
  name: "NetworkGraph",
  data() {
    return {
      network: null,
      targets: targetsData,
      selectedChildren: [],
      open: [],
      dialog: false,
    };
  },
  mounted() {
    this.updateTargets();
    echidna.on('targets', this.updateTargets);
  },
  methods: {
    showDialog(children) {
      this.selectedChildren = children;
      this.dialog = true;
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
    drawTargets(targets){
      const rootIds = targets.filter(node => node.value === 'host' || node.parent === -1).map(node => node.id);
      const directChildrenIds = targets.filter(node => rootIds.includes(node.parent)).map(node => node.id);
      const allowedIds = [...rootIds, ...directChildrenIds];    // Render target up to parent element is "host"

      const filteredJsonData = targets.filter(node => {
          if (node.id === 3) return false;    // skip local host (kali) information
          if (node.value === 'host' && !targets.some(n => n.parent === node.id)) return false;
          return allowedIds.includes(node.id);
      });

      const nodes = new DataSet(filteredJsonData.map(node => {
        const isChildOfHost = targets.some(n => n.id === node.parent && n.value === 'host');
        if (isChildOfHost){// use image icon if the node is child of host
          let icon;
          if (node.metadata.os === "Windows"){
            icon = "icons8-windows-100.png"
          }else if (node.metadata.os === "Linux"){
            icon = "icons8-linux-48.png"
          }else{
            icon = "icons8-server-50.png"
          }
          if(node.metadata.root == 'yes'){
            return {
              id: node.id,
              label: node.value,
              font: { color: 'red' },
              shape: 'image',
              image: icon,
            };
          }else{
            return {
              id: node.id,
              label: node.value,
              font: { color: 'black' },
              shape: 'image',
              image: icon,
            };
          }
        }else {
          return {
          id: node.id,
          label: node.value,
          };
        }
      }));

      let edgesArray = [];
      filteredJsonData.forEach(node => {
        node.children.forEach(childId => {
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

      this.network.on('click', (properties) => {
        if (properties.nodes[0]==undefined){    // return if the empty space is clicked
          return;
        }
        const nodeId = properties.nodes[0];
        echidna
        .getAllChildren(nodeId)
        .then(({ data: childtarget }) => {    // get all children of the clicked node and draw by v-treeview
          this.targets.splice(0, 1, this.convertTargets(childtarget));
          this.showDialog(this.targets);
        });
      });
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
      node.children = target.children.map((child) => this.convertTarget(targets.find(item => item.id === child), node, targets));
      this.open = this.open.concat(target.id);
      return node;
    },
  },
};
</script>
