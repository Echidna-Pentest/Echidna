<template>
  <v-app>
    <header>
      <v-app-bar app dense height="30" v-if="$store.state.isLogin">
        <v-app-bar-nav-icon></v-app-bar-nav-icon>
        <v-app-bar-title>Echidna</v-app-bar-title>
        <v-spacer></v-spacer>
        <v-btn to="/" height="25">Home</v-btn>
        <v-btn to="/History" height="25">History</v-btn>
        <v-btn to="/graph" height="25">Graph</v-btn>
        <v-btn to="/TerminalList" height="25">Terminals</v-btn>
        <v-btn to="/about" height="25">About</v-btn>
      </v-app-bar>
    </header>
    <v-main id="main">
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script>
</script>
