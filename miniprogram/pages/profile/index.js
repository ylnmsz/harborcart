const { request, ensureLogin, report } = require('../../utils/api')
const { pendingOrder } = require('../../utils/checkout')

Page({
  data: { user: null, pending: false, busy: false },
  onShow() {
    const user = getApp().globalData.user
    this.setData({ user, pending: !!(user && pendingOrder(user.id)) })
  },
  login() { ensureLogin() },
  orders() { wx.switchTab({ url: '/pages/orders/index' }) },
  cart() { wx.switchTab({ url: '/pages/cart/index' }) },
  resume() { if (ensureLogin()) wx.navigateTo({ url: '/pages/checkout/index' }) },
  async logout() {
    if (this.data.busy) return
    this.setData({ busy: true })
    try {
      await request('/auth/logout', 'POST')
      getApp().clearSession()
      this.onShow()
    } catch (error) { report(error); this.onShow() }
    finally { this.setData({ busy: false }) }
  }
})
