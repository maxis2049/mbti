# MBTI 小程序（云开发）

本项目提供 MBTI 性格测试（24 题/93 题）、云计算与报告展示，以及结果保存与历史查看能力。

## 运行环境
- 小程序基础库：≥ 2.2.3（使用云开发能力）
- 云开发环境 ID：cloud1-3gm1gip6d3aa4333（请在 `miniprogram/app.js` 中保持一致）
- 云函数：`cloudfunctions/mbti-service`

## 功能清单与进度

- 测试选择与引导（首页）
  - [x] 选择 24 题（simple）/ 93 题（detailed）
  - [x] 授权引导与进入测试页

- 题库与数据导入
  - [x] 24 题 JSON：`data_yangben/24questions.json`
  - [x] 93 题 JSON：`data_yangben/93questions.json`
  - [x] 16 型报告 JSON：`data_yangben/mbti_reports.json`
  - [x] 导入脚本：`cloudfunctions/mbti-service/data-import.js`（优先读取 JSON；确保集合存在；可本地导入或云端导入）
  - [x] 数据已导入到环境（questions: 24+93, reports: 16）

- 测试页（`pages/test/`）
  - [x] 加载题目（云函数 `get_questions`，默认 simple，支持 detailed/all）
  - [x] 24 题 UI 与选择（A/B）
  - [x] 93 题 UI 与选择（基于 `options` 数组渲染）
  - [x] 进度/计时/上一题/下一题
  - [ ] 本地自动保存与恢复进度（计划）

- 计算与保存
  - [x] 云函数 `calculate_mbtI`：
    - [x] 24 题计算逻辑修复（强度计算使用分组总和）
    - [x] 93 题计算逻辑（tie-break 偏好）
  - [x] 结果保存 `save_result`（绑定 `openid`）

- 结果页（`pages/result/`）
  - [x] 展示类型、维度强度、报告内容
  - [x] 根据 `mbti_type` 拉取报告 `get_report`
  - [ ] 收藏持久化（计划：新增 `toggle_favorite`）
  - [ ] 图片报告/详细解析（计划）

- 个人中心（`pages/profile/`）
  - [x] 拉取并展示历史记录 `get_user_results`
  - [ ] 首页兜底拉取最近记录（计划）

- 初始化/运维
  - [x] `init_database` 创建集合（questions/reports/user_results）
  - [x] 一键转换脚本（报告）：`scripts/convert_mbti_md_to_json.js`
  - [x] npm 脚本：
    - `npm run import:data --env=<ENV_ID>`（本地导入，需本地凭证/或使用 ENV_ID=... node data-import.js）
  - [x] 将云函数超时/内存按需上调（用于云端 import_data，建议 60s/512MB+）
    - [x] 快速导入功能（解决超时问题）：`quick_import` - 小批量导入测试数据，避免超时

## 代码结构

- `miniprogram/` 小程序前端
  - `pages/index/` 首页（选择测试、查看最近记录）
  - `pages/test/` 测试页（24/93 题渲染、答题流程）
  - `pages/result/` 结果页（类型与报告展示）
  - `pages/profile/` 个人中心（历史记录）
- `cloudfunctions/mbti-service/` 云函数
  - `index.js` 入口（get_questions/calculate_mbtI/get_report/save_result/get_user_results/get_user_info/init_database/import_data）
  - `data-import.js` 导入逻辑（优先 JSON，集合保障，清理与写入）
  - 同目录下包含 JSON 数据副本（用于云端导入场景）
- `data_yangben/` 数据源（推荐使用）
  - `24questions.json`、`93questions.json`、`mbti_reports.json`
  - 保留 md 源文件用于回溯
- `scripts/` 数据转换脚本
  - `convert_mbti_md_to_json.js` 将 `mbti_result.md` 转 `mbti_reports.json`

## 使用说明（本地验证）

1. 在 `miniprogram/app.js` 设置 env：`cloud1-3gm1gip6d3aa4333`
2. 微信开发者工具：部署云函数 `mbti-service`（所有文件）
3. 进入小程序：
   - 选择“快速测试(24题)”/“深度测试(93题)”
   - 完成答题 → 云端计算 → 结果保存与展示

## 常见问题

- 无法加载题目：
  - 确认云函数已部署最新；
  - `get_questions` 默认 simple，可传 `{version: 'detailed'}`；
  - 数据已导入当前环境的 `questions` 集合（24/93 条）。
- 云端导入超时：
  - 提升超时/内存，或使用控制台/CLI 导入；
  - 生产场景建议不从前端触发导入。

## 维护约定（重要）

- 每次代码变更后，必须同步更新本 README：
  - 功能清单与勾选状态
  - 关键改动（如云函数接口行为、数据结构）
- 每次开发会话开始前，请先阅读本 README 了解历史进展与当前待办。

---
更新记录：
- 2025-09-22：
  - 修复 24 题强度计算；
  - 适配 93 题前端渲染与选择；
  - `get_questions` 默认 simple，并支持 `all`；
  - 导入脚本优先读取 JSON，保障集合，并提供 npm 脚本；
  - 增加报告 MD→JSON 转换脚本。
