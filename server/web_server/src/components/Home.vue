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
</style>

<script>
import TabTerminals from '@/components/TabTerminals.vue';
import Targets from '@/components/Targets.vue';
import Candidates from '@/components/Candidates.vue';
import ChatBot from '@/components/ChatBot.vue';

export default {
  name: 'Home',
   state: {
    isLogin: false,
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
    windowWidth: 0,
  }),
  mounted() {
    const terminalSize = this.adjustTerminalSize();
    this.adjustTargetTreeSize(terminalSize);
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
    selectCommand(command) {
      this.$refs.terminals.executeCommand(command);
    },

    onResize(){
      const terminalSize = this.adjustTerminalSize();
      this.adjustTargetTreeSize(terminalSize);
    }
  },
};
</script>
