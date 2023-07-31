<template>
  <v-form>
    <v-container>
      <v-row class="mr-auto">
        <v-col>
          <v-text-field
            v-model="name"
            label="New terminal"
            placeholder="Terminal name"
            outlined
            rounded
            dense
          ></v-text-field>
        </v-col>
        <v-col>
          <v-btn @click="addTerminal" rounded>ADD</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>

<script>
import {EchidnaAPI} from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  data: () => ({
    name: '',
  }),
  methods: {
    addTerminal() {
      echidna.addTerminal(this.name)
        .then(({ data: id }) => {
          console.log(`terminal id is ${id}.`);
          this.name = '';
        })
        .catch((error) => {
          console.log(error);
          this.name = '';
        });
    },
  },
};
</script>
