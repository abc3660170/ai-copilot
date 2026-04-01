import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'playground',
      component: () => import('../views/PlaygroundView.vue'),
    },
    {
      path: '/materials',
      name: 'materials',
      component: () => import('../views/MaterialsView.vue'),
    },
  ],
})

export default router
