---
source: http://xhslink.com/o/2H5Q3NjRoLk
captured: 2026-05-21
type: article
title: "模型不是壁垒，Harness 也不是"
platform: 小红书 / 虎嗅转载
---

# 模型不是壁垒，Harness 也不是

## 背景

2026年初，海外开发者社区围绕"Harness"展开激烈辩论。起源于 HashiCorp 联合创始人 Mitchell Hashimoto 2月5日博客提出 "Engineer the Harness"，6天后 OpenAI 发实验报告跟进。

Harness 本意是马具（缰绳、马鞍、嚼子），在 AI 语境中指：管理大模型运行的环境工具链——验证规则、记忆系统、回滚机制、约束规则、反馈回路。

## Harness 的四大能力

1. **约束**：把规则写成 CI 检查，而非提示词叮嘱。OpenAI 实验中分层架构规则写入自动化检查，比提示词有效10倍。
2. **记忆**：在仓库中维护结构化文档（设计规范、架构决策、执行计划），Agent 随时可查，解决上下文窗口的遗忘问题。
3. **验证**：做事的和评判的分开（Anthropic 做法：一个 Agent 写，另一个挑毛病）。
4. **纠错**：每次改动走 Git，卡住就回滚到干净状态，换新 Agent 接手，附交接单。

## 支持派证据

- LangChain：同一模型、提示词不变，只调 Harness → TerminalBench 2.0 得分从 52.8% 涨到 66.5%，排名从30名外冲进前5。
- Hashline 实验（Can Boluk）：只改代码编辑格式（每行加2-3字符哈希标识），得分从 6.7% 暴涨到 68.3%，模型权重一字节未动。
- LlamaIndex 创始人：一个下午优化 Harness，15个模型编码能力全涨。
- Cursor：靠 Harness 层估值 293 亿美元。

## 反对派证据

- Boris Cherny（Claude Code 创造者）：Claude Code 成功基本只依赖模型，产品架构极薄。
- OpenAI Noam Brown：在推理模型上搭脚手架很多时候是添乱。
- Scale AI SWE-Atlas 测试：不同 Harness 框架差距在误差范围内。
- METR 测试：不同 Harness 框架差异在误差范围内。

## 矛盾：为什么最好的团队一直在拆 Harness？

- Manus 半年重写5次 Harness，每次砍功能，越做越简单。
- Vercel v0 产品删掉 80% Agent 工具，效果反而更好。
- Claude Code 每3-4周重写一次。
- 原因：新模型会"内化"旧规则，旧 Harness 成为约束。Opus 4.6 无需架构检查即可编译 Linux 内核。

## Boris Cherny 的真实用法（"薄"的另一面）

产品架构薄 ≠ 工程实践薄：
- 日常同时开 10-15 个 Claude Code 会话
- 自动化钩子（保存后自动格式化）
- 规划模式（先出方案再动手）
- 子 Agent 做代码审查
- 接浏览器自动化跑测试

## 核心结论：飞轮转速才是壁垒

真正的竞争优势不在模型本身，也不在 Harness 本身，而在于：

> 谁能更快发现 Agent 失败模式 → 编码进环境 → 用环境跑出的数据喂给下一代模型 → 再转一圈

- "模型吃 Harness → Harness 喂模型" 的协同进化循环
- Cursor 的护城河 = 数百万开发者每天提供的实时迭代数据 = 飞轮转速
- 今天精心设计的 Harness 大概率被下一代模型"吃掉"

## 文末彩蛋

写完当天，Anthropic 把 Harness 做成产品发布了。
