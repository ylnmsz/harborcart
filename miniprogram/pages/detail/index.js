const { request, ensureLogin, report } = require('../../utils/api')
const { productView } = require('../../utils/catalog')
const { pendingOrder } = require('../../utils/checkout')

Page({
  data: { product: null, loading: true, error: '', quantity: 1, busy: false },
  onLoad(options) { this.productId = Number(options.id); this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const products = await request('/products')
      const product = products.find(item => item.id === this.productId)
      if (!product) throw new Error('商品已下架或不存在')
      this.setData({ product: productView(product) })
    } catch (error) { this.setData({ error: error.message }) }
    finally { this.setData({ loading: false }) }
  },
  decrease() { this.setData({ quantity: Math.max(1, this.data.quantity - 1) }) },
  increase() { this.setData({ quantity: Math.min(99, this.data.product.stock, this.data.quantity + 1) }) },
  async add() {
    if (this.data.busy || !ensureLogin()) return
    if (pendingOrder(getApp().globalData.user.id)) {
      wx.navigateTo({ url: '/pages/checkout/index' })
      return
    }
    this.setData({ busy: true })
    try {
      const cart = await request('/cart')
      const existing = cart.find(item => item.id === this.productId)
      const quantity = (existing ? existing.quantity : 0) + this.data.quantity
      if (quantity > 99 || quantity > this.data.product.stock) throw new Error('加上购物车内数量后超过可购买数量')
      await request('/cart/' + this.productId, 'PUT', { quantity })
      wx.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) { report(error) }
    finally { this.setData({ busy: false }) }
  },
  openCart() { wx.switchTab({ url: '/pages/cart/index' }) }
})
