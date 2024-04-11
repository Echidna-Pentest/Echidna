// Composables
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        // route level code-splitting
        // this generates a separate chunk (Home-[hash].js) for this route
        // which is lazy-loaded when the route is visited.
        component: () => import('@/views/Home.vue'),
      },
      {
        path: 'History',
        name: 'History',
        component: () => import('@/views/History.vue'),
      },
      {
        path: 'Graph',
        name: 'Graph',
        component: () => import('@/views/Graph.vue'),
      },
      {
        path: 'TerminalList',
        name: 'TerminalList',
        component: () => import('@/views/TerminalList.vue'),
      },
      {
        path: 'AddCmd',
        name: 'AddCmd',
        component: () => import('@/views/AddCmd.vue'),
      },
      {
        path: 'About',
        name: 'About',
        component: () => import('@/views/About.vue'),
      },
    ],
  },
]

/* global process */
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
