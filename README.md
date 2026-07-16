# Object Drum Studio

> 新版甲方现场系统：打开 `/console.html`（Netlify 根路径会自动进入），操作说明见 [现场触发控制台指南](./docs/CLIENT_CONSOLE_GUIDE.zh-CN.md)。原 Object Drum Studio 保留在 `/studio`。

**中文** | [English](./README.en.md)

Object Drum Studio 是一个浏览器里的日常物件鼓机：把桌面上的彩色物件、贴纸、玩具、文具或纸上色块识别成可演奏区域。你可以用手指触碰/敲击触发 Kick / Snare / Clap / Tom / Pad / Hi-hat，也可以把物件摆进 16 步 AR 网格里，让纸面变成一个简易 loop 鼓机。

在线体验：<https://electro-dig.github.io/object-drum-studio-public/>

## 这个公开版包含什么

- 摄像头实时输入与画面预览
- MediaPipe 手部追踪
- Touch / Tap 两种触发模式，默认 Touch
- 4 行 × 16 步 AR Step Sequencer，可把 A4 纸、笔记本或桌面区域变成 loop 网格
- 可拖拽四个角点做透视校准，支持按行固定音色或按颜色决定音色
- 物件/色块区域识别与稳定追踪
- 二值化连通 + 多数投票颜色判定，减少“一件物体被拆成两个颜色/两个格子”的误判
- Objects 面板里的 H / S / V 颜色规则、画面取色、RGB/Hex 色板
- Tone.js 内置鼓组和 Pad 音色
- 本地 sample 文件夹导入与单个音色分配
- 纯浏览器运行，不需要账号、后端或云服务器

## 隐私说明

这个公开版是 local-first：

- 摄像头画面只在浏览器里处理。
- 上传的 sample 只保留在当前浏览器会话里。
- 不包含私有云端音色服务。
- 不包含实验性的远程音色生成模块。
- 不需要任何账号、密钥或私有服务器配置。

## 本地运行

```powershell
git clone https://github.com/Electro-Dig/object-drum-studio-public.git
cd object-drum-studio-public
npm.cmd test
npm.cmd start
```

然后打开 `http://localhost:5178`。

这个项目没有构建步骤；GitHub Pages 会直接从仓库根目录托管静态文件。

## 基本使用流程

1. 打开页面后先看“指南”面板，了解推荐顺序。
2. 点击 `启动` 并允许摄像头权限。
3. 在顶栏选择 `实时击打模式` 或 `步进鼓机模式`。
4. 实时击打：在“设置”里选择摄像头，必要时打开镜像，并框选演奏区域。
5. 步进鼓机：拖动画面上的四个彩色角点，让网格对齐 A4 纸、笔记本或桌面排列区。
6. 在“物件”里为 Kick / Snare / Clap 等音色取色，或者打开色板手动选色。
7. 在 `Gesture` 里调 Dwell、噪声门、冷却时间等参数，减少误触发。
8. 在 `Sound` 里试听内置音色，或导入本地 sample 文件夹。

## 技术栈

- MediaPipe Tasks Vision HandLandmarker
- Tone.js
- Canvas 2D
- HSV 颜色分割
- 连通区域提取与物理 blob 多数投票
- 透视四边形 AR 网格扫描
- Tone.Transport 16 步音序播放
- 跨帧区域平滑与丢失容忍
- 浏览器 `localStorage` 保存本地颜色与音色设置

## 开发说明

内部研究版曾探索远程音色生成。这个公开仓库删除了那部分私有/实验层，只保留更安全、更容易体验和 fork 的浏览器版本。
