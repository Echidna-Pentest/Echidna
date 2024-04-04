<template>
  <div>
    <GraphNetwork
      @selected="(targetId) => dialog.show(targetId)"
    />
    <GraphDialog
       ref="dialog"
    />
  </div>
</template>

<script setup>
  import GraphNetwork from "@/components/GraphNetwork.vue";
  import GraphDialog from "@/components/GraphDialog.vue";
  import { ref } from 'vue';

  const dialog = ref();
</script>
