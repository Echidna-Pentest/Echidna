<template>
  <v-card
    class="mr-auto"
    variant="outlined"
  >
    <v-tabs
      v-model="selectedTab"
      show-arrows
      height="30"
    >
      <v-tab
        v-for="terminal in terminals"
        :id="'terminal' + terminal.id"
        :key="terminal.id"
        class="text-none"
        @click="selected(terminal)"
      >
        <v-text-field
          class="v-text-field"
          :model-value="terminal.name"
          :size="terminal.name.length"
          hide-details
          maxlength="15"
          variant="solo"
          flat
          density="compact"
          @update:modelValue="changeTerminalName(terminal, $event)"
        />
        <v-btn
          class="close-button"
          size="x-small"
          variant="flat"
          @click.stop="hideTerminal(terminal)"
        >
          <span aria-hidden="true">&times;</span>
        </v-btn>
      </v-tab>
      <div class="plus-tab">
        <v-btn
          size="x-small"
          variant="flat"
          @click="addTerminal"
        >
          <span>&#43;</span>
        </v-btn>
      </div>
    </v-tabs>
  </v-card>
</template>

<script setup>
  import { ref, onMounted, inject } from 'vue';
  
  const echidna = inject('$echidna');
  const terminals = ref([]);
  const selectedTab = ref(0);
  const emits = defineEmits(['selected', 'error']);
  
  onMounted(() => {
    echidna.on('terminals', updateTerminalTabs);
    return initializeTerminalTabs();
  });
  
  const initializeTerminalTabs = () => {
    return echidna
      .terminals()
      .then(({ data: terms }) => {
        terms = terms.filter(term => !term.hidden);
        terminals.value = terms;
        if (terms.length === 0) {
          addTerminal().then(() => {
            selected(terms[selectedTab.value]);
          });
        } else{
          selected(terms[selectedTab.value]);
        }
      })
      .catch((error) => {
        console.error(`TerminalsTabPlus.initializeTerminalTabs: ${error}`);
      });
  };
  const updateTerminalTabs = () => {
    return echidna
      .terminals()
      .then(({ data: terms }) => {
        terminals.value = terms.filter(term => !term.hidden);
      })
      .catch((error) => {
        console.log(`ERROR: update terminal tabs : ${error}`);
      });
  };
  
  const selected = (terminal) => {
    if(terminal == null){
      emits('selected', terminals[selectedTab.value]);
    }else{
      selectedTab.value = terminals.value.findIndex(({id}) => id === terminal.id);
      emits('selected', terminal);
    }
  };
  
  const addTerminal = () => {
    return echidna.addTerminal()
      .then(({ data: id }) => {
        if(id.id === undefined){
          emits('error', "terminal name must be unique");
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };
  
  const hideTerminal = (terminal) => {
    //        document.getElementById('terminal'+terminal.id).remove();
    if (terminals.value.length <= 1){
      emits('error', "Can't hide last terminal");
      return;
    }
    return echidna.hideTerminal(terminal.id)
      .catch((error) => {
        console.log(error);
      });
  };
  
  const changeTerminalName = (terminal, name) => {
    return echidna.changeTerminalName(terminal.id, name)
      .then(({ data: result }) => {
        if (result === false) {
          emits('error', "terminal name must be unique");
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };
</script>
