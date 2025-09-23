// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    testResults: [],
    loading: true
  },

  onLoad: function (options) {
    this.setData({
      userInfo: app.globalData.userInfo
    });
    this.loadUserResults();
  },

  onShow: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    }
  },

  // 加载用户测试结果
  loadUserResults: function () {
    this.setData({ loading: true });
    
    if (app.globalData.testResults && app.globalData.testResults.length > 0) {
      this.setData({
        testResults: app.globalData.testResults,
        loading: false
      });
      return;
    }
    
    // 如果没有缓存的数据，从云函数获取
    if (app.globalData.userInfo) {
      wx.cloud.callFunction({
        name: 'mbti-service',
        data: {
          action: 'get_user_results',
          user_id: app.globalData.userInfo.openid,
          limit: 20
        }
      }).then(res => {
        if (res.result && res.result.success) {
          const results = res.result.data;
          app.globalData.testResults = results;
          this.setData({
            testResults: results,
            loading: false
          });
        } else {
          this.setData({ loading: false });
        }
      }).catch(err => {
        console.error('加载用户结果失败:', err);
        this.setData({ loading: false });
      });
    } else {
      this.setData({ loading: false });
    }
  },

  // 跳转到结果页面
  viewResult: function (e) {
    const resultId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/result/result?id=${resultId}`
    });
  },

  // 获取用户授权
  getUserProfile: function () {
    if (this.data.userInfo) {
      return;
    }
    
    wx.getUserProfile({
      desc: '用于完善用户信息和保存测试记录',
      success: (res) => {
        const userInfo = {
          nickName: res.userInfo.nickName,
          avatarUrl: res.userInfo.avatarUrl
        };
        app.globalData.userInfo = userInfo;
        this.setData({
          userInfo
        });
        
        // 重新加载用户结果
        this.loadUserResults();
      },
      fail: (err) => {
        console.log('获取用户信息失败:', err);
      }
    });
  },

  // 返回首页
  goToHome: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 分享功能
  shareApp: function () {
    return {
      title: 'MBTI性格测试 - 发现真实的自己',
      path: '/pages/index/index',
      imageUrl: '/images/share-banner.png'
    };
  }
})