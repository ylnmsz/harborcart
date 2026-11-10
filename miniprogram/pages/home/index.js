const { request } = require('../../utils/api')
const { categories, productView, filterProducts } = require('../../utils/catalog')

Page({
  data: { categories, products: [], keyword: '', category: '', sort: 'default', loading: true, error: '' },
  onLoad() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  onUnload() { clearTimeout(this.searchTimer) },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      this.products = (await request('/products')).map(productView)
      this.filter()
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ loading: false })
    }
  },
  filter() {
    const { keyword, category, sort } = this.data
    this.setData({ products: filterProducts(this.products || [], keyword, category, sort) })
  },
  search(event) {
    this.setData({ keyword: event.detail.value })
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.filter(), 250)
  },
  selectCategory(event) {
    this.setData({ category: event.currentTarget.dataset.value })
    this.filter()
  },
  toggleSort() {
    this.setData({ sort: this.data.sort === 'default' ? 'price' : 'default' })
    this.filter()
  },
  openProduct(event) {
    wx.navigateTo({ url: '/pages/detail/index?id=' + event.currentTarget.dataset.id })
  }
})
