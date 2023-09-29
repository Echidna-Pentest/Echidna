<template>
  <div class="container">
    <form @submit.prevent="submitForm">

<!--      <div v-for="(pattern, index) in formData.patterns" :key="'pattern-' + index">
        <v-text-field :label="'Pattern ' + (index + 1)" v-model="formData.patterns[index]" :rules="patternsRequired[index] ? [required] : []"></v-text-field>
        <v-btn small @click.prevent="removeField('patterns', index)" v-if="formData.patterns.length > 1">Remove</v-btn>
      </div>
      <v-btn small @click.prevent="addField('patterns')">Add Pattern</v-btn>
    -->

      <div v-for="(template, index) in formData.templates" :key="'template-' + index">
        <v-text-field :label="'Template ' + (index + 1) + ': {host}, {ipv4}, {port}, {localip} can be replaced with target info in Target Tree. Ex:) testcommand {host} ' " v-model="formData.templates[index]" :rules="templatesRequired[index] ? [required] : []"></v-text-field>
        <v-btn small @click.prevent="removeField('templates', index)" v-if="formData.templates.length > 1">Remove</v-btn>
      </div>
      <v-btn small @click.prevent="addField('templates')">Add Template</v-btn>

      <v-text-field label="Name: Please enter the explanation of the command" v-model="formData.name" :rules="[required]"></v-text-field>
      <!-- ... other fields ... -->
      <v-text-field label='Condition: Please enter json format. Ex:) If you want to ftp scan command, {".*": ["ftp", "21"]}' v-model="formData.condition"></v-text-field>
      <v-text-field label="Group: " v-model="formData.group"></v-text-field>

      <v-btn type="submit">Submit</v-btn>
    </form>
  </div>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);

export default {
  data() {
    return {
      formData: {
//        patterns: [""],
        templates: [""],
        name: "",
        condition: "",
        group: ""
      },
      required: value => !!value || 'Field is required',
//      patternsRequired: [true],
      templatesRequired: [true]
    };
  },
  methods: {
    addField(type) {
      this.formData[type].push("");
      /*
      if (type === 'patterns') {
        this.patternsRequired.push(true);
      } else {*/
        this.templatesRequired.push(true);
//      }
    },
    removeField(type, index) {
      this.formData[type].splice(index, 1);
/*      if (type === 'patterns') {
        this.patternsRequired.splice(index, 1);
      } else {*/
        this.templatesRequired.splice(index, 1);
//      }

    },
    submitForm() {
//      const arePatternsValid = this.formData.patterns.every(pattern => pattern.trim() !== "");
      const areTemplatesValid = this.formData.templates.every(template => template.trim() !== "");
      const isNameValid = this.formData.name.trim() !== "";
//      if (arePatternsValid && areTemplatesValid && isNameValid) {
      if (areTemplatesValid && isNameValid) {
        echidna
        .addCommand(this.formData)
        .then(({ data: messages }) => {
          console.log("messages=", messages);
          alert("The entered command has been successfully added to the command list file (Echidna/server/api_server/commands/commands.txt). \n" + messages);
        })
        .catch((error) => {
          console.error(error);
        });
      }else{
        alert("Template, Name are reuired");
      }
    }
  }
};
</script>

<style scoped>
.container {
  width: 60%;
  margin: 0 auto; 
}
</style>
