const categories = [
  { value: '', label: '全部好物' },
  { value: 'Home', label: '居家日常' },
  { value: 'Desk', label: '桌面灵感' },
  { value: 'Travel', label: '轻装出行' }
]
const labels = { Home: '居家日常', Desk: '桌面灵感', Travel: '轻装出行' }

function money(amount, currency = 'USD') {
  const value = Number(amount)
  return currency + ' ' + (Number.isFinite(value) ? value.toFixed(2) : '—')
}

function productView(product) {
  const image = String(product.image || '').match(/^\/images\/(bottle|bag|lamp|cup|pouch|stand)\.svg$/)
  return {
    ...product,
    picture: '/assets/' + (image ? image[1] : 'bag') + '.png',
    categoryLabel: labels[product.category] || product.category,
    priceText: money(product.price),
    unavailable: product.active === false || product.stock < 1
  }
}

function filterProducts(products, keyword, category, sort) {
  const term = keyword.trim().toLowerCase()
  const filtered = products.filter(product =>
    (!category || product.category === category) &&
    (!term || (product.name + ' ' + product.description + ' ' + product.categoryLabel).toLowerCase().includes(term))
  )
  if (sort === 'price') filtered.sort((a, b) => Number(a.price) - Number(b.price) || a.id - b.id)
  return filtered
}

function orderView(order) {
  const statuses = { PENDING: '待付款', PAID: '待发货', SHIPPED: '已发货', CANCELLED: '已取消' }
  return {
    ...order,
    statusLabel: statuses[order.status] || order.status,
    totalText: money(order.total, order.currency),
    dateText: String(order.created_at || '').replace('T', ' ').slice(0, 16),
    items: (order.items || []).map(item => ({ ...item, priceText: money(item.unit_price, order.currency) }))
  }
}

module.exports = { categories, money, productView, filterProducts, orderView }
