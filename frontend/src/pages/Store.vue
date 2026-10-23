<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, send, session, money } from '../api'
const products=ref([]),config=ref({rates:{USD:1,EUR:.92,GBP:.79}}),loading=ref(true),error=ref(''),message=ref(''),category=ref('All'),search=ref(''),currency=ref('USD'),sort=ref('featured'),busy=ref(null),selected=ref(null)
const router=useRouter()
const detail=ref(null)
watch(selected,async value=>{if(value){await nextTick();detail.value.showModal()}else detail.value?.close()})
const visible=computed(()=>{let rows=products.value.filter(p=>(category.value==='All'||p.category===category.value)&&(p.name+' '+p.description).toLowerCase().includes(search.value.toLowerCase()));if(sort.value==='price')rows.sort((a,b)=>a.price-b.price);return rows})
const price=p=>money(Math.round(Number(p.price)*config.value.rates[currency.value]*100)/100,currency.value)
async function load(){loading.value=true;error.value='';try{[products.value,config.value]=await Promise.all([api('/products'),api('/config')])}catch(e){error.value=e.message}finally{loading.value=false}}
async function add(p){if(!session.user){router.push({path:'/login',query:{next:'/'}});return}busy.value=p.id;error.value='';message.value='';try{const cart=await api('/cart');const qty=(cart.find(x=>x.id===p.id)?.quantity||0)+1;await api('/cart/'+p.id,send('PUT',{quantity:qty}));message.value=p.name+' 已加入购物车'}catch(e){error.value=e.message}finally{busy.value=null}}
onMounted(load)
</script>
<template>
  <section class="hero"><div class="hero-copy"><div class="edition"><span class="live-dot"></span> THE EVERYDAY COLLECTION</div><h1>Good things.<br>Beyond borders<span class="dot">.</span></h1><p>为日常挑选，也为远方准备。<br>探索简单、实用、经得起时间的生活好物。</p><a class="button" href="#collection">探索精选好物 <span>↓</span></a><div class="hero-note">从一件好物开始，连接世界的日常。</div></div>
    <div class="hero-art"><div class="orbit"></div><img src="/images/bottle.svg" alt="Trail 保温水瓶" class="hero-bottle"><div class="hero-label"><span>TAKE THE LONG WAY HOME</span><strong>Made for<br>every day.</strong></div><div class="shipping-stamp">全球精选<br><b>H / C</b><br>用心送达</div></div>
  </section>
  <div class="benefit-strip"><span><b>↗</b> 跨境直达 · 美国 / 德国 / 英国</span><span><b>◎</b> 满 US$100 免运费</span><span><b>◇</b> USD / EUR / GBP 透明计价</span></div>
  <section class="collection" id="collection"><div class="section-heading"><div><p class="subtle">CURATED FOR YOUR EVERYDAY</p><h2>日常，值得认真挑选。</h2></div><label class="currency-label">显示币种<select v-model="currency"><option>USD</option><option>EUR</option><option>GBP</option></select></label></div>
    <div class="catalog-toolbar"><div class="tabs" aria-label="商品分类"><button v-for="c in ['All','Home','Travel','Desk']" :key="c" :class="{active:category===c}" :aria-pressed="category===c" @click="category=c">{{({All:'全部好物',Home:'居家生活',Travel:'出行随身',Desk:'桌面灵感'})[c]}}</button></div><div class="filters"><input v-model="search" aria-label="搜索商品" placeholder="搜索好物…"><select v-model="sort" aria-label="排序"><option value="featured">精选排序</option><option value="price">价格从低到高</option></select></div></div>
    <p v-if="error" class="notice error" role="alert">{{error}} <button @click="load">重试</button></p><p v-if="message" class="notice success" role="status">{{message}} <RouterLink to="/cart">去结算 →</RouterLink></p>
    <div v-if="loading" class="product-grid" aria-busy="true"><div v-for="i in 6" :key="i" class="skeleton"></div></div>
    <p v-else-if="!visible.length" class="empty">没有找到符合条件的商品，试试其他关键词。</p>
    <div v-else class="product-grid"><article v-for="p in visible" :key="p.id" class="product-card"><button class="product-image" @click="selected=p" :aria-label="'查看 '+p.name"><span class="category-tag">{{p.category}}</span><img :src="p.image" :alt="p.name" loading="lazy"><span class="view-detail">查看详情 ↗</span></button><div class="product-meta"><div><h3><button class="text-button" @click="selected=p">{{p.name}}</button></h3><p>{{p.category==='Home'?'为家的片刻':p.category==='Desk'?'为专注而生':'陪你出发'}} · 库存 {{p.stock}}</p></div><strong>{{price(p)}}</strong></div><button class="add-button" :disabled="busy===p.id||p.stock===0" @click="add(p)">{{p.stock===0?'暂时售罄':busy===p.id?'正在加入…':'加入购物车'}} <span>＋</span></button></article></div>
    <p class="fine-print">价格按固定演示汇率换算；最终报价以结算页为准。进口关税由收件人承担。</p>
  </section>
  <dialog v-if="selected" ref="detail" class="detail-panel" aria-labelledby="product-title" @close="selected=null"><div class="detail-content"><button autofocus class="close-button" @click="selected=null" aria-label="关闭详情">×</button><img :src="selected.image" :alt="selected.name"><div><p class="subtle">{{selected.category}}</p><h2 id="product-title">{{selected.name}}</h2><p>{{selected.description}}</p><h3>{{price(selected)}}</h3><p>现有库存 {{selected.stock}} 件 · 中国仓发货</p><button class="button" :disabled="busy===selected.id||!selected.stock" @click="add(selected)">加入购物车</button><button class="text-button" @click="selected=null">返回商品列表</button><p role="status">{{message||error}}</p></div></div></dialog>
</template>
