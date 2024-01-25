<template>
  <Tree
    class="container ma-0 pa-0"
    :config="config"
    :nodes="nodes"
    @nodeFocus="selected"
  />
</template>

<script setup>
import 'vue3-treeview/dist/style.css';
import Tree from 'vue3-treeview';
import { ref, reactive, onMounted, inject } from 'vue';

const echidna = inject('$echidna');

const config = ref({
  roots: ["0"],
  checkboxes: false,
  editable: true,
  dragAndDrop: true,
  keyboardNavigation: true,
  padding: 22,
});

const nodes = reactive({
  "0": {
    id: "0",
    text: 'network',
    parent: null,
    children: [],
    state: {
      opened: true,
    },
  },
});

const selected = (target) => emits('selected', target);
const emits = defineEmits(['selected']);

onMounted(() => {
  echidna.on('targets', updateTargets);
  return updateTargets();
});
const updateTargets = () => {
  return echidna
    .targets()
    .then(({ data: targets }) => {
      targets?.forEach(target => {
        nodes[target.id.toString()] = {
          id: target.id.toString(),
          text: target.value,
          value: target.value,
          parent: target.parent ?? target.parent.toString(),
          children: target.children.map(String),
          metadata: target.metadata,
          state: {
            opened: targets[target.id]?.state?.opened ?? true,
          },
        };
      });
    })
    .catch((error) => {
      console.error(error);
    });
};
const setFilter = (text) => {
  if (!text) return;
  return echidna
    .search(text)
    .then(({ data: targets }) => {
      const ids = targets.map(target => target.id.toString());
      Object.values(nodes).forEach(node => {
        node.state.opened = ids.includes(node.id);
      });
    })
    .catch((error) => {
      console.error(error);
    });
};

defineExpose({
  setFilter,
});
</script>

<style scoped>

.container{
  margin:0.1px;
}
.plus{
  width: 25px;
  height: 25px;
  line-height: 0.1;
}
.minus{
  width: 25px;
  height: 25px;
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

