const { baseUrl } = require('../config')

function request(path, method = 'GET', data) {
  const app = getApp()
  const token = app.globalData.token
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + path,
      method,
      data,
      timeout: 15000,
      header: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }
        if (response.statusCode === 401 && app.globalData.token === token) app.clearSession()
        const message = response.data && response.data.message
        const error = new Error(typeof message === 'string' ? message : '服务暂时不可用，请稍后重试')
        error.status = response.statusCode
        reject(error)
      },
      fail() {
        const error = new Error('连接失败或超时，请检查网络与服务地址')
        error.uncertain = true
        reject(error)
      }
    })
  })
}

function ensureLogin() {
  if (getApp().globalData.token) return true
  wx.navigateTo({ url: '/pages/login/index' })
  return false
}

function report(error) {
  wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none', duration: 2500 })
}

module.exports = { request, ensureLogin, report }
