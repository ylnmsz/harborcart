import assert from 'node:assert/strict'
import net from 'node:net'
import fs from 'node:fs'
const base=process.env.API_URL||'http://127.0.0.1:8080/api',checks=[]
const ok=(name)=>{checks.push(name);console.log('PASS',name)}
async function call(path,{token,method='GET',body,status=200}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();const data=text?JSON.parse(text):null;assert.equal(r.status,status,`${method} ${path}: ${text}`);return data}
async function redis(...args){return new Promise((resolve,reject)=>{const socket=net.connect(Number(process.env.REDIS_PORT||6380),process.env.REDIS_HOST||'127.0.0.1');socket.setTimeout(3000);socket.on('connect',()=>socket.write('*'+args.length+'\r\n'+args.map(x=>'$'+Buffer.byteLength(x)+'\r\n'+x+'\r\n').join('')));socket.once('data',b=>{socket.end();const s=b.toString();if(s[0]===':')resolve(Number(s.slice(1).trim()));else if(s[0]==='+')resolve(s.slice(1).trim());else reject(Error(s))});socket.on('error',reject);socket.on('timeout',()=>{socket.destroy();reject(Error('Redis timeout'))})})}
const stamp=Date.now(),password='SmokeTest123!',admin=(await call('/auth/login',{method:'POST',body:{email:'admin@harborcart.demo',password:'AdminDemo123!'}})).token
const a=await call('/auth/register',{method:'POST',body:{email:`smoke-a-${stamp}@test.dev`,password,name:'Smoke A'}}),b=await call('/auth/register',{method:'POST',body:{email:`smoke-b-${stamp}@test.dev`,password,name:'Smoke B'}})
ok('MySQL 注册与 BCrypt 登录')
await call('/cart',{status:401});await call('/admin/products',{token:a.token,status:403});ok('未登录与管理员权限隔离')
const product={name:`Integration ${stamp}`,category:'Travel',description:'Integration test product',price:32,stock:2,image:'/images/bottle.svg',active:true}
await call('/admin/products',{token:admin,method:'POST',body:product});const p=(await call('/admin/products',{token:admin})).find(x=>x.name===product.name)
await call('/products');assert.equal(await redis('EXISTS','harborcart:catalog:v1'),1);const ttl=await redis('TTL','harborcart:catalog:v1');assert.ok(ttl>0&&ttl<=60);ok('Redis 真实缓存写入与 TTL')
await call('/admin/products/'+p.id,{token:admin,method:'PUT',body:product});assert.equal(await redis('EXISTS','harborcart:catalog:v1'),0);ok('商品事务提交后删除缓存')
await call('/cart/'+p.id,{token:a.token,method:'PUT',body:{quantity:-1},status:400});await call('/cart/'+p.id,{token:a.token,method:'PUT',body:{quantity:2}})
const q=await call('/quote?currency=EUR&country=DE',{token:a.token});assert.equal(Number(q.total),72.68);ok('服务端 BigDecimal 跨币种商品与运费计价')
const input={requestKey:`smoke-${stamp}`,currency:'EUR',country:'DE',recipient:'Smoke Buyer',address:'Berlin 10115, Test street 1'}
const first=await call('/orders',{token:a.token,method:'POST',body:input}),second=await call('/orders',{token:a.token,method:'POST',body:input});assert.equal(first.id,second.id);assert.equal((await call('/admin/products',{token:admin})).find(x=>x.id===p.id).stock,0);ok('下单幂等且只扣一次库存')
await call(`/orders/${first.id}/pay`,{token:b.token,method:'POST',status:404});ok('订单归属校验，禁止跨用户付款')
await call(`/orders/${first.id}/cancel`,{token:a.token,method:'POST'});await call(`/orders/${first.id}/cancel`,{token:a.token,method:'POST'});assert.equal((await call('/admin/products',{token:admin})).find(x=>x.id===p.id).stock,2);ok('重复取消只回补一次库存')
await call('/admin/products/'+p.id,{token:admin,method:'PUT',body:{...product,stock:1}})
for(const token of [a.token,b.token])await call('/cart/'+p.id,{token,method:'PUT',body:{quantity:1}})
const results=await Promise.all([a,b].map(async u=>{const r=await fetch(base+'/orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+u.token},body:JSON.stringify({...input,requestKey:`race-${stamp}`})});return {status:r.status,order:await r.json(),token:u.token}}))
assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal((await call('/admin/products',{token:admin})).find(x=>x.id===p.id).stock,0);ok('MySQL 两买家争抢最后一件库存，无超卖')
const winner=results.find(x=>x.status===200)
await call(`/admin/orders/${winner.order.id}/ship`,{token:admin,method:'POST',body:{tracking:'SMOKE-TRACK'},status:409});await call(`/orders/${winner.order.id}/pay`,{token:winner.token,method:'POST'});await call(`/orders/${winner.order.id}/cancel`,{token:winner.token,method:'POST',status:409});await call(`/admin/orders/${winner.order.id}/ship`,{token:admin,method:'POST',body:{tracking:'SMOKE-TRACK'}})
assert.equal((await call('/orders',{token:winner.token})).find(x=>x.id===winner.order.id).status,'SHIPPED');ok('付款、禁止已付款取消、运营发货状态闭环')
await call('/admin/products/'+p.id,{token:admin,method:'PUT',body:{...product,stock:0,active:false}});ok('测试商品下架，不污染买家目录')
await call('/auth/logout',{token:a.token,method:'POST'});await call('/cart',{token:a.token,status:401});ok('退出后令牌立即失效')
const report={time:new Date().toISOString(),database:'MySQL 8.4',redis:'Redis 7.4',checks,count:checks.length}
fs.writeFileSync(new URL('../docs/smoke-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.length}))
