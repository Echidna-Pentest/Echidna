<template>
  <v-dialog v-model="active" persistent max-width="400px">
    <v-card
        title="Delete Target"
    >
      <v-card-text>
        Do you want to delete the target "{{ target.value }}"?<br>
        Child nodes are also removed.
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="active = false">Cancel</v-btn>
        <v-btn color="blue darken-1" text @click="deleteTarget">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { ref, inject } from "vue";

  const target = ref({});
  const active = ref(false);

  const echidna = inject("$echidna");

  const show = (target_) => {
    target.value = target_;
    active.value = true;
  };

  const deleteTarget = () => {
    active.value = false;
    echidna
      .deleteTarget(target.value.id, target.value.parent.id)
      .catch((error) => {
        console.error(error);
      });
  };

  defineExpose({
    show,
  });
</script>
