// pages/test/test.js
const app = getApp();

Page({
  data: {
    // 测试配置
    testType: 'simple', // 'simple' 或 'detailed'
    testInfo: {
      simple: {
        title: '快速测试',
        subtitle: '24题 · 约5分钟',
        icon: '⚡',
        color: '#7B68EE'
      },
      detailed: {
        title: '深度测试', 
        subtitle: '93题 · 约18分钟',
        icon: '🔍',
        color: '#9370DB'
      }
    },
    
    // 题目数据
    questions: [],
    currentQuestion: 0,
    totalQuestions: 24,
    
    // 用户答案
    answers: [],
    currentAnswer: null,
    
    // UI状态
    loading: true,
    testStarted: false,
    testCompleted: false,
    showConfirmExit: false,
    
    // 进度
    progress: 0,
    timeSpent: 0,
    timer: null,
    
    // 进度保存相关
    hasRestoredProgress: false,
    showRestoreDialog: false,
    
    // 选项映射
    optionLabels: {
      'A': { text: 'A', color: '#7B68EE' },
      'B': { text: 'B', color: '#9370DB' }
    }
  },

  onLoad: function (options) {
    const { type } = options;
    if (type && (type === 'simple' || type === 'detailed')) {
      this.setData({
        testType: type,
        totalQuestions: type === 'simple' ? 24 : 93
      });
    }
    
    this.loadQuestions();
    this.startTimer();
  },

  onUnload: function () {
    this.stopTimer();
    // 如果测试未完成，保存进度
    if (this.data.testStarted && !this.data.testCompleted) {
      this.saveProgress();
    }
  },

  onHide: function () {
    // 页面隐藏时保存进度
    if (this.data.testStarted && !this.data.testCompleted) {
      this.saveProgress();
    }
  },

  // 保存测试进度到本地存储
  saveProgress: function () {
    try {
      const progressData = {
        testType: this.data.testType,
        currentQuestion: this.data.currentQuestion,
        totalQuestions: this.data.totalQuestions,
        answers: this.data.answers,
        timeSpent: this.data.timeSpent,
        testStarted: this.data.testStarted,
        progress: this.data.progress,
        timestamp: Date.now(),
        version: '1.0' // 版本号，用于兼容性检查
      };
      
      const storageKey = `mbti_test_progress_${this.data.testType}`;
      wx.setStorageSync(storageKey, progressData);
      
      console.log('[test] 进度已保存:', {
        testType: this.data.testType,
        currentQuestion: this.data.currentQuestion,
        answeredCount: this.data.answers.filter(a => a.selected_option).length
      });
    } catch (error) {
      console.error('[test] 保存进度失败:', error);
    }
  },

  // 从本地存储恢复测试进度
  restoreProgress: function () {
    try {
      const storageKey = `mbti_test_progress_${this.data.testType}`;
      const progressData = wx.getStorageSync(storageKey);
      
      if (!progressData || !progressData.version) {
        return false;
      }
      
      // 检查进度数据的有效性
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24小时
      
      if (now - progressData.timestamp > maxAge) {
        // 进度数据过期，清除
        this.clearProgress();
        return false;
      }
      
      // 验证数据完整性
      if (progressData.testType !== this.data.testType || 
          !Array.isArray(progressData.answers) ||
          typeof progressData.currentQuestion !== 'number') {
        return false;
      }
      
      return progressData;
    } catch (error) {
      console.error('[test] 恢复进度失败:', error);
      return false;
    }
  },

  // 清除本地进度数据
  clearProgress: function () {
    try {
      const storageKey = `mbti_test_progress_${this.data.testType}`;
      wx.removeStorageSync(storageKey);
      console.log('[test] 进度数据已清除');
    } catch (error) {
      console.error('[test] 清除进度失败:', error);
    }
  },

  // 应用恢复的进度数据
  applyRestoredProgress: function (progressData) {
    this.setData({
      currentQuestion: progressData.currentQuestion,
      answers: progressData.answers,
      timeSpent: progressData.timeSpent,
      testStarted: progressData.testStarted,
      progress: progressData.progress,
      currentAnswer: progressData.answers[progressData.currentQuestion]?.selected_option,
      hasRestoredProgress: true
    });
    
    console.log('[test] 进度已恢复:', {
      currentQuestion: progressData.currentQuestion,
      answeredCount: progressData.answers.filter(a => a.selected_option).length,
      timeSpent: progressData.timeSpent
    });
  },

  // 显示进度恢复对话框
  showProgressRestoreDialog: function (progressData) {
    const answeredCount = progressData.answers.filter(a => a.selected_option).length;
    const totalQuestions = progressData.totalQuestions;
    const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
    
    wx.showModal({
      title: '发现未完成的测试',
      content: `检测到您有一个未完成的${this.data.testInfo[this.data.testType].title}，已完成 ${answeredCount}/${totalQuestions} 题 (${progressPercent}%)。是否继续之前的测试？`,
      confirmText: '继续测试',
      cancelText: '重新开始',
      success: (res) => {
        if (res.confirm) {
          // 继续之前的测试
          this.applyRestoredProgress(progressData);
        } else {
          // 重新开始，清除进度
          this.clearProgress();
        }
        this.setData({ showRestoreDialog: false });
      }
    });
  },

  // 加载题目数据
  loadQuestions: function () {
    wx.showLoading({ title: '加载题目...' });
    
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'get_questions',
        version: this.data.testType
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        const questions = res.result.data;
        this.setData({
          questions: questions,
          totalQuestions: questions.length,
          loading: false
        });
        
        // 初始化答案数组
        this.initializeAnswers(questions);
        
        // 检查是否有未完成的进度
        this.checkAndRestoreProgress();
      } else {
        wx.showModal({
          title: '加载失败',
          content: '无法加载题目数据，请重试',
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载题目失败:', err);
      wx.showModal({
        title: '加载失败',
        content: '网络异常，请检查网络连接',
        showCancel: false
      });
    });
  },

  // 检查并恢复进度
  checkAndRestoreProgress: function () {
    const progressData = this.restoreProgress();
    if (progressData) {
      // 验证题目数量是否匹配
      if (progressData.totalQuestions === this.data.totalQuestions && 
          progressData.answers.length === this.data.questions.length) {
        this.showProgressRestoreDialog(progressData);
      } else {
        // 题目数量不匹配，清除旧进度
        this.clearProgress();
      }
    }
  },

  // 初始化答案数组
  initializeAnswers: function (questions) {
    const answers = questions.map(q => ({
      question_id: q.question_id,
      question_data: q,
      selected_option: null,
      selected_label: null
    }));
    
    this.setData({ answers });
    try {
      console.log('[test] initializeAnswers length =', answers.length);
      console.log('[test] first item preview =', answers[0]);
    } catch (e) {}
  },

  // 开始测试
  startTest: function () {
    this.setData({
      testStarted: true,
      currentQuestion: 0,
      progress: 0,
      timeSpent: 0
    });
    
    // 清除可能存在的旧进度
    if (!this.data.hasRestoredProgress) {
      this.clearProgress();
    }
  },

  // 选择答案
  selectAnswer: function (e) {
    const { option, label } = e.currentTarget.dataset;
    const currentAnswers = this.data.answers;
    const currentQuestion = this.data.currentQuestion;

    // simple 模式使用 option(A/B)，detailed 模式使用 label(A/B 等)
    const isDetailed = this.data.testType === 'detailed';
    const selected = isDetailed ? (label || option) : option;

    // 更新答案
    currentAnswers[currentQuestion].selected_option = selected;
    currentAnswers[currentQuestion].selected_label = selected;

    this.setData({
      answers: currentAnswers,
      currentAnswer: selected
    });

    // 保存进度
    this.saveProgress();

    try {
      console.log('[test] selectAnswer q#', currentQuestion + 1, 'selected =', selected);
      console.log('[test] answer snapshot =', this.data.answers[currentQuestion]);
    } catch (e) {}

    // 延迟后自动进入下一题或完成测试
    setTimeout(() => {
      this.nextQuestion();
    }, 300);
  },

  // 下一题
  nextQuestion: function () {
    const currentQuestion = this.data.currentQuestion;
    const totalQuestions = this.data.totalQuestions;
    
    if (currentQuestion < totalQuestions - 1) {
      // 进入下一题
      const nextQuestion = currentQuestion + 1;
      this.setData({
        currentQuestion: nextQuestion,
        currentAnswer: this.data.answers[nextQuestion].selected_option,
        progress: Math.round((nextQuestion + 1) / totalQuestions * 100)
      });
      
      // 保存进度
      this.saveProgress();
      
      // 滚动到顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    } else {
      // 完成测试
      this.completeTest();
    }
  },

  // 上一题
  prevQuestion: function () {
    const currentQuestion = this.data.currentQuestion;
    
    if (currentQuestion > 0) {
      const prevQuestion = currentQuestion - 1;
      this.setData({
        currentQuestion: prevQuestion,
        currentAnswer: this.data.answers[prevQuestion].selected_option
      });
      
      // 保存进度
      this.saveProgress();
      
      // 滚动到顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
  },

  // 完成测试
  completeTest: function () {
    this.setData({
      testCompleted: true,
      progress: 100
    });
    
    this.stopTimer();
    
    // 清除本地进度数据（测试已完成）
    this.clearProgress();
    
    // 保存测试结果
    this.saveTestResult();
  },

  // 保存测试结果
  saveTestResult: function () {
    wx.showLoading({ title: '计算结果...' });
    
    // 准备答案数据
    const answersData = this.data.answers.map(answer => ({
      question_id: answer.question_id,
      selected_option: answer.selected_option
    }));
    
    // 调用云函数计算结果
     wx.cloud.callFunction({
       name: 'mbti-service',
       data: {
         action: 'calculate_mbtI',
         answers: answersData,
         version: this.data.testType
       }
     }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        const result = res.result.data;
        
        // 保存结果到云数据库，然后跳转
        this.saveToDatabase(result, () => {
          // 保存成功后跳转到结果页面，传递完整的结果数据
          const resultData = encodeURIComponent(JSON.stringify(result));
          wx.redirectTo({
            url: `/pages/result/result?data=${resultData}&testType=${this.data.testType}&timeSpent=${this.data.timeSpent}`
          });
        });
      } else {
        wx.showModal({
          title: '计算失败',
          content: '无法计算测试结果，请重试',
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('计算结果失败:', err);
      wx.showModal({
        title: '计算失败',
        content: '网络异常，请检查网络连接',
        showCancel: false
      });
    });
  },

  // 保存到数据库
  saveToDatabase: function (result, callback) {
    const userInfo = app.globalData.userInfo;
    
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'save_result',
        ...result,
        test_type: this.data.testType,
        time_spent: this.data.timeSpent,
        user_info: userInfo,
        created_at: new Date()
      }
    }).then(res => {
      if (res.result && res.result.success) {
        console.log('结果保存成功');
        // 更新全局数据
        if (!app.globalData.testResults) {
          app.globalData.testResults = [];
        }
        app.globalData.testResults.unshift(result);
        
        // 执行回调函数
        if (callback && typeof callback === 'function') {
          callback();
        }
      } else {
        // 保存失败也执行回调，确保页面能正常跳转
        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    }).catch(err => {
      console.error('保存结果失败:', err);
      // 保存失败也执行回调，确保页面能正常跳转
      if (callback && typeof callback === 'function') {
        callback();
      }
    });
  },

  // 计时器相关
  startTimer: function () {
    this.data.timer = setInterval(() => {
      this.setData({
        timeSpent: this.data.timeSpent + 1
      });
    }, 1000);
  },

  stopTimer: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  formatTime: function (seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  // 退出确认相关
  confirmExit: function () {
    if (this.data.testStarted && !this.data.testCompleted) {
      // 如果测试已开始但未完成，显示确认对话框
      this.setData({ showConfirmExit: true });
    } else {
      // 直接退出
      this.exitTest();
    }
  },

  cancelExit: function () {
    this.setData({ showConfirmExit: false });
  },

  confirmExitTest: function () {
    this.setData({ showConfirmExit: false });
    
    // 保存进度
    if (this.data.testStarted && !this.data.testCompleted) {
      this.saveProgress();
      wx.showToast({
        title: '进度已保存',
        icon: 'success',
        duration: 1500
      });
    }
    
    this.exitTest();
  },

  exitTest: function () {
    this.stopTimer();
    wx.navigateBack();
  },

  // 暂停测试
  pauseTest: function () {
    if (this.data.testStarted && !this.data.testCompleted) {
      this.saveProgress();
      wx.showToast({
        title: '进度已保存',
        icon: 'success',
        duration: 1500
      });
    }
  },

  // 分享测试
  // 分享给朋友
  onShareAppMessage: function (res) {
    // 分享事件来源：button（页面内分享按钮）、menu（右上角分享按钮）
    if (res.from === 'button') {
      console.log('通过分享按钮分享测试');
    }
    
    const testInfo = this.data.testInfo[this.data.testType];
    const progress = Math.round((this.data.currentQuestion / this.data.totalQuestions) * 100);
    
    return {
      title: `我正在进行MBTI人格测试 - ${testInfo.title}（进度${progress}%）`,
      path: `/pages/index/index?type=${this.data.testType}`,
      imageUrl: '/images/share-test.svg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    const testInfo = this.data.testInfo[this.data.testType];
    
    return {
      title: `MBTI人格测试 - ${testInfo.title} | 发现真实的自己`,
      imageUrl: '/images/share-test.svg'
    };
  },

  // 手动保存进度（用户主动触发）
  manualSaveProgress: function () {
    if (this.data.testStarted && !this.data.testCompleted) {
      this.saveProgress();
      wx.showToast({
        title: '进度已保存',
        icon: 'success',
        duration: 1500
      });
    } else {
      wx.showToast({
        title: '无需保存',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 获取进度信息（用于调试）
  getProgressInfo: function () {
    const answeredCount = this.data.answers.filter(a => a.selected_option).length;
    const totalQuestions = this.data.totalQuestions;
    const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
    
    return {
      testType: this.data.testType,
      currentQuestion: this.data.currentQuestion + 1,
      answeredCount,
      totalQuestions,
      progressPercent,
      timeSpent: this.formatTime(this.data.timeSpent),
      hasRestoredProgress: this.data.hasRestoredProgress
    };
  }
});