<template>
  <v-btn
    class="ma-2 pa-2"
    variant="outlined"
    color="success"
    @click="exportTarget"
  >
    export
  </v-btn>
</template>

<script setup>
import { inject } from 'vue';

const { href = '/targets/export/download' } = defineProps(['href']);
const echidna = inject('$echidna');

const exportTarget = () => {
  echidna
  .exportTarget()
    .then(({ data: target }) => {
      if (target == "done"){
        window.location.href = href;
      }
    })
    .catch((error) => {
      console.error(error);
    });
};
</script>
