<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, send, session } from './api'
const router = useRouter(), error = ref('')
async function logout() { try { await api('/auth/logout',send('POST')); session.token='';session.user=null;router.push('/') } catch(e) { error.value=e.message } }
</script>
<template>
  <div class="announcement">Independent essentials. Delivered across borders. <span>US / DE / GB</span></div>
  <header class="site-header"><RouterLink to="/" class="brand"><span class="brand-mark" aria-hidden="true">h.</span> HarborCart<span class="brand-caption">GOODS WITHOUT BORDERS</span></RouterLink>
    <nav aria-label="主导航"><RouterLink to="/">逛商城</RouterLink><RouterLink to="/orders">我的订单</RouterLink><RouterLink v-if="session.user?.role==='ADMIN'" to="/admin">运营后台</RouterLink><RouterLink to="/cart">购物车 <span aria-hidden="true">↗</span></RouterLink></nav>
    <div class="account"><template v-if="session.user"><span>{{session.user.name}}</span><button class="text-button" @click="logout">退出</button></template><RouterLink v-else to="/login" class="button secondary small">登录 / 注册</RouterLink></div>
  </header>
  <p v-if="error" class="notice error" role="alert">{{error}}</p>
  <main id="main"><RouterView /></main>
  <footer><RouterLink to="/" class="brand">HarborCart<span class="dot">.</span></RouterLink><p>让日常好物，抵达更远的生活。</p><span>学习演示项目 · 固定演示汇率 · 模拟支付 · 不含进口关税</span></footer>
</template>
