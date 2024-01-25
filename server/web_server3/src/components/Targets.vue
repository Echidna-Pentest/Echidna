<template>
  <div>
    <div
      class="d-flex flex-row align-center"
    >
      Targets:
      <TargetSearch 
        @search="searchTarget"
      />
      <TargetExport
        class="right-align"
      />
    </div>
    <TargetTree
       ref=targetTree
       @selected="selectedTarget"
    />
  </div>
</template>

<script setup>
import TargetSearch from '@/components/TargetSearch.vue';
import TargetExport from '@/components/TargetExport.vue';
import TargetTree from '@/components/TargetTree.vue';
import { ref } from 'vue';

const targetTree = ref();
const searchTarget = (text) => targetTree.value.setFilter(text);

const emits = defineEmits(['selected']);
const selectedTarget = (target) => {
  console.debug('Targets.selectedTarget:', target.text);
  emits('selected', target);
};
</script>
