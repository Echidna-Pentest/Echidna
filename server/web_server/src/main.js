import Vue from 'vue'
import App from '@/App.vue'
import vuetify from '@/plugins/vuetify'
import VueRouter from 'vue-router'

import Home from '@/components/Home'
import TerminalList from '@/components/TerminalList'
import Terminal from '@/components/Terminal'
import History from '@/components/History'
import About from '@/components/About'
import VuejsDialog from 'vuejs-dialog';
import 'vuejs-dialog/dist/vuejs-dialog.min.css';
import Chat from '@/components/ChatBot'
import Login from '@/components/Login'
import Graph from '@/components/Graph'
import store from '@/store/index'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VuejsDialog)
Vue.use(Chat)
//Vue.use(Store)
Vue.use(Login)

const config = require('../echidna.json');

if (config.AuthRequired==false){
  store.state.isLogin = true;
}

const routes = [
  { path: '/', component: Home,  meta: { requiresAuth: true } },
  { path: '/TerminalList', component: TerminalList,  meta: { requiresAuth: true } },
  { path: '/terminal/:id', component: Terminal,  meta: { requiresAuth: true } },
  { path: '/History', component: History,  meta: { requiresAuth: true } },
  { path: '/about', component: About },
  { path: '/Login', component: Login },
  { path: '/Graph', component: Graph },
]

const router = new VueRouter({
  routes
})

router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!store.state.isLogin) {
      next({
        path: '/Login',
        query: {
          redirect: to.fullPath
        }
      })
    } else {
      next();
    }
  } else {
    next();
  }
});

import titleMixin from '@/title.js';
Vue.mixin(titleMixin)

new Vue({
  vuetify,
  store,
  router,
  render: h => h(App),
}).$mount('#app')
