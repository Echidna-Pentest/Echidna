<template>
  <v-form>
    <v-container>
      <v-row class="mr-auto">
        <v-col>
          <v-text-field
            v-model="name"
            label="New terminal"
            placeholder="Terminal name"
            variant="outlined"
            rounded
            density="compact"
          />
        </v-col>
        <v-col>
          <v-btn
            rounded
            @click="addTerminal"
          >
            ADD
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>

<script setup>
  import { ref, inject } from 'vue';

  const echidna = inject('$echidna');
  const name = ref('');
  const addTerminal = () => {
    return echidna.addTerminal(name.value)
      .then(({ data: id }) => {
        console.debug(`terminal id is ${id}.`);
        name.value = '';
      })
      .catch((error) => {
        console.error(error);
        name.value = '';
      });
  };
</script>
