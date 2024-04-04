<template>
  <v-card
    class="targettree"
    scrollable
    outlined
  >
    <v-card-title>
      <div
        class="d-flex flex-row align-center"
      >
        Targets:
        <TargetSearch
          @search="(text) => targetTree.setFilter(text)"
        />
        <TargetExport />
      </div>
    </v-card-title>
    <v-card-text>
      <TargetTree
        ref="targetTree"
        @selected="(target) => emits('selected', target)"
      />
    </v-card-text>
  </v-card>
</template>

<script setup>
  import TargetSearch from '@/components/TargetSearch.vue'
  import TargetExport from '@/components/TargetExport.vue'
  import TargetTree from '@/components/TargetTree.vue'
  import { ref } from 'vue';

  const targetTree = ref();
  const emits = defineEmits(['selected']);
</script>
