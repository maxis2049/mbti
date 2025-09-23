// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

// 云函数主入口
exports.main = async (event, context) => {
  const { action, data } = event
  
  // 兼容两种调用方式：
  // 1) { action: 'x', data: {...} }
  // 2) { data: { action: 'x', ... } }
  // 统一提取载荷
  // 兼容：
  // a) 顶层: { action, answers, version }
  // b) 标准: { action, data: {...} }
  // c) 变体: { data: { action, ... } }
  function buildPayload(evt) {
    const a = evt || {}
    const b = a.data || {}
    const c = b.data || {}
    // 合并优先级：c > b > a
    const merged = { ...a, ...b, ...c }
    const { action, ...rest } = merged
    return rest
  }
  const actionName = action || (data && data.action) || event.action
  const actualData = buildPayload(event)
  try {
    console.log('[main] actionName =', actionName)
    // 仅打印关键字段，避免日志过长
    const preview = {
      event_keys: event ? Object.keys(event) : null,
      data_keys: data ? Object.keys(data) : null,
      actual_keys: actualData ? Object.keys(actualData) : null,
      answers_len: Array.isArray(actualData && actualData.answers) ? actualData.answers.length : null,
      version: actualData && actualData.version
    }
    console.log('[main] payload preview =', preview)
  } catch (e) {}
  
  switch(actionName) {
    case 'get_questions':
      return await getQuestions({ version: actualData && actualData.version })
    case 'calculate_mbtI':
      return await calculateMBTI({ answers: actualData && actualData.answers, version: actualData && actualData.version })
    case 'get_report':
      return await getMBTIReport(actualData)
    case 'save_result':
      return await saveTestResult(actualData)
    case 'get_user_results':
      return await getUserResults(actualData)
    case 'get_user_info':
      return await getUserInfo(actualData)
    case 'init_database':
      return await initDatabase(actualData)
    case 'import_data':
      return await importData(actualData)
    case 'quick_import':
      return await quickImport(actualData)
    default:
      return { error: 'Unknown action', code: 400 }
  }
}

// 快速导入测试数据
async function quickImport(data) {
  console.log('quickImport called with data:', data);
  const admin_key = data ? data.admin_key : undefined;
  console.log('Extracted admin_key:', admin_key);
  
  if (!admin_key) {
    console.log('No admin_key provided');
    return { error: '缺少管理员密钥', code: 400 }
  }
  
  if (admin_key !== 'mbti_admin_2024') {
    console.log('Invalid admin_key:', admin_key);
    return { error: '无权限', code: 403 }
  }
  
  console.log('Admin validation passed');
  
  try {
    console.log('Starting quick import...');
    const quickLoader = require('./quick-import')
    console.log('Quick loader required successfully');
    
    const result = await quickLoader.quickImport()
    console.log('Quick import completed:', result);
    
    return result;
    
  } catch (err) {
    console.error('快速导入失败:', err)
    return { error: err.message || '快速导入失败', code: 500 }
  }
}

// 获取题目数据
async function getQuestions(data) {
  const version = data && data.version ? data.version : 'simple';
  try {
    const questionsCollection = db.collection('questions')
    let query = questionsCollection
    if (version && version !== 'all') {
      query = query.where({ version })
    }
    const { data } = await query.get()
    
    return {
      success: true,
      data: data.sort((a, b) => a.question_id - b.question_id),
      total: data.length
    }
  } catch (err) {
    console.error('获取题目失败:', err)
    return { error: '获取题目失败', code: 500 }
  }
}

// 计算MBTI类型
async function calculateMBTI(data) {
  const answers = data ? data.answers : undefined;
  const version = data ? data.version : undefined;
  
  try {
    if (!answers || !Array.isArray(answers)) {
      console.error('[calculateMBTI] invalid answers:', answers)
      return { error: '答题数据为空', code: 400 }
    }
    if (answers.length === 0) {
      console.error('[calculateMBTI] answers length 0')
      return { error: '答题数据为空', code: 400 }
    }

    let mbtiResult
    if (version === 'simple') {
      mbtiResult = calculate24Questions(answers)
    } else if (version === 'detailed') {
      mbtiResult = calculate93Questions(answers)
    } else {
      console.error('[calculateMBTI] invalid version:', version)
      return { error: '无效的测试版本', code: 400 }
    }

    return {
      success: true,
      data: mbtiResult
    }
  } catch (err) {
    console.error('MBTI计算失败:', err)
    return { error: 'MBTI计算失败', code: 500 }
  }
}

// 24题版本计算逻辑
function calculate24Questions(answers) {
  const scores = {
    E: 0, I: 0, S: 0, N: 0,
    T: 0, F: 0, J: 0, P: 0
  }
  
  // 累计维度分数（健壮性处理：缺失选择/字段时跳过）
  answers.forEach((answer) => {
    const question = answer && answer.question_data
    if (!question) return
    const selectedLabel = answer.selected_option || answer.selected_label
    if (selectedLabel !== 'A' && selectedLabel !== 'B') return
    const selectedKey = selectedLabel === 'A' ? 'option_a' : 'option_b'
    const option = question[selectedKey]
    if (!option || !option.dimension) return
    const dim = option.dimension
    const score = typeof option.score === 'number' ? option.score : 1
    if (scores.hasOwnProperty(dim)) {
      scores[dim] += score
    }
  })
  
  // 按题目自身的 dimension_group 分组统计，而非依赖题目索引顺序
  const groupScores = {
    EI: { E: 0, I: 0 },
    SN: { S: 0, N: 0 },
    TF: { T: 0, F: 0 },
    JP: { J: 0, P: 0 }
  }
  
  answers.forEach((answer) => {
    const question = answer && answer.question_data
    if (!question) return
    const selectedLabel = answer.selected_option || answer.selected_label
    if (selectedLabel !== 'A' && selectedLabel !== 'B') return
    const selectedKey = selectedLabel === 'A' ? 'option_a' : 'option_b'
    const option = question[selectedKey]
    if (!option || !option.dimension) return
    const dim = option.dimension
    const group = question.dimension_group
    if (group === 'EI') {
      if (dim === 'E') groupScores.EI.E += 1
      else if (dim === 'I') groupScores.EI.I += 1
    } else if (group === 'SN') {
      if (dim === 'S') groupScores.SN.S += 1
      else if (dim === 'N') groupScores.SN.N += 1
    } else if (group === 'TF') {
      if (dim === 'T') groupScores.TF.T += 1
      else if (dim === 'F') groupScores.TF.F += 1
    } else if (group === 'JP') {
      if (dim === 'J') groupScores.JP.J += 1
      else if (dim === 'P') groupScores.JP.P += 1
    }
  })
  
  // 计算每个维度的结果
  const dimensions = {
    EI: groupScores.EI.E >= groupScores.EI.I ? 'E' : 'I',
    SN: groupScores.SN.S >= groupScores.SN.N ? 'S' : 'N',
    TF: groupScores.TF.T >= groupScores.TF.F ? 'T' : 'F',
    JP: groupScores.JP.J >= groupScores.JP.P ? 'J' : 'P'
  }
  
  const mbti_type = dimensions.EI + dimensions.SN + dimensions.TF + dimensions.JP
  
  // 计算各维度的倾向强度
  const calculateStrength = (group, winner) => {
    const total = Object.values(group).reduce((sum, v) => sum + v, 0)
    const winnerScore = group[winner]
    return total > 0 ? Math.round((winnerScore / total) * 100) : 50
  }
  
  const strengths = {
    EI_strength: calculateStrength(groupScores.EI, dimensions.EI),
    SN_strength: calculateStrength(groupScores.SN, dimensions.SN),
    TF_strength: calculateStrength(groupScores.TF, dimensions.TF),
    JP_strength: calculateStrength(groupScores.JP, dimensions.JP)
  }
  
  // 计算总体置信度
  const avgStrength = (strengths.EI_strength + strengths.SN_strength + 
                       strengths.TF_strength + strengths.JP_strength) / 4
  
  return {
    mbti_type,
    dimension_scores: scores,
    group_scores: groupScores,
    dimension_details: {
      EI: { E: groupScores.EI.E, I: groupScores.EI.I, winner: dimensions.EI, strength: strengths.EI_strength },
      SN: { S: groupScores.SN.S, N: groupScores.SN.N, winner: dimensions.SN, strength: strengths.SN_strength },
      TF: { T: groupScores.TF.T, F: groupScores.TF.F, winner: dimensions.TF, strength: strengths.TF_strength },
      JP: { J: groupScores.JP.J, P: groupScores.JP.P, winner: dimensions.JP, strength: strengths.JP_strength }
    },
    strengths: strengths,
    confidence: avgStrength,
    version: 'simple',
    total_questions: 24,
    answered_questions: answers.length
  }
}

// 93题版本计算逻辑
function calculate93Questions(answers) {
  const scores = {
    E: 0, I: 0, S: 0, N: 0,
    T: 0, F: 0, J: 0, P: 0
  }
  
  // 根据用户选择的选项累计得分
  answers.forEach((answer) => {
    const opts = answer.question_data && answer.question_data.options ? answer.question_data.options : []
    const selectedOption = opts.find(opt => opt.label === answer.selected_label)
    if (selectedOption) {
      scores[selectedOption.dimension] += 1
    }
  })
  
  // 基于tieBreakerRule计算最终结果
  const dimensionPairs = [
    { pair: ['E', 'I'], preference: 'I', maxQuestions: 21 },
    { pair: ['S', 'N'], preference: 'N', maxQuestions: 26 },
    { pair: ['T', 'F'], preference: 'F', maxQuestions: 24 },
    { pair: ['J', 'P'], preference: 'P', maxQuestions: 22 }
  ]
  
  let mbti_type = ''
  const detailedResults = {}
  
  dimensionPairs.forEach(({ pair, preference, maxQuestions }) => {
    const [first, second] = pair
    const firstScore = scores[first]
    const secondScore = scores[second]
    
    let winner
    if (firstScore > secondScore) {
      winner = first
    } else if (secondScore > firstScore) {
      winner = second
    } else {
      // 得分相等时使用preference
      winner = preference
    }
    
    mbti_type += winner
    
    // 计算详细分析分数
    const rawScore = first === winner ? firstScore - secondScore : secondScore - firstScore
    const normalizedScore = (rawScore / maxQuestions) * 10
    detailedResults[`${first}${second}_score`] = Math.round(normalizedScore * 10) / 10
  })
  
  // 计算各维度的倾向强度
  const calculateDetailedStrength = (first, second, winner) => {
    const total = scores[first] + scores[second]
    const winnerScore = scores[winner]
    return total > 0 ? Math.round((winnerScore / total) * 100) : 50
  }
  
  const strengths = {
    EI_strength: calculateDetailedStrength('E', 'I', mbti_type[0]),
    SN_strength: calculateDetailedStrength('S', 'N', mbti_type[1]),
    TF_strength: calculateDetailedStrength('T', 'F', mbti_type[2]),
    JP_strength: calculateDetailedStrength('J', 'P', mbti_type[3])
  }
  
  // 计算总体置信度
  const avgStrength = (strengths.EI_strength + strengths.SN_strength + 
                       strengths.TF_strength + strengths.JP_strength) / 4
  
  return {
    mbti_type,
    dimension_scores: scores,
    dimension_details: {
      EI: { E: scores.E, I: scores.I, winner: mbti_type[0], strength: strengths.EI_strength },
      SN: { S: scores.S, N: scores.N, winner: mbti_type[1], strength: strengths.SN_strength },
      TF: { T: scores.T, F: scores.F, winner: mbti_type[2], strength: strengths.TF_strength },
      JP: { J: scores.J, P: scores.P, winner: mbti_type[3], strength: strengths.JP_strength }
    },
    detailed_analysis: detailedResults,
    strengths: strengths,
    confidence: avgStrength,
    version: 'detailed',
    total_questions: 93,
    answered_questions: answers.length
  }
}

// 获取MBTI报告
async function getMBTIReport(data) {
  const mbti_type = data ? data.mbti_type : undefined;
  try {
    const reportsCollection = db.collection('reports')
    const { data } = await reportsCollection
      .where({ mbti_type })
      .get()
    
    if (data && data.length > 0) {
      return {
        success: true,
        data: data[0]
      }
    } else {
      return {
        success: false,
        error: '未找到对应的MBTI报告',
        code: 404
      }
    }
  } catch (err) {
    console.error('获取MBTI报告失败:', err)
    return { error: '获取MBTI报告失败', code: 500 }
  }
}

// 保存测试结果
async function saveTestResult(resultData) {
  try {
    const { openid } = cloud.getWXContext()
    
    const resultToSave = {
      ...resultData,
      user_id: openid,
      created_at: new Date(),
      is_shared: false,
      is_favorite: false
    }
    
    const resultsCollection = db.collection('user_results')
    const { _id } = await resultsCollection.add({
      data: resultToSave
    })
    
    return {
      success: true,
      data: {
        _id,
        ...resultToSave
      }
    }
  } catch (err) {
    console.error('保存测试结果失败:', err)
    return { error: '保存测试结果失败', code: 500 }
  }
}

// 获取用户测试历史
async function getUserResults(data) {
  const user_id = data ? data.user_id : undefined;
  const limit = data ? data.limit : 10;
  
  try {
    const resultsCollection = db.collection('user_results')
    const { data } = await resultsCollection
      .where({ user_id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()
    
    return {
      success: true,
      data: data,
      total: data.length
    }
  } catch (err) {
    console.error('获取用户历史失败:', err)
    return { error: '获取用户历史失败', code: 500 }
  }
}

// 获取用户基本信息
async function getUserInfo() {
  try {
    const { openid, appid } = cloud.getWXContext()
    
    return {
      success: true,
      data: {
        openid,
        appid
      }
    }
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return { error: '获取用户信息失败', code: 500 }
  }
}

// 初始化数据库（仅管理员可调用）
async function initDatabase(data) {
  // 这里可以添加管理员验证逻辑
  console.log('initDatabase called with data:', data);
  const admin_key = data ? data.admin_key : undefined;
  console.log('Extracted admin_key:', admin_key);
  
  if (!admin_key) {
    console.log('No admin_key provided');
    return { error: '缺少管理员密钥', code: 400 }
  }
  
  if (admin_key !== 'mbti_admin_2024') {
    console.log('Invalid admin_key:', admin_key);
    return { error: '无权限', code: 403 }
  }
  
  console.log('Admin validation passed');
  
  try {
    // 检查集合是否已存在
    const collections = ['questions', 'reports', 'user_results']
    const results = []
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName)
        results.push({ collection: collectionName, status: 'created' })
      } catch (err) {
        if (err.errCode === -1) {
          results.push({ collection: collectionName, status: 'exists' })
        } else {
          results.push({ collection: collectionName, status: 'error', error: err.message })
        }
      }
    }
    
    return {
      success: true,
      message: '数据库初始化完成',
      results
    }
  } catch (err) {
    console.error('数据库初始化失败:', err)
    return { error: '数据库初始化失败', code: 500 }
  }
}

// 导入数据到云数据库
async function importData(data) {
  console.log('importData called with data:', data);
  const admin_key = data ? data.admin_key : undefined;
  console.log('Extracted admin_key:', admin_key);
  
  if (!admin_key) {
    console.log('No admin_key provided');
    return { error: '缺少管理员密钥', code: 400 }
  }
  
  if (admin_key !== 'mbti_admin_2024') {
    console.log('Invalid admin_key:', admin_key);
    return { error: '无权限', code: 403 }
  }
  
  console.log('Admin validation passed');
  
  try {
    console.log('Starting optimized data import...');
    const dataLoader = require('./data-import-v2')
    console.log('Data loader v2 required successfully');
    
    const result = await dataLoader.importToDatabase()
    console.log('Data import completed:', result);
    
    return result;
    
  } catch (err) {
    console.error('数据导入失败:', err)
    return { error: err.message || '数据导入失败', code: 500 }
  }
}