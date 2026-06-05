---
title: "SDD：Spec-Driven Development 与 OpenSpec 框架"
created: 2026-06-05
last_updated: 2026-06-05
source: https://github.com/Fission-AI/OpenSpec
tags: [sdd, spec-driven-development, ai-workflow, agent, developer-tools, open-source]
---

# SDD：Spec-Driven Development 与 OpenSpec 框架

## 一句话定义

SDD（Spec-Driven Development）= 在 AI 编程时代，先用结构化规格对齐意图，再让 AI 执行的轻量工程方法。

## 核心问题

AI 编程助手的需求如果只存在于对话历史中，输出就不可预测、不可追溯。SDD 在人与 AI 之间插入一个**规格层**，把隐性意图变成显性契约。

## OpenSpec 框架

[Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) 是 SDD 的开源实现，支持 25+ 种 AI 工具（Claude Code、Copilot、Cursor、Codex 等）。

### 设计哲学

| 原则 | 含义 |
|------|------|
| fluid not rigid | 无阶段门，按需推进任何产物 |
| iterative not waterfall | 边做边学、随时修正 |
| easy not complex | 几秒初始化，零仪式感 |
| brownfield-first | 增量描述变更，不要求从零描述整个系统 |

### 工作流

```
propose → specs → design → tasks → implement → verify → archive
  为什么    改什么    怎么改    步骤     写代码      验证    归档合并
```

每个 change 是一个自包含文件夹：

```
openspec/changes/add-dark-mode/
├── proposal.md      # 意图与范围
├── specs/           # Delta specs（增量规格）
├── design.md        # 技术方案
└── tasks.md         # 实现清单
```

### 关键概念

| 概念 | 说明 |
|------|------|
| Specs | 系统当前行为的单一事实来源 |
| Changes | 拟议变更，各自隔离互不冲突 |
| Delta Specs | 只描述 ADDED / MODIFIED / REMOVED，不重写全文 |
| Schemas | 定义产物类型和依赖图，依赖是 enabler 不是 gate |
| Archive | 变更完成后，增量合并入主规格，形成闭环 |

## 设计亮点

### 1. Delta Specs 增量规格（最核心的创新）

不要求完整重写，只写变化部分。这解决了 brownfield 开发中"规格维护成本太高"的核心痛点：

- **清晰**：一眼看出改了什么，无需心智 diff
- **无冲突**：多个 change 可以并行修改同一 spec 的不同 requirement
- **评审高效**：reviewer 只关注变更本身
- **归档自动合并**：ADDED 追加、MODIFIED 替换、REMOVED 删除

### 2. 产物依赖图 ≠ 阶段门

Schema 定义了产物之间的依赖关系（如 tasks 依赖 specs + design），但这是"可以创建"的前提条件，不是"必须按序完成"的硬门禁。你可以跳过 design 直接到 tasks，也可以反复迭代任何产物。

### 3. 规格 = 行为契约，不是实现计划

Spec 只描述**可观测行为**（输入输出、错误条件、外部约束），不包含类名、框架选择、实现细节。判断标准：如果实现可以变但外部行为不变，就不该写进 spec。

### 4. 闭环归档 = Spec 自然演化

Archive 不只是"移走旧文件"，而是把 delta 合并回主 specs。这意味着 specs 会随项目持续演化，永远反映系统当前状态——形成一个良性循环。

### 5. 渐进严格度（Progressive Rigor）

- **Lite spec（默认）**：短需求 + 几条验收检查，适合大部分日常变更
- **Full spec**：跨团队、API 变更、安全隐私等高风险场景再加码

避免一刀切的文档量要求，让投入与风险匹配。

### 6. 工具无关 + 斜杠命令分发

通过 `/opsx:propose`、`/opsx:apply`、`/opsx:archive` 等斜杠命令触发，与底层 AI 工具解耦。一套规格流程适配 Claude Code、Copilot、Cursor、Windsurf 等 25+ 工具。

### 7. Coordination Workspace（跨仓协同）

Beta 功能。为多仓/单大仓场景提供 machine-local workspace，通过 stable link name 引用各仓路径，支持跨仓规划而不污染各仓本地状态。

## 与相关概念的关系

- 与 [[anthropic-claude-code-practices]] 互补：SDD 提供结构化规划层，Claude Code 实践提供执行层的最佳实践
- 与 [[everything-claude-code]] 的 CLAUDE.md 生态对应：OpenSpec 是更重视规格演化的方案，ECC 侧重 harness 配置
- 与 [[harness-as-moat]] 观点一致：规格层是 harness 的上游控制面，SDD 让 AI coding 更可控可预测

## 竞品对比

| 方案 | 特点 | 劣势 |
|------|------|------|
| OpenSpec | 轻量、工具无关、brownfield-first | 生态尚年轻 |
| GitHub Spec Kit | 严格完整 | 重量级，Python，刚性阶段门 |
| AWS Kiro | IDE 集成深度好 | 锁定 IDE + 模型 |
| 无规格 | 零成本 | 不可预测、不可追溯 |
