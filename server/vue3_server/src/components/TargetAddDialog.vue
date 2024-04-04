<template>
  <v-dialog
    v-model="active"
    max-width="600px"
    scrollable
  >
    <v-card
      title="Add Target"
    >
      <v-card-text style="height: 600px;">
        <v-container>
          <v-row v-if="isHost">
            <v-col cols="4">
              <span>OS</span>
            </v-col>
            <v-col cols="8">
              <v-radio-group v-model="info.os" inline>
                <v-radio label="Windows" value="Windows" />
                <v-radio label="Linux" value="Linux" />
              </v-radio-group>
            </v-col>
            <v-col cols="4">
              <span>Get Root Shell?</span>
            </v-col>
            <v-col cols="8">
              <v-radio-group v-model="info.root" inline>
                <v-radio label="Yes" value="yes" />
                <v-radio label="No" value="no" />
              </v-radio-group>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="4">
              <span>Credentials</span>
            </v-col>
            <v-col cols="4">
              <v-text-field v-model="info.userId" label="Username"></v-text-field>
            </v-col>
            <v-col cols="4">
              <v-text-field v-model="info.password" label="Password"></v-text-field>
            </v-col>
            <v-col cols="4">
                Notes
            </v-col>
            <v-col cols="8">
              <v-text-field v-model="info.notes" label="You can add any notes. Please input \t if you want to add parent and child node." />
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="green-darken-1" text @click="active = false">Cancel</v-btn>    
        <v-btn color="green-darken-1" text @click="addTarget">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { ref, reactive, inject } from "vue";
  
  const active = ref(false);
  const info = reactive({
    os: "",
    root: "",
    userId: "",
    password: "",
    notes: "",
  });
  const isHost = ref(false);
  

  const echidna = inject("$echidna");
  let target = {};
  
  const show = (target_, isHost_) => {
    target = target_;
    info.os = target_.os ?? "";
    info.os = target_.os ?? "";
    info.os = target_.os ?? "";
    info.root = target_.root ?? "";
    info.userId = target_.Credential?.userid ?? "";
    info.password = target_.Credential?.password ?? "";
    info.nots = target_.notes ?? "";
    isHost.value = isHost_;
    active.value = true;
  }

  const addTarget = () => {
    active.value = false;
    const inputdata = {
      os: info.os,
      root: info.root,
      Credential: {
        userid: info.userId,
        password: info.password,
      },
      notes: info.notes,
    };
    return echidna
      .updateTarget(target.id, inputdata)
      .catch((error) => {
        console.error(error);
      });
  };

  defineExpose({
    show,
  });

</script>
