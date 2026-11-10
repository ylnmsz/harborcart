// Uses the real local backend and the actual mini-program request/page modules.
// Creates a uniquely named demo user and two orders in the local demo database.
const assert = require('node:assert/strict')
const { baseUrl } = require('../config')
const { request } = require('../utils/api')
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname), 'Only run against a local demo backend')

const storage = new Map()
let app
global.App = definition => { app = definition }
require('../app')
global.getApp = () => app
global.wx = {
  request(options) {
    fetch(options.url, {
      method: options.method, headers: options.header,
      body: options.data === undefined ? undefined : JSON.stringify(options.data), signal: AbortSignal.timeout(options.timeout)
    }).then(async response => {
      const text = await response.text()
      options.success({ statusCode: response.status, data: text ? JSON.parse(text) : '' })
    }).catch(options.fail)
  },
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: key => storage.delete(key), showToast() {}, switchTab() {}, navigateBack() {},
  showModal(options) { options.success({ confirm: true }) }
}

function page(name) {
  let definition
  global.Page = value => { definition = value }
  require('../pages/' + name + '/index')
  return { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value) } }
}

async function main() {
  assert.equal((await request('/config')).demo, true, 'Requires demo mode')
  const suffix = Date.now().toString(36)
  const login = page('login')
  login.setData({ registering: true, email: `mini-${suffix}@example.test`, password: 'MiniDemo123!', name: '小程序验证' })
  await login.submit()
  assert.ok(app.globalData.token, login.data.error)
  const buyerSession = structuredClone(app.globalData)
  const home = page('home')
  await home.load()
  assert.equal(home.data.error, '')
  const product = home.data.products.find(item => item.stock >= 3)
  assert.ok(product)
  const initialStock = product.stock
  const detail = page('detail')
  detail.productId = product.id
  await detail.load()
  await detail.add()
  const cart = page('cart')
  await cart.load()
  assert.equal(cart.data.count, 1)
  const checkout = page('checkout')
  await checkout.load()
  assert.ok(checkout.data.quote)
  checkout.setData({ recipient: 'Mini Demo', address: '100 Demo Street, Seattle WA 98101' })
  await checkout.submit()
  assert.equal(checkout.data.error, '')
  assert.equal((await request('/cart')).length, 0)
  const orders = page('orders')
  await orders.load()
  const order = orders.data.orders[0]
  assert.equal(order.status, 'PENDING')
  const retry = await request('/orders', 'POST', { requestKey: order.request_key, currency: 'USD', country: 'US', recipient: 'Mini Demo', address: '100 Demo Street, Seattle WA 98101' })
  assert.equal(retry.id, order.id)
  await orders.act({ currentTarget: { dataset: { id: order.id, action: 'pay' } } })
  assert.equal(orders.data.orders[0].status, 'PAID')
  await assert.rejects(request('/admin/orders'), error => error.status === 403)
  app.setSession(await request('/auth/login', 'POST', { email: 'admin@harborcart.demo', password: 'AdminDemo123!' }))
  await request('/admin/orders/' + order.id + '/ship', 'POST', { tracking: 'MINI-' + suffix })
  app.setSession(buyerSession)
  await orders.load()
  assert.equal(orders.data.orders[0].status, 'SHIPPED')
  assert.equal(orders.data.orders[0].tracking, 'MINI-' + suffix)
  await detail.add()
  await checkout.load()
  await checkout.submit()
  await orders.load()
  const cancelled = orders.data.orders[0]
  await orders.act({ currentTarget: { dataset: { id: cancelled.id, action: 'cancel' } } })
  assert.equal(orders.data.orders[0].status, 'CANCELLED')
  const updated = (await request('/products')).find(item => item.id === product.id)
  assert.equal(updated.stock, initialStock - 1)
  const profile = page('profile')
  await profile.logout()
  assert.equal(app.globalData.token, '')
  app.setSession(buyerSession)
  await assert.rejects(request('/cart'), error => error.status === 401)
  console.log('PASS: registration, catalog, detail, cart, quote, checkout, idempotency, mock payment, admin permissions, shipping, cancellation, stock restoration, logout and token revocation.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
