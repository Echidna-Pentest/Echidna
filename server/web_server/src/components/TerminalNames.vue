<template>
  <v-container class="mr-auto" outlined>
      <a
        class="text-none"
        v-for="terminal in terminals"
        :key="terminal.id"
        v-on:click="selected(terminal)"
      >
        #{{ terminal.id}}: {{ terminal.name }}
        <p/>
      </a>
  </v-container>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  name: 'TerminalList',
  title: 'Terminal Names',
  data: () => ({
    terminals: [],
  }),
  mounted() {
    this.updateTerminals();
    echidna.on('terminals', this.updateTerminals);
  },
  methods: {
    updateTerminals() {
      echidna
        .terminals()
        .then(({ data: terminals }) => {
          terminals = terminals.filter(terminal => !terminal.hidden);
          this.$set(this, 'terminals', terminals);
        })
        .catch((error) => {
          console.log(`ERROR: update terminal tabs : ${error}`);
        });
    },
    selected(terminal) {
      this.$emit('selected', terminal);
    },
  },
};
</script>
