App({
  globalData: { token: '', user: null },
  setSession(session) {
    this.globalData.token = session.token
    this.globalData.user = session.user
  },
  clearSession() {
    this.globalData.token = ''
    this.globalData.user = null
  }
})
