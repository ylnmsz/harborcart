const { request, ensureLogin, report } = require('../../utils/api')
const { productView, money } = require('../../utils/catalog')
const { pendingOrder } = require('../../utils/checkout')

Page({
  data: { rows: [], total: '', count: 0, loading: false, loggedIn: false, error: '', busy: false, pending: false },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    const user = getApp().globalData.user
    this.setData({ loggedIn: !!user, rows: [], error: '', pending: !!(user && pendingOrder(user.id)) })
    if (!user) return
    this.setData({ loading: true })
    try {
      const rows = (await request('/cart')).map(productView)
      const cents = rows.reduce((sum, row) => sum + Math.round(Number(row.price) * 100) * row.quantity, 0)
      this.setData({ rows, total: money(cents / 100), count: rows.reduce((sum, row) => sum + row.quantity, 0) })
    } catch (error) { this.setData({ error: error.message, loggedIn: !!getApp().globalData.user }) }
    finally { this.setData({ loading: false }) }
  },
  async change(event) {
    if (this.data.busy || this.data.pending) return
    const { id, quantity } = event.currentTarget.dataset
    this.setData({ busy: true })
    try {
      await request('/cart/' + id, 'PUT', { quantity: Number(quantity) })
      await this.load()
    } catch (error) { report(error) }
    finally { this.setData({ busy: false }) }
  },
  login() { ensureLogin() },
  browse() { wx.switchTab({ url: '/pages/home/index' }) },
  checkout() {
    if (ensureLogin()) wx.navigateTo({ url: '/pages/checkout/index' })
  }
})
