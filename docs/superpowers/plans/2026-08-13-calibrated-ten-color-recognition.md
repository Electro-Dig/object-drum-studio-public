# 十色标定识别实现计划

## 1. 配置迁移与十槽行为

- 先修改 `tests/consoleProfile.test.js`、`tests/consoleTrigger.test.js`，让十槽、v1 迁移和随机命中 slot-10 失败。
- 修改 `src/console/profile.js` 使失败测试通过。
- 只运行相关测试，再运行全量测试确认没有旧六槽断言残留。

## 2. Lab 颜色度量与拒识

- 新建 `tests/colorMetrics.test.js`，覆盖标准色、顺序无关、近似亮度变化、深棕和模糊拒识。
- 确认测试因模块缺失而失败。
- 最小实现 `src/detection/colorMetrics.js`，通过相关测试后再整理 API。

## 3. 空场背景检测

- 新建 `tests/calibratedColorDetector.test.js`，覆盖空背景、深棕、十物件、边缘内缩、背景失配。
- 确认测试失败。
- 实现背景 Lab 缓存、前景阈值、形态学、连通域、稳健取色和原型分类。
- 保持输出兼容旧 pad 结构。

## 4. 几何跟踪与颜色投票

- 扩展 `tests/padTracker.test.js`，先证明 `strictRuleMatch:false` 下颜色抖动仍保持 ID。
- 新建 `tests/trackColorResolver.test.js`，覆盖 3/5 确认、锁定、未知拒绝和轨迹消失清理。
- 先看失败，再最小实现 tracker 选项和 resolver。

## 5. Console 集成与标定 UI

- 扩展 `tests/consolePublicPage.test.js`，要求空场状态和按钮存在。
- 在 `console.html`、`console.css`、`src/console/app.js` 接入空场捕捉、诊断状态、十槽文案和 HSV 回退。
- Camera 重连、画布尺寸变化和手动重拍时正确重置背景/轨迹/EntryGate。
- 更新中文使用指南。

## 6. 验证与发布

- 运行相关测试、全量 `npm.cmd test`、静态页面引用检查。
- 本地启动站点，用浏览器检查配置模式、十槽、空场按钮、窄屏和控制台错误。
- 请求独立代码审查并修复 Critical/Important 问题。
- 提交并推送 `feature/lab-recognition-v1`。
- 创建新的 Netlify 测试站点并部署，核验新 URL；禁止使用旧 site ID。

