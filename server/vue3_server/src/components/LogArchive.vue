<template>
  <button
    class="archive-button"
    @click="dialog = true"
  >
    Archive Logs
    <v-dialog
      v-model="dialog"
      max-width="500"
    >
      <v-card>
        <v-card-title
          class="headline"
        >
          Would you like to archive terminal logs?<br>
          Please do this process when the response is slow. 
        </v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="green darken-1" text @click="archiveLogs">Yes</v-btn>
          <v-btn color="red darken-1" text @click="dialog = false">No</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </button>
</template>

<script setup>
  import { useNotification } from "@kyvg/vue3-notification";
  import { ref, inject } from 'vue';

  const echidna = inject("$echidna");
  const dialog = ref(false);
  const { notify } = useNotification();

  const archiveLogs = () => {
    dialog.value = false;
    echidna
      .archiveConsoleLog()
      .then(({ data: targets }) => {
        notify({
           title: 'Notification',
           text: 'Log is archived to ' + targets,
           duration: 3000,
           group: "bottom-center",
           type: 'success'
        });
      })
      .catch((error) => {
        console.error(error);
      });
  };
</script>

<style>
.archive-button {
  position: fixed;
  bottom: 70px;
  right: 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
}
</style>
