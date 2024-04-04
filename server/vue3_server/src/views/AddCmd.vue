<template>
  <div class="container">
    <form @submit.prevent="submitForm">
      <!--      <div v-for="(pattern, index) in formData.patterns" :key="'pattern-' + index">
        <v-text-field :label="'Pattern ' + (index + 1)" v-model="formData.patterns[index]" :rules="patternsRequired[index] ? [required] : []"></v-text-field>
        <v-btn small @click.prevent="removeField('patterns', index)" v-if="formData.patterns.length > 1">Remove</v-btn>
      </div>
      <v-btn small @click.prevent="addField('patterns')">Add Pattern</v-btn>
    -->

      <div
        v-for="(template, index) in formData.templates"
        :key="'template-' + index"
      >
        <v-text-field
          v-model="formData.templates[index]"
          :label="'Template ' + (index + 1) + ': {host}, {ipv4}, {port}, {localip} can be replaced with target info in Target Tree. Ex:) testcommand {host} ' "
          :rules="templatesRequired[index] ? [required] : []"
        />
        <v-btn
          v-if="formData.templates.length > 1"
          size="small"
          @click.prevent="removeField('templates', index)"
        >
          Remove
        </v-btn>
      </div>
      <v-btn
        size="small"
        @click.prevent="addField('templates')"
      >
        Add Template
      </v-btn>

      <v-text-field
        v-model="formData.name"
        label="Name: Please enter the explanation of the command"
        :rules="[required]"
      />
      <!-- ... other fields ... -->
      <v-text-field
        v-model="formData.condition"
        label="Condition: Please enter json format. Ex:) If you want to ftp scan command, {&quot;.*&quot;: [&quot;ftp&quot;, &quot;21&quot;]}"
      />
      <v-text-field
        v-model="formData.group"
        label="Group: "
      />

      <v-btn type="submit">
        Submit
      </v-btn>
    </form>
  </div>
</template>

<script setup>
  import { reactive, inject } from 'vue';
  const echidna = inject("$echidna");

  const formData = reactive({
//    patterns: [""],
    templates: [""],
    name: "",
    condition: "",
    group: ""
  });
  const required = (value) => !!value || 'Field is required';
//  const patternsRequired = reactive([true]);
  const templatesRequired = reactive([true]);

  const addField = (type) => {
    formData.value[type].push("");
    /*
    if (type === 'patterns') {
      patternsRequired.push(true);
    } else {*/
      templatesRequired.value.push(true);
//    }
  };

  const removeField = (type, index) => {
    formData.value[type].splice(index, 1);
/*    if (type === 'patterns') {
      patternsRequired.splice(index, 1);
    } else {*/
      templatesRequired.value.splice(index, 1);
//    }
  };

  const submitForm = () => {
//    const arePatternsValid = formData.value.patterns.every(pattern => pattern.trim() !== "");
    const areTemplatesValid = formData.value.templates.every(template => template.trim() !== "");
    const isNameValid = formData.value.name.trim() !== "";
//    if (arePatternsValid && areTemplatesValid && isNameValid) {
    if (areTemplatesValid && isNameValid) {
      return echidna
        .addCommand(formData.value)
        .then(({ data: messages }) => {
          console.debug("AddCmd.submitForm: messages=", messages);
          alert("The entered command has been successfully added to the command list file (Echidna/server/api_server/commands/commands.txt). \n" + messages);
        })
        .catch((error) => {
          console.error(error);
        });
    }else{
      alert("Template, Name are reuired");
    }
//    }
  };

</script>

<style scoped>
.container {
  width: 60%;
  margin: 0 auto; 
}
</style>
