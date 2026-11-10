function storageKey(userId) {
  return 'harborcart.pending-order.' + userId
}

function pendingOrder(userId) {
  const value = wx.getStorageSync(storageKey(userId))
  return value && value.requestKey ? value : null
}

function beginOrder(userId, fields) {
  const previous = pendingOrder(userId)
  if (previous) return previous
  // 请求键用于去重。登录鉴权由服务端令牌完成。
  const requestKey = 'wx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const payload = { requestKey, ...fields }
  // 发请求前落盘；网络超时或页面重建后仍可重试同一笔订单。
  wx.setStorageSync(storageKey(userId), payload)
  return payload
}

function finishOrder(userId) {
  wx.removeStorageSync(storageKey(userId))
}

module.exports = { pendingOrder, beginOrder, finishOrder }
