const { request, ensureLogin, report } = require('../../utils/api')
const { orderView } = require('../../utils/catalog')
const { pendingOrder, finishOrder } = require('../../utils/checkout')
const filters = [{ value: '', label: '全部' }, { value: 'PENDING', label: '待付款' }, { value: 'PAID', label: '待发货' }, { value: 'SHIPPED', label: '已发货' }, { value: 'CANCELLED', label: '已取消' }]

Page({
  data: { orders: [], filters, filter: '', loading: false, loggedIn: false, error: '', busy: false, demo: false },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    const user = getApp().globalData.user
    this.setData({ loggedIn: !!user, orders: [], error: '' })
    if (!user) return
    this.setData({ loading: true })
    try {
      const [orders, config] = await Promise.all([request('/orders'), request('/config')])
      const pending = pendingOrder(user.id)
      if (pending && orders.some(order => order.request_key === pending.requestKey)) finishOrder(user.id)
      this.orders = orders.map(orderView)
      this.setData({ demo: config.demo })
      this.filterOrders()
    } catch (error) { this.setData({ error: error.message, loggedIn: !!getApp().globalData.user }) }
    finally { this.setData({ loading: false }) }
  },
  selectFilter(event) { this.setData({ filter: event.currentTarget.dataset.value }); this.filterOrders() },
  filterOrders() { this.setData({ orders: (this.orders || []).filter(order => !this.data.filter || order.status === this.data.filter) }) },
  login() { ensureLogin() },
  browse() { wx.switchTab({ url: '/pages/home/index' }) },
  async act(event) {
    if (this.data.busy) return
    const { id, action } = event.currentTarget.dataset
    if (!['pay', 'cancel'].includes(action)) return
    const confirmed = await new Promise(resolve => wx.showModal({
      title: action === 'pay' ? '模拟付款' : '取消订单',
      content: action === 'pay' ? '仅将订单标为已付款，不会产生真实扣费。' : '确认取消这笔待付款订单？取消后将回补库存。',
      success: result => resolve(result.confirm), fail: () => resolve(false)
    }))
    if (!confirmed) return
    this.setData({ busy: true })
    try {
      await request('/orders/' + id + '/' + action, 'POST')
      await this.load()
      wx.showToast({ title: action === 'pay' ? '模拟付款成功' : '订单已取消', icon: 'success' })
    } catch (error) { report(error); await this.load() }
    finally { this.setData({ busy: false }) }
  }
})
