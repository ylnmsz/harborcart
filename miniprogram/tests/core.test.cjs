const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const { request } = require('../utils/api')
const { productView, filterProducts, money } = require('../utils/catalog')
const { beginOrder, pendingOrder, finishOrder } = require('../utils/checkout')

let app
let storage
function reset() {
  app = { globalData: { token: 'old-token', user: { id: 7 } }, clearSession() { this.globalData = { token: '', user: null } } }
  storage = new Map()
  global.getApp = () => app
  global.wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    removeStorageSync: key => storage.delete(key), showToast() {}, navigateTo() {}, switchTab() {}
  }
}

function loadPage(name) {
  let definition
  global.Page = value => { definition = value }
  const filename = path.join(root, 'pages', name, 'index.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const page = { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value) } }
  return page
}

test('all configured pages, handlers and local images exist', () => {
  reset()
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json')))
  const tags = new Set(['view', 'text', 'image', 'input', 'textarea', 'button', 'picker', 'block'])
  for (const route of config.pages) {
    const page = loadPage(route.split('/')[1])
    for (const suffix of ['.js', '.json', '.wxml', '.wxss']) assert.ok(fs.existsSync(path.join(root, route + suffix)), route + suffix)
    JSON.parse(fs.readFileSync(path.join(root, route + '.json')))
    const template = fs.readFileSync(path.join(root, route + '.wxml'), 'utf8')
    for (const match of template.matchAll(/\b(?:bind|catch)\w+="(\w+)"/g)) assert.equal(typeof page[match[1]], 'function', route + ':' + match[1])
    for (const match of template.matchAll(/<\/?([a-zA-Z][\w-]*)/g)) assert.ok(tags.has(match[1]), 'unsupported tag ' + match[1])
    for (const match of template.matchAll(/src="(\/assets\/[^"{}]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])))
  }
  for (const tab of config.tabBar.list) {
    assert.ok(config.pages.includes(tab.pagePath))
    for (const icon of [tab.iconPath, tab.selectedIconPath]) assert.ok(fs.statSync(path.join(root, icon)).size < 40 * 1024)
  }
  for (const name of ['bottle', 'bag', 'lamp', 'cup', 'pouch', 'stand']) assert.ok(fs.statSync(path.join(root, 'assets', name + '.png')).size > 100)
})

test('catalog search, category, numeric price sorting and unavailable goods', () => {
  const rows = [
    { id: 1, name: 'Cup', description: 'Ceramic', category: 'Home', price: '24.00', stock: 2, active: true, image: '/images/cup.svg' },
    { id: 2, name: 'Lamp', description: 'Light', category: 'Desk', price: '8.00', stock: 0, active: true, image: '/images/lamp.svg' }
  ].map(productView)
  assert.equal(filterProducts(rows, ' CERAMIC ', 'Home', 'default').length, 1)
  assert.deepEqual(filterProducts(rows, '', '', 'price').map(item => item.id), [2, 1])
  assert.deepEqual(rows.map(item => item.id), [1, 2])
  assert.equal(rows[1].unavailable, true)
  assert.equal(rows[0].picture, '/assets/cup.png')
  assert.equal(money('24.1', 'EUR'), 'EUR 24.10')
})

test('request sends bearer token and accepts empty successful responses', async () => {
  reset()
  wx.request = options => {
    assert.equal(options.header.Authorization, 'Bearer old-token')
    assert.equal(options.method, 'PUT')
    options.success({ statusCode: 200, data: '' })
  }
  assert.equal(await request('/cart/1', 'PUT', { quantity: 2 }), '')
})

test('401 clears the matching session, but an old request cannot clear a newer login', async () => {
  reset()
  wx.request = options => options.success({ statusCode: 401, data: { message: 'expired' } })
  await assert.rejects(request('/cart'), error => error.status === 401)
  assert.equal(app.globalData.token, '')
  app.globalData.token = 'old-token'
  wx.request = options => {
    app.globalData.token = 'new-token'
    options.success({ statusCode: 401, data: {} })
  }
  await assert.rejects(request('/cart'))
  assert.equal(app.globalData.token, 'new-token')
})

test('network failure is treated as an uncertain outcome', async () => {
  reset()
  wx.request = options => options.fail({ errMsg: 'timeout' })
  await assert.rejects(request('/orders', 'POST', {}), error => error.uncertain === true)
})

test('pending checkout persists original payload and is scoped to the user', () => {
  reset()
  const original = beginOrder(7, { address: 'First address', currency: 'USD' })
  assert.deepEqual(beginOrder(7, { address: 'Changed', currency: 'EUR' }), original)
  assert.equal(pendingOrder(8), null)
  finishOrder(7)
  assert.equal(pendingOrder(7), null)
})

test('stale quote cannot replace the latest country/currency quote', async () => {
  reset()
  const page = loadPage('checkout')
  const requests = []
  wx.request = options => requests.push(options)
  const first = page.refreshQuote()
  page.setData({ currencyIndex: 1, countryIndex: 1 })
  const second = page.refreshQuote()
  requests[1].success({ statusCode: 200, data: { subtotal: 40, shipping: 12, total: 52 } })
  await second
  requests[0].success({ statusCode: 200, data: { subtotal: 99, shipping: 12, total: 111 } })
  await first
  assert.equal(page.data.quote.total, 'EUR 52.00')
})

test('checkout timeout retries original key and payload after page reconstruction', async () => {
  reset()
  let firstPayload
  const page = loadPage('checkout')
  page.userId = 7
  page.setData({ recipient: 'Alex', address: 'Original address', count: 1, quote: { total: 'USD 44.00' } })
  wx.request = options => { firstPayload = structuredClone(options.data); options.fail({}) }
  await page.submit()
  assert.equal(page.data.pending, true)
  const restored = loadPage('checkout')
  await restored.load()
  assert.equal(restored.data.address, 'Original address')
  let destination
  wx.switchTab = options => { destination = options.url }
  wx.request = options => {
    assert.deepEqual(options.data, firstPayload)
    options.success({ statusCode: 200, data: { id: 9 } })
  }
  await restored.submit()
  assert.equal(pendingOrder(7), null)
  assert.equal(destination, '/pages/orders/index')
})

test('checkout blocks re-entry while a submit is in flight', async () => {
  reset()
  const page = loadPage('checkout')
  page.userId = 7
  page.setData({ recipient: 'Alex', address: 'Address', count: 1, quote: {} })
  let calls = 0
  let completion
  wx.request = options => { calls++; completion = options }
  const first = page.submit()
  await page.submit()
  assert.equal(calls, 1)
  completion.success({ statusCode: 200, data: { id: 1 } })
  await first
})

test('pending order prevents adding another product before recovery', async () => {
  reset()
  beginOrder(7, { address: 'Address' })
  const page = loadPage('detail')
  let destination
  wx.navigateTo = options => { destination = options.url }
  wx.request = () => { throw new Error('Cart must not change') }
  await page.add()
  assert.equal(destination, '/pages/checkout/index')
})
