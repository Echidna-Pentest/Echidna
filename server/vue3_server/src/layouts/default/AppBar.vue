<template>
  <v-app-bar app dense height="30" v-if="$isLogin">
    <v-app-bar-title>
      <v-app-bar-nav-icon />
      Echidna
    </v-app-bar-title>
    <v-spacer></v-spacer>
    <v-btn to="/" height="25">Home</v-btn>
    <v-btn to="/History" height="25">History</v-btn>
    <v-btn to="/graph" height="25">Graph</v-btn>
    <v-btn to="/TerminalList" height="25">Terminals</v-btn>
    <v-btn to="/AddCmd" height="25">AddCmd</v-btn>
    <v-btn to="/about" height="25">About</v-btn>
  </v-app-bar>
</template>

<script setup>
  //
</script>
