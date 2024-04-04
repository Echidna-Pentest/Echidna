/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Echidna API
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'
import Notifications from '@kyvg/vue3-notification'

// Composables
import { createApp } from 'vue'

const app = createApp(App)

registerPlugins(app)

app.config.globalProperties.$isLogin = true;
app.config.globalProperties.$echidna = echidna;
app.provide("$echidna", echidna);
app.use(Notifications);
app.mount('#app')
