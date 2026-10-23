import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Store from './pages/Store.vue'
import Login from './pages/Login.vue'
import Cart from './pages/Cart.vue'
import Orders from './pages/Orders.vue'
import Admin from './pages/Admin.vue'
import { session } from './api'
import './style.css'
const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/', component: Store }, { path: '/login', component: Login },
  { path: '/cart', component: Cart, meta: { auth: true } },
  { path: '/orders', component: Orders, meta: { auth: true } },
  { path: '/admin', component: Admin, meta: { auth: true, admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
] })
router.beforeEach(to => { if (to.meta.auth && !session.user) return { path: '/login', query: { next: to.path } }; if (to.meta.admin && session.user?.role !== 'ADMIN') return '/' })
createApp(App).use(router).mount('#app')
