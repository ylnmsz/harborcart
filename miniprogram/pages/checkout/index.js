const { request, ensureLogin, report } = require('../../utils/api')
const { money } = require('../../utils/catalog')
const { pendingOrder, beginOrder, finishOrder } = require('../../utils/checkout')
const countries = [{ code: 'US', name: '美国' }, { code: 'DE', name: '德国' }, { code: 'GB', name: '英国' }]
const currencies = ['USD', 'EUR', 'GBP']

Page({
  data: { countries, currencies, countryIndex: 0, currencyIndex: 0, recipient: '', address: '', quote: null, loading: true, busy: false, error: '', pending: false, count: 0, loggedIn: false },
  onShow() { this.load() },
  onUnload() { this.quoteVersion = (this.quoteVersion || 0) + 1 },
  async load() {
    const user = getApp().globalData.user
    this.setData({ loggedIn: !!user })
    if (!user) { this.setData({ loading: false }); return }
    this.userId = user.id
    const pending = pendingOrder(user.id)
    this.setData({ loading: true, error: '', pending: !!pending })
    if (pending) {
      this.setData({
        recipient: pending.recipient, address: pending.address,
        countryIndex: countries.findIndex(item => item.code === pending.country),
        currencyIndex: currencies.indexOf(pending.currency), loading: false, quote: null
      })
      return
    }
    try {
      const rows = await request('/cart')
      this.setData({ count: rows.reduce((sum, row) => sum + row.quantity, 0) })
      if (!rows.length) throw new Error('购物车为空，请先添加商品')
      await this.refreshQuote()
    } catch (error) { this.setData({ error: error.message }) }
    finally { this.setData({ loading: false }) }
  },
  login() { ensureLogin() },
  async refreshQuote() {
    const version = (this.quoteVersion || 0) + 1
    this.quoteVersion = version
    this.setData({ quote: null, error: '' })
    const country = countries[this.data.countryIndex].code
    const currency = currencies[this.data.currencyIndex]
    try {
      const quote = await request('/quote?country=' + country + '&currency=' + currency)
      if (version === this.quoteVersion) this.setData({ quote: {
        subtotal: money(quote.subtotal, currency), shipping: money(quote.shipping, currency), total: money(quote.total, currency)
      } })
    } catch (error) {
      if (version === this.quoteVersion) this.setData({ error: error.message })
    }
  },
  changeCountry(event) {
    if (this.data.pending || this.data.busy) return
    this.setData({ countryIndex: Number(event.detail.value) })
    this.refreshQuote()
  },
  changeCurrency(event) {
    if (this.data.pending || this.data.busy) return
    this.setData({ currencyIndex: Number(event.detail.value) })
    this.refreshQuote()
  },
  inputRecipient(event) { this.setData({ recipient: event.detail.value }) },
  inputAddress(event) { this.setData({ address: event.detail.value }) },
  async submit() {
    if (this.data.busy || !ensureLogin()) return
    if (getApp().globalData.user.id !== this.userId) { await this.load(); return }
    const recipient = this.data.recipient.trim()
    const address = this.data.address.trim()
    if (!recipient || !address) { report(new Error('请填写收件人和完整地址')); return }
    if (!this.data.pending && (!this.data.quote || this.data.count === 0)) return
    this.setData({ busy: true, error: '' })
    try {
      const payload = beginOrder(this.userId, {
        currency: currencies[this.data.currencyIndex], country: countries[this.data.countryIndex].code,
        recipient, address
      })
      this.setData({ pending: true })
      await request('/orders', 'POST', payload)
      finishOrder(this.userId)
      this.setData({ pending: false })
      wx.showToast({ title: '订单已创建', icon: 'success' })
      wx.switchTab({ url: '/pages/orders/index' })
    } catch (error) {
      // 400/409 表示明确拒绝；超时或服务错误保留原请求，避免重复下单。
      if (error.status === 400 || error.status === 409) {
        finishOrder(this.userId)
        this.setData({ pending: false })
        await this.load()
      }
      this.setData({ error: error.message })
    } finally { this.setData({ busy: false }) }
  }
})
