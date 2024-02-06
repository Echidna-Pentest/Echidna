<template>
  <Tree
    class="container ma-0 pa-0"
    :config="config"
    :nodes="nodes"
    @nodeFocus="selected"
    @nodeOpened="nodeOpened"
    @nodeClosed="nodeClosed"
  >
    <template #after-input="{node}">
      <v-btn
        color="primary"
        size="x-small"
        height="15px"
        @click="showAddDialog(node)"
      >
        +
        <TargetAddDialog
          ref="addDialog"
        />
      </v-btn>
      <v-btn
        color="primary"
        size="x-small"
        height="15px"
        @click="showDeleteDialog(node)"
      >
        -
        <TargetDeleteDialog
          ref="deleteDialog"
        />
      </v-btn>
    </template>
  </Tree>
</template>

<script setup>
import 'vue3-treeview/dist/style.css';
import Tree from 'vue3-treeview';
import TargetAddDialog from '@/components/TargetAddDialog.vue';
import TargetDeleteDialog from '@/components/TargetDeleteDialog.vue';
import { ref, onMounted, inject } from 'vue';

const addDialog = ref();
const deleteDialog = ref();

const echidna = inject('$echidna');
const STORAGE_OPENED = "TargetTree.opened"

const config = ref({
  roots: ["id0"],
  checkboxes: false,
  editable: true,
  dragAndDrop: true,
  keyboardNavigation: true,
  padding: 22,
});

const nodes = ref({
  "id0": {
    targetId: 0,
    text: 'network',
    children: [],
    state: {
      opened: true,
    },
  }
});

const emits = defineEmits(['selected']);
const selected = (node) => {
  emits('selected', targets[node.targetId]);
};
let targets = [];
let openedTargetIds = [];

onMounted(() => {
  loadOpenedTargetIds();
  echidna.on('targets', updateTargets);
  return updateTargets();
});

const toNode = (target) => {
  return {
    targetId: target.id,
    text: target.value,
    children: target.children.map(id => "id" + id),
    state: {
      opened: openedTargetIds.includes(target.id),
    }
  }
};

const updateTargets = () => {
  return echidna
    .targets()
    .then(({ data: targets_ }) => {
      targets = targets_;
      const nodes_ = {};
      targets?.forEach(target => {
        nodes_["id" + target.id] = toNode(target); 
      });
      nodes.value = nodes_;
    })
    .catch((error) => {
      console.error(error);
    });
};

const loadOpenedTargetIds = () => {
  openedTargetIds = JSON.parse(localStorage.getItem(STORAGE_OPENED)) || [0];
};

const saveOpenedTargetIds = () => {
  localStorage.setItem(STORAGE_OPENED, JSON.stringify(openedTargetIds));
};

const nodeOpened = (node) => {
    openedTargetIds.push(node.targetId);
    saveOpenedTargetIds();
};

const nodeClosed = (node) => {
    openedTargetIds = openedTargetIds.filter((id) => id !== node.targetId);
    saveOpenedTargetIds();
};

const updateNodeOpened = (targetIds) => {
  Object.values(nodes.value).forEach(node => {
    node.state.opened = targetIds.includes(node.targetId);
  });
};

const setFilter = (name) => {
  if (name) {
    return echidna
      .search(name)
      .then(({ data: targets }) => {
        updateNodeOpenedt(targets.map(target => target.id));
      })
      .catch((error) => {
        console.error(error);
      });
  } else {
    updateNodeOpenedt(openedTargetIds);
  }
};

const parentName = (target) => {
  return target?.parent >= 0 ? targets[target.parent].value : undefined;
}

const showAddDialog = (node) => {
  const target = targets[node.targetId];
  addDialog.value.show(target, parentName(target) === "host");
};

const showDeleteDialog = (node) => {
  if (node.targetId == 0) {
    console.info("TargetTree: can't remove the root node");
    return;
  }
  deleteDialog.value.show(targets[node.targetId]);
};

defineExpose({
  setFilter,
});
</script>

<style scoped>

.container{
  margin: 0.1px;
}

.draggable {
  display: flex;
}

.draggable.dragging {
  opacity: .5;
}

.changed{
  animation: color-change 1.5s linear;
}

.high:hover .popup {
  display: block;
}

.popup {
  display: none;
  width: 200px;
  position: absolute;
  top: 100;
  left: 350px;
  padding: 16px;
  border-radius: 5px;
  background: yellow;
  color: black;
  font-weight: bold;
  z-index: 1000;
}
.high{
  background-color: yellow;
}

@keyframes color-change {
  50%{
    background-color:gainsboro;
  }
}

</style>

