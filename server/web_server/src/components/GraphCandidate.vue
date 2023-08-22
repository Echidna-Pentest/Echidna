<template>
  <div>
    <v-list dense>
      <v-list-item
        v-for="(command, index) in noGroupedCommands"
        :key="index"
        @click="selected"
      >
        <v-tooltip left>
          <template v-slot:activator="{ on }">
            <v-list-item-content v-on="on">
              <v-list-item-title>{{ command.candidate }}</v-list-item-title>
            </v-list-item-content>
          </template>
         <span>{{ command.name }}</span>
        </v-tooltip>
     </v-list-item>
    </v-list>

    <v-list dense>
      <v-list-group :value="true" no-action  dense
         v-for="(command, index) in groupedCommands"
        :key="index">
        <template v-slot:activator >
          <v-list-item-title>{{command.group}}</v-list-item-title>
        </template>
        <v-list-item
          v-for="(command2, index2) in commands.filter(elem => elem.group === command.group)"
          :key="index2"
          @click="selected">
          <v-tooltip left>
            <template v-slot:activator="{ on }">
              <v-list-item-content v-on="on">
                <v-list-item-title>{{ command2.candidate }}</v-list-item-title>
              </v-list-item-content>
            </template>
            <span>{{ command2.name }}</span>
          </v-tooltip>
        </v-list-item>
      </v-list-group>
    </v-list>
  </div>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);
export default {
  data: () => ({
    commands: [],
    command: '',
    compare: (cmd1, cmd2) => cmd1.candidate.localeCompare(cmd2.candidate),
    isLocalIPLoaded: false,
  }),
  computed: {
    noGroupedCommands: function () {
      return this.commands.filter(command => command.group === undefined);
    },
    groupedCommands: function () {
      const groupedCommands = this.commands.filter((element, index, self) =>
        self.findIndex(e =>
                        e.group === element.group
                        && e.group !== undefined
                      ) === index
        );
      return groupedCommands;
    },
  },
  methods: {
    updateCandidates(targets) {
/*      if (this.isLocalIPLoaded == false){
        this.isLocalIPLoaded = echidna.loadLocalIPs();  // local LocalIP and Network range to replace {localip} of the command template with actual local ips
      }*/
      console.log("targets=", targets);
//      const terminalId = document.getElementsByClassName("v-tab--active")[0].id.replace('terminal', '');
      echidna.candidates(targets.map(target => target.id), 1).then((commands) => {
        console.log("commands=", commands);
        this.$set(this, 'commands', commands.sort(this.compare));
      }
      );
    },
    selected(event) {
      console.log("GraphCadidate selected:", event);
/*      this.command = event.target.innerText;
      const regexp = /ipad|android/;
      if (regexp.test(navigator.userAgent.toLowerCase())){
        this.command = this.command + "\n";
      }
      this.$emit('selected', this.command);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(event.target.innerText);
      } else {
        document.addEventListener('copy', this.copyListener);
        document.execCommand('copy');
      }*/
    },
    copyListener(event) {
      event.clipboardData.setData('text/plain', this.command);
      this.command = '';
      event.preventDefault();
      document.removeEventListener('copy', this.copyListener);
    },
  },
};
</script>
