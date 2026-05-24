---
title: Anthropic 内部 Claude Code 实践：三种高效协作方式
created: 2026-05-24
last_updated: 2026-05-24
source: https://mp.weixin.qq.com/s/wkVLd0sY0JjscPFJZc51Fg
tags: [anthropic, claude-code, agent, ai-workflow, developer-tools, verification]
---

# Anthropic 内部 Claude Code 实践：三种高效协作方式

## 核心观点

Anthropic 工程师 Arnaud Doko 在官方播客中分享：AI Agent 运行时间越来越长，一旦方向错误就浪费大量 Token 和时间。解决方案是**在任务起始就对齐方向**，通过三种协作方式从源头避免误耗。

## 三种实践

### 1. 让 Claude 反向"面试"你提取需求

| 传统方式 | 新方式 |
|---------|--------|
| 自己写详细需求文档 | 让 Claude 主动提问挖掘需求 |
| 容易遗漏潜意识中的需求 | 通过迭代式问答逐步浮现真实意图 |
| 过度指定产出形式 | 只指定关注领域和方向 |

**操作方法：**
- Prompt 中引用 `ask_user_question` 工具，触发 Claude 的采访式工作流
- 配置：fast mode + auto mode + 高 effort
- 关键原则：指定范围而非结果，让 Claude 迭代式追问

**本质洞察：** 用户（包括工程师）的需求往往是"看到了才知道想要什么"，Claude 比你更擅长通过提问把这些潜在需求挖出来。

### 2. 用 HTML 替代 Markdown 作为 AI 规范

**为什么 Markdown 不够好：**
- 超过 ~200 行就没人愿意读
- 无法直观呈现产品形态
- 反馈效率低（难以用文字描述视觉问题）

**HTML 规范的优势：**
- 信息密度更高、更紧凑
- 可直接渲染为可视化原型
- 支持多设计方向横向对比
- 配合截图 → Claude 反馈闭环
- 配合 Playwright MCP 进行交互式验证

**Token 效率悖论：** HTML 单次生成可能消耗更多 Token，但因为规范质量更高，迭代次数大幅减少，总消耗反而更低。

### 3. 让"验证"成为产品的原生能力

**核心理念：** 不是事后补测试，而是让组件天生具备可被 Agent 验证的能力。

**实现架构：**
```
组件状态 → 发射到 DOM（data contracts）→ Agent 可读取验证
```

**三种验证模式：**

| 模式 | 驱动方 | 场景 |
|------|--------|------|
| 人类可读 | 人类 | 开发时手动查看仪表盘 |
| Agent 驱动 | Claude + Playwright MCP | Claude 自主打开浏览器验证 |
| 无头自动化 | CI 流水线 | `bun verify` 自动跑测试矩阵 |

**Anthropic 内部实践：**
- Claude Code 团队所有前端改动都录制验证过程
- 录像作为证据存储到 S3，可分享给同事
- 推荐用 Opus 模型（视觉能力更强）
- 破坏数据契约会触发验证失败，但应用本身不受影响——实现了契约与实现的解耦

## 关键引语

> "Claude 可能比你更擅长从你这里提取出你想要和需要的东西，而不是由你向 Claude 详细指定。"

> "如果 Markdown 文件超过了大约 200 行，你可能就不太想去读了，而你的同事当然更不可能去读它们。"

> "让验证成为事物本身的原生属性，以便 Agent 可以与人类一起驱动它，或最终也可以无主（headless）自动运行。"

## 启示

1. **人机协作范式转变**：从"人写需求→AI执行"变为"AI提问→人确认→AI执行"，人的角色从"指令者"变为"决策者"
2. **规范格式随工具进化**：当 AI 具备视觉理解能力后，用可视化格式（HTML）比纯文本（Markdown）更高效
3. **验证即架构**：在 Agent 时代，可验证性不是附加功能，而是系统架构的核心属性
4. **减少人类介入点**：三种实践的共同方向是让 Agent 能更自主地运行，人类只在关键决策点介入

## 关联

- [[agent-system-architecture]] — Agent 验证框架是 Agent 系统架构的关键组件
- [[harness-as-moat]] — 验证框架和 HTML 规范可视为 Claude Code 的 harness 层
- [[forward-deployed-engineer]] — 让 Claude 面试你的模式本质是把 FDE 的需求提取能力 AI 化
