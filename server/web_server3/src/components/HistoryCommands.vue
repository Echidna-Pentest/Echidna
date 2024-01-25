<template>
  <v-list
    class="overlflow-x-auto overflow-y-auto"
    max-height="430"
    outlined
    rounded
    density="compact"
  >
    <v-list-item
      v-for="(history, index) in histories"
      :key="index"
      :title="history.command"
      @click="selected(history, index)"
    >
      <v-tooltip
        activator="parent"
        location="top"
      >
        {{ history.date }}
      </v-tooltip>
    </v-list-item>
  </v-list>
</template>

<script setup>
  import { ref, inject, onMounted } from 'vue';

  const histories = ref([]);
  const select = ref(undefined);
  const emits = defineEmits(['selected']);

  const echidna = inject("$echidna");
  let terminalId = 0;
  let lastLogId = -1;
  let logs = [];
  let historiesIndex = undefined;

  onMounted(() => {
    echidna.on('logs', () => updateLogs());
    return updateLogs();
  });

  const selectTerminal = (terminal) => {
    terminalId = terminal.id;
    lastLogId = -1;
    logs = [];
    historiesIndex = undefined;
    select.value = undefined;
    histories.value = [];
    emits('selected', {});
    return updateLogs();
  };

  const updateLogs = () => {
    return echidna
      .logs(terminalId, lastLogId + 1)
      .then(({ data: newLogs }) => {
        if (newLogs.length) {
          logs = [...logs, ...newLogs];
          lastLogId = newLogs.slice(-1)[0].id;
        }
        updateHistories();
      })
      .catch((error) => {
        console.log(`ERROR: update history logs: ${error}`);
      });
  };

  const updateHistories = () => {
    histories.value = logs
      ?.filter((log) => log.seqId == 1 && log.command.match(/.*(\r|\n)$/))
      .map((log) => ({
          command: log.command.trim(),
          date: new Date(log.date).toLocaleString(),
          logsIndex: logs.indexOf(log),
        })
      );
  };

  const selected = (history, index) => {
    if (index === historiesIndex) {  // select off
      emits('selected', {});
      return;
    }
    historiesIndex = index;
    let seqId = 0;
    let output = '';
    for (const log of logs.slice(history.logsIndex)) {
      if (log.seqId < seqId) break;
      seqId = log.seqId + 1;
      output += log.output;
    }
    emits('selected', {...history, output});
  };

  defineExpose({
    selectTerminal,
  });

</script>
