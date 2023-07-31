<template>
  <v-card class="mr-auto" outlined>
    <v-tabs v-model="tab" show-arrows>
      <v-tab
        class="text-none"
        v-for="terminal in terminals"
        :key="terminal.id"
        @click="selected(terminal)"
      >
        {{ terminal.name }}
      </v-tab>
    </v-tabs>
  </v-card>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  data: () => ({
    tab: 0,
    terminals: [],
  }),
  mounted() {
    this.updateTerminalTabs();
    echidna.on('terminals', this.updateTerminalTabs);
  },
  methods: {
    updateTerminalTabs() {
      echidna
        .terminals()
        .then(({ data: terminals }) => {
          this.$set(this, 'terminals', terminals);
          if (terminals.length) {
            this.selected(terminals[this.tab]);
          }
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
