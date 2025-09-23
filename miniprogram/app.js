// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "cloud1-3gm1gip6d3aa4333" // 替换为你的云开发环境ID
    };
    
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，请升级至最新版本',
        showCancel: false
      });
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
      
      // 初始化用户数据
      this.initUserData();
    }
  },
  
  initUserData: function() {
    // 获取用户openid
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'get_user_info'
      }
    }).then(res => {
      if (res.result && res.result.success) {
        this.globalData.userInfo = res.result.data;
      }
    }).catch(err => {
      console.log('获取用户信息失败:', err);
    });
  },
  
  globalData: {
    userInfo: null,
    currentTest: null,
    testResults: []
  }
});
