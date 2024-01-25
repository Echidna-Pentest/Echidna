<template>
  <v-list density="compact">
    <v-list-item
      v-for="(command, index) in noGroupedCommands"
      :key="index"
      @click="selected"
    >
      <v-list-item-title>
        {{ command.candidate }}
      </v-list-item-title>
      <v-tooltip
        activator="parent"
        location="left"
      >
        {{ command.name }}
      </v-tooltip>
    </v-list-item>
  </v-list>

  <v-list>
    <v-list-group
      v-for="([group, commands], index) in groupedCommands"
      :key="index"
      no-action
      dense
    >
      <template v-slot:activator>
        <v-list-item-title>
          {{ group }}
        </v-list-item-title>
        <v-list-item
          v-for="(command, index) in commands"
          :key="index"
          @click="selected"
        >
          <v-list-item-title>
            {{ command.candidate }}
          </v-list-item-title>
          <v-tooltip
            activator="parent"
            location="left"
          >
            {{ command.name }}
          </v-tooltip>
        </v-list-item>
      </template>
    </v-list-group>
  </v-list>
</template>

<script setup>
  import { ref, inject, onMounted } from 'vue';

  const echidna = inject("$echidna");
  const noGroupedCommands = ref([]);
  const groupedCommands = ref([]);
  let targetId = 0;
  let terminalId = 1;

  onMounted(() => {
    updateCandidates();
  });

  const setTarget = (id) => {
      targetId = id;
      updateCandidates();
  };

  const setTerminal = (id) => {
      terminalId = id;
      updateCandidates();
  };

  const updateCandidates = () => {
    return echidna.candidates(targetId, terminalId)
        .then(commands => {
          noGroupedCommands.value =
            commands.filter(command => command.group === undefined)
                    .sort(compare);
          const groups =
            [...new Set(commands.map(command => command.group)
                                .filter(group => group !== undefined))]
            .sort((grp1, grp2) => grp1.localeCompare(grp2));
          groupedCommands.value =
            groups.map(group => [group, commands.filter(command => command.group === group)
                                                .sort(compare)]);
        });
  };

  const compare = (cmd1, cmd2) => {
    return cmd1.candidate.localeCompare(cmd2.candidate);
  };

  const selected = (event) => {
    const command = event.target.innerText;
    emits('selected', command);
  };

  const emits = defineEmits(['selected']);

  defineExpose({
    setTarget,
    setTerminal,
  });
</script>
