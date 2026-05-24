---
title: "Claude比你更懂你的需求？Anthropic工程师公开内部用法"
source: https://mp.weixin.qq.com/s/wkVLd0sY0JjscPFJZc51Fg
author: 玉澄（编辑）
speaker: Arnaud Doko (Anthropic 内部工程师)
date: 2026-05-24
type: article
---

# Claude比你更懂你的需求？Anthropic工程师公开内部用法

来源：Claude 官方播客 "How We Use Claude Code"
主讲人：Arnaud Doko（Anthropic 内部工程师）

## 核心观点

当下 AI Agent 越来越强、任务越来越复杂、运行时间越来越长，我们与 AI 的协作方式必须改变。核心分享三种高效避坑的新协作方式，从任务起始就避免资源的误耗。

## 三种协作方式

### 1. 让 Claude 像面试官一样主动挖掘需求

- 模型在从你这里提取需求方面，可能比你自己定义需求时做得更好
- 不要过度指定最终产出，而是指定你感兴趣的范围
- 鼓励 Claude 从你这里提取具体细节
- 在 prompt 中引用 ask_user_question 工具触发此工作流
- 配合 fast mode、auto mode 和高 effort 设置

坏的提示词："把它做得更好"、"不要犯错"
好的提示词：指定关注领域、用开放式方式引导 Claude 提问

### 2. 用 HTML 代替 Markdown 作为 AI 规范说明书

- Markdown 文件超过约 200 行就没人愿意读
- HTML 文件更紧凑、信息密度高、符合人类工程学
- 可以直观了解产品未来的样子
- 可以配合截图使用，反馈给 Claude
- 可以配合 Playwright MCP 使用
- 可以生成多个设计方向横向对比探索

关于 Token 消耗：长远来看，结构良好的 HTML 规范会减少迭代次数，总 Token 消耗反而更低。配合 fast mode 效果更佳。

### 3. 让"验证"成为 Agent 的原生特性

核心理念：让验证成为事物本身的原生属性，以便 Agent 可以与人类一起驱动，或无主（headless）自动运行。

实现方式：
- 使用 Storybook fixtures、测试库、数据发射（data emissions）和属性
- 组件将状态发布到 DOM 中作为数据契约（data contracts）
- Agent 可以读取 DOM 契约进行原生验证

三种验证模式：
1. 人类可读模式（手动仪表盘）
2. Agent 驱动模式（Claude Code + Playwright MCP 在浏览器中验证）
3. 无头自动化模式（CI 中运行 bun verify）

实践要点：
- Claude Code 团队用此方法记录所有前端代码改动
- 验证过程可录制为证据，上传到 S3 或分享给同事
- 推荐使用 Opus 模型（视觉能力更强）
- 故意破坏数据契约可以触发验证失败，而应用本身不受影响

## 演示案例

- 账单均摊（bill splitting）应用：演示需求提取和 HTML 规范生成
- 待办事项（to-do）应用：演示验证框架的三种模式

## 参考链接

- YouTube: https://www.youtube.com/watch?v=IlqJqcl8ONE
- GitHub: https://github.com/anthropics/cwc-workshops
- 具体代码: https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code
