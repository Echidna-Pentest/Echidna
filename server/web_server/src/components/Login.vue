<template>
  <v-app>
    <v-main id="main" class="overflow-y-auto">
      <v-card max-width="500" class="mx-auto">
      <v-card-title>
        <h2 class="text-center">Login</h2>
      </v-card-title>
      <v-card-text>
        <v-form>
          <v-text-field
            label="Username"
            v-model="authId"
            required
          ></v-text-field>
          <v-text-field
            label="Password"
            v-model="authPass"
            type="password"
            required
          ></v-text-field>
          <v-alert
            v-if="msg"
            :value="true"
            color="grey"
            dismissible
          >{{ msg }}</v-alert>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="post">Login</v-btn>
      </v-card-actions>
      </v-card>
    </v-main>
  </v-app>
</template>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  .login {
    margin-top: 20px;
    flex-flow: column nowrap;
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  input {
    margin: 10px 0;
    padding: 10px;
  }
</style>
<script>
  import { EchidnaAPI } from '@echidna/api';
  const echidna = new EchidnaAPI(location.hostname);

  export default {
    name: 'Login',
    data() {
      return {
        showPassword: false,
        msg: 'Please enter your userID and password.',
        authId: '',
        authPass: ''
      }
    },
    methods: {
      async post() {
        const data = { id: this.authId, pass: this.authPass };
        echidna
          .login(data.id, data.pass)
          .then(({ data: response }) => {
            console.log("response=", response.message);
            if (response.message == 'SUCCESS') {
              console.log("login SUCCESS", this.$store, " authiId=", this.authId);
              this.$store.dispatch("fetch", this.authId);
              this.$router.push('/');
            } else {
              this.msg = "Login failed"
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }
    }
  };
</script>