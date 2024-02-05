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
  import TargetAddDialog from '@/components/TargetAddDialog.vue';
  import TargetDeleteDialog from '@/components/TargetDeleteDialog.vue';
  import { ref, reactive, onMounted, inject } from 'vue';

  const addDialog = ref();
  const deleteDialog = ref();

  const echidna = inject('$echidna');

  const config = reactive({
    roots: ["id0"],
    checkboxes: false,
    editable: false,
    dragAndDrop: false,
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

  onMounted(() => {
    echidna.on('targets', updateTargets);
    return updateTargets();
  });

  const toNode = (target) => {
    return {
      targetId: target.id,
      text: target.value,
      children: target.children.map(id => "id" + id),
      state: {
        opened: true,
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

  const changeRoot = (targetId) => {
    config.roots[0] = targetId >= 0 ? `id${targetId}` : "id0";
  };

  defineExpose({
    changeRoot,
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

