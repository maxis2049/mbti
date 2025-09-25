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
    
    // 从云函数获取测试记录（不需要完整用户信息，只需要openid）
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'get_user_results',
        limit: 20
      }
    }).then(res => {
       if (res.result && res.result.success) {
         const results = res.result.data.map(item => ({
           ...item,
           created_at: this.formatTime(item.created_at)
         }));
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
  },

  // 跳转到结果页面
  viewResult: function (e) {
    const resultId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/result/result?id=${resultId}`
    });
  },

  // 获取用户授权
  // 选择头像
  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail;
    const currentUserInfo = app.globalData.userInfo || {};
    const userInfo = {
      ...currentUserInfo,
      avatarUrl: avatarUrl
    };
    
    app.globalData.userInfo = userInfo;
    this.setData({
      userInfo
    });
    
    wx.showToast({
      title: '头像更新成功',
      icon: 'success'
    });
  },

  // 昵称输入完成
  onNicknameChange: function(e) {
    const nickName = e.detail.value.trim();
    if (!nickName) {
      return;
    }
    
    const currentUserInfo = app.globalData.userInfo || {};
    const userInfo = {
      ...currentUserInfo,
      nickName: nickName
    };
    
    app.globalData.userInfo = userInfo;
    this.setData({
      userInfo
    });
    
    wx.showToast({
      title: '昵称更新成功',
      icon: 'success'
    });
  },

  // 返回首页
  goToHome: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 分享给朋友
  onShareAppMessage: function (res) {
    // 分享事件来源：button（页面内分享按钮）、menu（右上角分享按钮）
    if (res.from === 'button') {
      console.log('通过分享按钮分享个人中心');
    }
    
    const userInfo = this.data.userInfo;
    let shareTitle = 'MBTI性格测试 - 发现真实的自己';
    
    if (userInfo && this.data.testResults.length > 0) {
      const latestResult = this.data.testResults[0];
      shareTitle = `${userInfo.nickName}邀请你一起做MBTI性格测试`;
    }
    
    return {
      title: shareTitle,
      path: '/pages/index/index',
      imageUrl: '/images/share-banner.svg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    const userInfo = this.data.userInfo;
    let shareTitle = 'MBTI性格测试 - 发现真实的自己';
    
    if (userInfo) {
      shareTitle = `${userInfo.nickName}推荐：MBTI性格测试 - 发现真实的自己`;
    }
    
    return {
      title: shareTitle,
      imageUrl: '/images/share-banner.svg'
    };
  },

  // 格式化时间显示
  formatTime: function(dateInput) {
    let date;
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return '未知时间';
    }
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
})