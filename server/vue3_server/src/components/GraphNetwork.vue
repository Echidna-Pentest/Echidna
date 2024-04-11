<template>
  <div
    ref="container"
    style="width: 100vw; height: 100vh;"
  />
</template>

<script setup>
  import { Network, DataSet } from "vis-network/standalone/esm/vis-network.min.js";
  import { ref, inject, onMounted } from 'vue';
  
  const emits = defineEmits(['selected']);
  const container = ref();

  const echidna = inject("$echidna");

  onMounted(() => {
    updateTargets();
    echidna.on("targets", updateTargets);
  });

  const updateTargets = () => {
    return echidna
      .targets()
      .then(({ data: targets }) => {
        drawNetwork(targets);
      })
      .catch((error) => {
        console.error("ERROR: Graph.updateTargets()", error);
      });
  };

  const drawNetwork = (targets) => {
    if (!container.value) {
        return;
    }
    const rootIds = targets
      .filter((node) => node.value === "host" || node.parent === -1)
      .map((node) => node.id);
    const directChildrenIds = targets
      .filter((node) => rootIds.includes(node.parent))
      .map((node) => node.id);
    const allowedIds = [...rootIds, ...directChildrenIds]; // Render target up to parent element is "host"

    const networkTargets = targets.filter((node) => {
      if (node.id === 3) return false; // skip local host (kali) information
      if (node.value === "host" && !targets.some((n) => n.parent === node.id))
        return false;
      return allowedIds.includes(node.id);
    });

    const nodes = networkTargets.map((target) => {
      const isChildOfHost = targets.some(
        (n) => n.id === target.parent && n.value === "host",
      );
      if (isChildOfHost) {
        // use image icon if the target is child of host
        let icon;
        if (target.metadata.os === "Windows") {
          icon = "icons8-windows-100.png";
        } else if (target.metadata.os === "Linux") {
          icon = "icons8-linux-48.png";
        } else {
          icon = "icons8-server-50.png";
        }
        return {
          id: target.id,
          label: target.value,
          font: { color: target.metadata.root == "yes" ? "red" : "black"},
          shape: "image",
          image: icon,
        };
      }
      return {
        id: target.id,
        label: target.value,
      };
    });

    const edges = [];
    networkTargets.forEach((target) => {
      target.children.forEach((childId) => {
        if (allowedIds.includes(childId)) {
          edges.push({ from: target.id, to: childId });
        }
      });
    });
    const data = { nodes: new DataSet(nodes), edges: new DataSet(edges) };
    const options = {};

    const network = new Network(container.value, data, options);

    network.on("click", (properties) => {
      properties.event.preventDefault();
      const targetId = properties.nodes[0];
      if (targetId == undefined) {
        return;  // if the empty space is clicked
      }
      emits('selected', targetId);
    });
  };

</script>
