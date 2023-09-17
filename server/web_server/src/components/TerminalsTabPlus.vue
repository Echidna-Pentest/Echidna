<template>
  <v-card class="mr-auto" outlined>
    <v-tabs v-model="tab" show-arrows height="30">
      <v-tab
        class="text-none"
        v-for="terminal in terminals"
        :key="terminal.id"
        v-bind:id="'terminal' + terminal.id"
        @click="selected(terminal)"
      >

        <v-text-field
            class="v-text-field"
            v-bind:value="terminal.name"
            hide-details
            maxlength="15"
            solo
            flat
            dense
            @change="changeTerminalName(terminal, $event)"
          ></v-text-field>
        <v-btn  class="close-button"
          x-small
          depressed
          plain
          @click.stop="hideTerminal(terminal)"
        >
          <span aria-hidden="true">&times;</span>
        </v-btn>
      </v-tab>
      <div class="plus-tab">
        <v-btn
          x-small
          depressed
          @click="addTerminal"
        >
        <span>&#43;</span>
        </v-btn>
      </div>
    </v-tabs>
  </v-card>
</template>

<style scoped>
.plus-tab {
  width: 0.1px;
  display: flex;
  align-items: center;
}
.v-text-field{
      width: 80px;
}
.v-text-field >>> input {
  font-size: 0.75em;
  padding: 0;
}

.close-button{
	width: 1px;
}
</style>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  data: () => ({
    tab: 0,
    terminals: [],
  }),
  mounted() {
    this.initializeTerminalTabs();
    echidna.on('terminals', this.updateTerminalTabs);
  },
  methods: {
    initializeTerminalTabs() {
      echidna
        .terminals()
        .then(({ data: terminals }) => {
          terminals = terminals.filter(terminal => !terminal.hidden);
          this.$set(this, 'terminals', terminals);
          if (terminals.length === 0) {
            this.addTerminal();
            setTimeout(() => {
              this.selected(this.terminals[this.tab]);
            }, 1000);
          } else{
            this.selected(terminals[this.tab]);
          }
        })
        .catch((error) => {
          console.log(`ERROR: update terminal tabs : ${error}`);
        });
    },
    updateTerminalTabs() {
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
      if(terminal == null){
        this.$emit('selected', this.terminals[this.tab]);
      } else{
        this.tab = this.terminals.findIndex(({id}) => id === terminal.id);
        this.$emit('selected', terminal);
      }
    },
    addTerminal() {
      echidna.addTerminal()
        .then(({ data: id }) => {
          if(id.id === undefined){
            var error = document.getElementById("error");
            error.textContent = "terminal name must be unique";
            error.style.color = "red";
            setTimeout('error.textContent = ""', 5000);
            return false;
          }
        })
        .catch((error) => {
          console.log(error);
          this.name = '';
        });
    },
    hideTerminal(terminal) {
      //        document.getElementById('terminal'+terminal.id).remove();
      if (this.terminals.length < 2){
        console.debug("Can't hide last terminal");
        return;
      }
      echidna.hideTerminal(terminal.id)
        .then(() => {
          console.debug("hideTerminal done");
        })
        .catch((error) => {
          console.log(error);
          this.name = '';
        });
    },
    changeTerminalName(terminal, event) {
      echidna.changeTerminalName(terminal.id, event)
        .then(({ data: result }) => {
          if (result === false) {
            var error = document.getElementById("error");
            error.textContent = "terminal name must be unique";
            error.style.color = "red";
            setTimeout('error.textContent = ""', 5000);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    },
  },
};
</script>
