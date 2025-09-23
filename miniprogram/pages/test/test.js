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
      
      // 滚动到顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
  },

  // 完成测试
  completeTest: function () {
    this.stopTimer();
    
    wx.showLoading({ title: '计算结果...' });
    
    try {
      const filledCount = (this.data.answers || []).filter(a => !!(a && (a.selected_option || a.selected_label))).length;
      console.log('[test] completeTest total =', this.data.answers.length, 'filled =', filledCount, 'version =', this.data.testType);
      console.log('[test] sample answer[0] =', this.data.answers && this.data.answers[0]);
    } catch (e) {}

    // 计算MBTI类型
    // 发送精简答案，避免传输过大
    const compactAnswers = (this.data.answers || []).map(a => {
      const q = a.question_data || {};
      const isDetailed = this.data.testType === 'detailed';
      let selectedDimension = null;
      if (isDetailed) {
        const opts = Array.isArray(q.options) ? q.options : [];
        const hit = opts.find(opt => opt.label === (a.selected_label || a.selected_option));
        selectedDimension = hit ? hit.dimension : null;
      } else {
        const key = (a.selected_option || a.selected_label) === 'A' ? 'option_a' : 'option_b';
        selectedDimension = q[key] && q[key].dimension ? q[key].dimension : null;
      }
      return {
        question_id: a.question_id,
        selected_option: a.selected_option,
        selected_label: a.selected_label,
        dimension_group: q.dimension_group,
        selected_dimension: selectedDimension
      };
    });

    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'calculate_mbtI',
        answers: compactAnswers,
        version: this.data.testType
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        const result = res.result.data;
        this.saveTestResult(result);
      } else {
        wx.showModal({
          title: '计算失败',
          content: '无法计算MBTI结果，请重试',
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('MBTI计算失败:', err);
      wx.showModal({
        title: '计算失败',
        content: '网络异常，请检查网络连接',
        showCancel: false
      });
    });
  },

  // 保存测试结果
  saveTestResult: function (mbtiResult) {
    const resultData = {
      ...mbtiResult,
      test_version: this.data.testType,
      test_duration: this.data.timeSpent
    };
    
    wx.cloud.callFunction({
      name: 'mbti-service',
      data: {
        action: 'save_result',
        ...resultData
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const savedResult = res.result.data;
        
        // 更新全局数据（防御性初始化）
        if (!app.globalData) app.globalData = {};
        if (!Array.isArray(app.globalData.testResults)) {
          app.globalData.testResults = [];
        }
        app.globalData.testResults.unshift(savedResult);
        if (app.globalData.testResults.length > 50) {
          app.globalData.testResults = app.globalData.testResults.slice(0, 50);
        }
        
        // 跳转到结果页面
        wx.redirectTo({
          url: `/pages/result/result?id=${savedResult._id}`
        });
      } else {
        wx.showModal({
          title: '保存失败',
          content: '无法保存测试结果，但仍可查看结果',
          confirmText: '查看结果',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/result/result'
              });
            }
          }
        });
      }
    }).catch(err => {
      console.error('保存结果失败:', err);
      wx.showModal({
        title: '保存失败',
        content: '无法保存测试结果，但仍可查看结果',
        confirmText: '查看结果',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({
              url: '/pages/result/result'
            });
          }
        }
      });
    });
  },

  // 计时器功能
  startTimer: function () {
    this.stopTimer();
    
    const timer = setInterval(() => {
      this.setData({
        timeSpent: this.data.timeSpent + 1
      });
    }, 1000);
    
    this.setData({ timer });
  },

  stopTimer: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  // 格式化时间显示
  formatTime: function (seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  // 退出确认
  confirmExit: function () {
    if (!this.data.testStarted) {
      wx.navigateBack();
      return;
    }
    
    this.setData({ showConfirmExit: true });
  },

  // 取消退出
  cancelExit: function () {
    this.setData({ showConfirmExit: false });
  },

  // 确认退出
  confirmExitTest: function () {
    this.setData({ showConfirmExit: false });
    wx.navigateBack();
  },

  // 暂停测试
  pauseTest: function () {
    this.stopTimer();
    wx.showModal({
      title: '测试已暂停',
      content: '点击"继续测试"可恢复答题',
      confirmText: '继续测试',
      showCancel: false,
      success: () => {
        this.startTimer();
      }
    });
  },

  // 分享功能
  shareTest: function () {
    const testInfo = this.data.testInfo[this.data.testType];
    return {
      title: `${testInfo.title} - MBTI性格测试`,
      path: `/pages/index/index`,
      imageUrl: '/images/share-banner.png'
    };
  }
})