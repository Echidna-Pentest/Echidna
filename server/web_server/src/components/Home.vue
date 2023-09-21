<template>
  <v-card class="mr-auto ma-n2 pa-0" flat>
    <v-row no-gutters>
      <v-col>
        <div id="terminals" ref="divterminals">
        <span id="error"></span>
        <TabTerminals ref="terminals"></TabTerminals>
      </div>
      </v-col>

      <v-col  v-resize="onResize">
        <v-col class="ma-n1 pa-0">
          <v-card
            ref="targettreeCard"
            class="overflow-x-auto  targettree"
            outlined
          >
            <v-subheader>Target Tree</v-subheader>
            <Targets @selected="selectTarget"></Targets>
          </v-card>
        </v-col>
        <v-col v-show="candidate" v-resize="onResize"  class="ma-n1 pa-0" >
          <v-card
            ref="candidateCard"
            class="overflow-x-auto  candidatecommand"
            outlined
          >
            <v-subheader>Candidate Command</v-subheader>
            <Candidates ref="commands" @selected="selectCommand"></Candidates>
          </v-card>
        </v-col>
      </v-col>
    </v-row>
    <button class="archive-button" @click="showDialog">Archive Logs</button>
    <v-dialog v-model="dialog" persistent max-width="490" @click:outside="closeDialog">
      <v-card>
        <v-card-title class="headline">Would you like to archive terminal logs? Please do this process when the response is slow. </v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="green darken-1" text @click="archiveLogs">Yes</v-btn>
          <v-btn color="red darken-1" text @click="closeDialog = false">No</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <notifications group="bottom-center" position="bottom center"></notifications>
    <ChatBot />
  </v-card>
</template>
<style>
.v-treeview-node__content, .v-treeview-node__label {
  white-space: normal ;
  font-size: small;
}

html {
  margin: 0 auto;
  overflow-x: auto;
}


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

<script>
import TabTerminals from '@/components/TabTerminals.vue';
import Targets from '@/components/Targets.vue';
import Candidates from '@/components/Candidates.vue';
import ChatBot from '@/components/ChatBot.vue';
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);

export default {
  name: 'Home',
   state: {
    isLogin: false,
    isInitialLoad: true,
    userId: ''
  },
  actions: {
    fetch(context, user){
      context.commit('auth', user);
    }
  }, 
  components: {
    TabTerminals,
    Targets,
    Candidates,
    ChatBot
  },
  data: () => ({
    candidate: false,
    dialog: false,
    windowWidth: 0,
  }),
  mounted() {
    this.$nextTick(() => {
      this.isInitialLoad = false;
    });
  },
  methods: {
    adjustTerminalSize(){
      var div = this.$refs.divterminals;
      var viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
      var desiredWidth = viewWidth * 0.6;
      if (desiredWidth < 500) {
        div.style.width = "500px";
      } else {
        div.style.width = desiredWidth + "px";
      }
      return desiredWidth;
    },
    adjustTargetTreeSize(terminalSize){
      const targettreerect = this.$refs.targettreeCard.$el.getBoundingClientRect();
      const width = window.innerWidth - terminalSize - 10;
      const height = (window.innerHeight - targettreerect.top) / 2 - 10;
      this.$refs.targettreeCard.$el.style.width = `${width}px`;
      this.$refs.candidateCard.$el.style.width = `${width}px`;
      this.$refs.targettreeCard.$el.style.height = `${height}px`;
      this.$refs.candidateCard.$el.style.height = `${height}px`;
    },
    selectTarget(targets) {
      this.$refs.commands.updateCandidates(targets);
      this.candidate = targets.length > 0;
    },
    selectCommand(command, appendNewline=false) {
      this.$refs.terminals.executeCommand(command, appendNewline);
    },
    showDialog(){
      this.dialog = true;
    },
    archiveLogs() {
      this.dialog = false;
      echidna
      .archiveConsoleLog()
      .then(({ data: targets }) => {
        this.$notify({
         title: 'Notification',
         text: 'Log is archived to ' + targets,
         duration:3000,
         group: "bottom-center",
         type: 'success'
      });
      })
      .catch((error) => {
        console.error(error);
      });
    },
    closeDialog() {
      this.dialog = false;
    },
    onResize(){
      setTimeout(() => {
        const terminalSize = this.adjustTerminalSize();
        if (!this.isInitialLoad) {
          this.$refs.terminals.selected();
        }
        this.adjustTargetTreeSize(terminalSize);
      }, 200); 
    }
  },
};
</script>
