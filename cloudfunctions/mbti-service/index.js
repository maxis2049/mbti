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
    case 'get_test_result':
      return await getTestResult(actualData)
    case 'get_user_info':
      return await getUserInfo(actualData)
    case 'init_database':
      return await initDatabase(actualData)
    case 'update_questions_database':
      return await updateQuestionsDatabase(actualData)
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

    // 获取题目数据
    const questionsResult = await getQuestions({ version: version || 'simple' });
    if (!questionsResult.success) {
      console.error('[calculateMBTI] failed to get questions:', questionsResult.error)
      return { error: '获取题目数据失败', code: 500 }
    }
    
    const questions = questionsResult.data;
    const questionMap = {};
    questions.forEach(q => {
      questionMap[q.question_id] = q;
    });
    
    // 将题目数据附加到答案中
    const enrichedAnswers = answers.map(answer => ({
      ...answer,
      question_data: questionMap[answer.question_id]
    }));

    let mbtiResult
    if (version === 'simple') {
      mbtiResult = calculate24Questions(enrichedAnswers)
    } else if (version === 'detailed') {
      mbtiResult = calculate93Questions(enrichedAnswers)
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
  // 按照用户提供的计分规则：A选项=1分，B选项=0分
  // 按题目分组统计A选项的数量
  const groupAScores = {
    EI: 0,  // 题目1-6中选A的数量
    SN: 0,  // 题目7-12中选A的数量
    TF: 0,  // 题目13-18中选A的数量
    JP: 0   // 题目19-24中选A的数量
  }
  
  // 统计每个分组中选择A选项的数量
  answers.forEach((answer) => {
    const question = answer && answer.question_data
    if (!question) return
    const selectedLabel = answer.selected_option || answer.selected_label
    if (selectedLabel !== 'A' && selectedLabel !== 'B') return
    
    const group = question.dimension_group
    // 只有选择A选项才计分（A=1分，B=0分）
    if (selectedLabel === 'A') {
      if (group === 'EI') groupAScores.EI += 1
      else if (group === 'SN') groupAScores.SN += 1
      else if (group === 'TF') groupAScores.TF += 1
      else if (group === 'JP') groupAScores.JP += 1
    }
  })
  
  // 根据计分规则判定结果
  // E型：题目1-6中选A ≥ 4题 → E (外向)，否则 → I (内向)
  // S型：题目7-12中选A ≥ 4题 → S (感觉)，否则 → N (直觉)
  // T型：题目13-18中选A ≥ 4题 → T (思考)，否则 → F (情感)
  // J型：题目19-24中选A ≥ 4题 → J (判断)，否则 → P (感知)
  const dimensions = {
    EI: groupAScores.EI >= 4 ? 'E' : 'I',
    SN: groupAScores.SN >= 4 ? 'S' : 'N',
    TF: groupAScores.TF >= 4 ? 'T' : 'F',
    JP: groupAScores.JP >= 4 ? 'J' : 'P'
  }
  
  const mbti_type = dimensions.EI + dimensions.SN + dimensions.TF + dimensions.JP
  
  // 计算详细分组分数（为了兼容现有接口）
  const groupScores = {
    EI: { 
      E: groupAScores.EI, 
      I: 6 - groupAScores.EI  // 每组6题，I分数 = 6 - E分数
    },
    SN: { 
      S: groupAScores.SN, 
      N: 6 - groupAScores.SN 
    },
    TF: { 
      T: groupAScores.TF, 
      F: 6 - groupAScores.TF 
    },
    JP: { 
      J: groupAScores.JP, 
      P: 6 - groupAScores.JP 
    }
  }
  
  // 计算各维度的倾向强度
  const calculateStrength = (aScore) => {
    return Math.round((aScore / 6) * 100)  // 每组6题，计算A选项占比
  }
  
  const strengths = {
    EI_strength: dimensions.EI === 'E' ? calculateStrength(groupAScores.EI) : calculateStrength(6 - groupAScores.EI),
    SN_strength: dimensions.SN === 'S' ? calculateStrength(groupAScores.SN) : calculateStrength(6 - groupAScores.SN),
    TF_strength: dimensions.TF === 'T' ? calculateStrength(groupAScores.TF) : calculateStrength(6 - groupAScores.TF),
    JP_strength: dimensions.JP === 'J' ? calculateStrength(groupAScores.JP) : calculateStrength(6 - groupAScores.JP)
  }
  
  // 计算总体置信度
  const avgStrength = (strengths.EI_strength + strengths.SN_strength + 
                       strengths.TF_strength + strengths.JP_strength) / 4
  
  // 兼容原有的dimension_scores格式
  const scores = {
    E: groupScores.EI.E, I: groupScores.EI.I,
    S: groupScores.SN.S, N: groupScores.SN.N,
    T: groupScores.TF.T, F: groupScores.TF.F,
    J: groupScores.JP.J, P: groupScores.JP.P
  }
  
  return {
    mbti_type,
    dimension_scores: scores,
    group_scores: groupScores,
    group_a_scores: groupAScores,  // 新增：A选项分数统计
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
    const wxContext = cloud.getWXContext()
    const { OPENID: openid } = wxContext
    
    console.log('[saveTestResult] wxContext:', wxContext)
    console.log('[saveTestResult] openid:', openid)
    
    if (!openid) {
      console.error('[saveTestResult] openid is undefined')
      return { error: '用户身份验证失败，请重新登录', code: 401 }
    }
    
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
  const limit = data ? data.limit : 10;
  
  try {
    // 自动获取当前用户的openid
    const wxContext = cloud.getWXContext()
    const { OPENID: openid } = wxContext
    
    console.log('[getUserResults] wxContext:', wxContext)
    console.log('[getUserResults] openid:', openid)
    
    if (!openid) {
      console.error('[getUserResults] openid is undefined')
      return { error: '用户身份验证失败，请重新登录', code: 401 }
    }
    
    const resultsCollection = db.collection('user_results')
    const { data: results } = await resultsCollection
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()
    
    console.log('[getUserResults] found results count:', results.length)
    
    return {
      success: true,
      data: results,
      total: results.length
    }
  } catch (err) {
    console.error('获取用户历史失败:', err)
    return { error: '获取用户历史失败: ' + err.message, code: 500 }
  }
}

// 获取单个测试结果
async function getTestResult(data) {
  try {
    if (!data || !data.resultId) {
      return { error: '缺少测试结果ID', code: 400 }
    }
    
    const resultId = data.resultId
    console.log('[getTestResult] 查询结果ID:', resultId)
    
    // 自动获取当前用户的openid
    const wxContext = cloud.getWXContext()
    const { OPENID: openid } = wxContext
    
    console.log('[getTestResult] wxContext:', wxContext)
    console.log('[getTestResult] openid:', openid)
    
    if (!openid) {
      console.error('[getTestResult] openid is undefined')
      return { error: '用户身份验证失败，请重新登录', code: 401 }
    }
    
    const resultsCollection = db.collection('user_results')
    const result = await resultsCollection.doc(resultId).get()
    
    if (!result || !result.data) {
      return { error: '未找到指定的测试结果', code: 404 }
    }
    
    // 验证结果属于当前用户
    if (result.data.user_id !== openid) {
      console.error('[getTestResult] 用户无权访问此结果')
      return { error: '无权访问此测试结果', code: 403 }
    }
    
    console.log('[getTestResult] 找到结果:', result.data)
    
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取测试结果失败:', err)
    return { error: '获取测试结果失败: ' + err.message, code: 500 }
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

// 更新24题数据库（修复题目分组问题）
async function updateQuestionsDatabase(data) {
  console.log('updateQuestionsDatabase called with data:', data);
  const admin_key = data ? data.admin_key : undefined;
  
  if (!admin_key || admin_key !== 'mbti_admin_2024') {
    return { error: '无权限', code: 403 }
  }
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // 读取修复后的24题数据
    const questionsPath = path.join(__dirname, '24questions.json');
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    
    console.log('读取到题目数据:', questionsData.questions.length, '题');
    
    // 删除现有的24题数据（version: 'simple'）
    const deleteResult = await db.collection('questions')
      .where({ version: 'simple' })
      .remove();
    
    console.log('删除旧数据结果:', deleteResult);
    
    // 逐条插入新的24题数据（确保每题都是独立记录）
    const insertPromises = [];
    
    for (const question of questionsData.questions) {
      const questionRecord = {
        question_id: question.question_id,
        question_text: question.question_text,
        option_a: {
          text: question.options[0].text,
          dimension: question.options[0].dimension,
          score: question.options[0].weight || 1
        },
        option_b: {
          text: question.options[1].text,
          dimension: question.options[1].dimension,
          score: question.options[1].weight || 1
        },
        dimension_group: question.dimension_group,
        version: question.version,
        category: question.category,
        difficulty: question.difficulty,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      insertPromises.push(
        db.collection('questions').add({
          data: questionRecord
        })
      );
    }
    
    const insertResults = await Promise.all(insertPromises);
    
    // 验证插入结果
    const countResult = await db.collection('questions')
      .where({ version: 'simple' })
      .count();
    
    console.log('插入完成，当前24题数量:', countResult.total);
    
    // 验证题目分组
    const groupCounts = {};
    const allQuestions = await db.collection('questions')
      .where({ version: 'simple' })
      .get();
    
    allQuestions.data.forEach(q => {
      groupCounts[q.dimension_group] = (groupCounts[q.dimension_group] || 0) + 1;
    });
    
    return {
      success: true,
      message: '24题数据库更新完成',
      details: {
        deleted_count: deleteResult.stats ? deleteResult.stats.removed : 0,
        inserted_count: countResult.total,
        group_distribution: groupCounts,
        expected_distribution: { EI: 6, SN: 6, TF: 6, JP: 6 }
      }
    };
    
  } catch (err) {
    console.error('更新24题数据库失败:', err);
    return { 
      error: '更新24题数据库失败: ' + err.message, 
      code: 500 
    };
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