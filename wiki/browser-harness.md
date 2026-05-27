---
title: "Browser Harness：592行代码的自愈式浏览器自动化"
created: 2026-05-27
last_updated: 2026-05-27
source: http://xhslink.com/o/3IrXjmxsK8n
tags: [agent, browser-automation, self-healing, harness, open-source]
---

# Browser Harness：592行代码的自愈式浏览器自动化

Browser Use 团队（主项目 88k+ Stars）开源的极简浏览器自动化框架。592 行 Python、4 个文件，通过 WebSocket 直连 Chrome DevTools Protocol，让 AI Agent 在运行时自我编写缺失能力。开源即获 3.2K Stars。

## 核心架构

```
┌─────────────┐     WebSocket      ┌──────────────┐
│  Agent.py   │ ◄──────────────► │   Chrome     │
│  (AI 编排)   │     CDP协议       │   (浏览器)    │
└──────┬──────┘                    └──────────────┘
       │
       ▼
┌─────────────┐
│  Skills.py  │  ← 已学会的操作持久化存储
└─────────────┘
```

| 文件 | 职责 | 行数(估) |
|------|------|----------|
| harness.py | WebSocket + CDP 命令收发 | ~200 |
| agent.py | 任务分解 + 自愈逻辑 | ~200 |
| skills.py | Domain Skills 存储/检索 | ~120 |
| utils.py | 工具函数 | ~70 |

## 三个关键创新

### 1. 去框架化：WebSocket 直连 CDP

传统：`Python → Playwright/Selenium → WebDriver Protocol → Browser`
Harness：`Python → WebSocket → Chrome DevTools Protocol`

绕过所有中间层，消除依赖地狱和抽象泄漏。CDP 本身就是 Chrome 的原生控制接口，足够强大。

### 2. 自愈执行：AI 即时编写缺失函数

当 Agent 遇到未实现的操作：

1. 识别"我没有这个能力"
2. 根据任务上下文 + CDP API 文档，AI 动态生成 Python 函数
3. 注入运行时并执行
4. 验证成功后保存为 Domain Skill

这是 [[harness-as-moat]] 中"飞轮"概念的具体实现——Agent 失败 → 生成修复 → 内化为能力。

### 3. Domain Skills 系统：跨会话学习

- 首次执行操作：AI 生成代码（慢，约数秒）
- 再次执行同类操作：命中已有 Skill（快，毫秒级）
- 技能库随使用增长，覆盖率越来越高
- 类似人类"肌肉记忆"的形成过程

## 为什么重要

| 维度 | 传统自动化 | Browser Harness |
|------|-----------|-----------------|
| 代码量 | 数万行 | 592行 |
| 脆弱性 | 页面一改就断 | AI 自适应修复 |
| 维护成本 | 高（人工更新选择器） | 低（自愈） |
| 能力边界 | 预定义操作集合 | 无限（AI 即时生成） |
| 适用场景 | 确定性 E2E 测试 | AI Agent 探索性任务 |

## 局限与风险

- **安全性**：AI 动态生成并执行代码 = 潜在攻击面
- **确定性**：不适合需要 100% 可复现的 CI/CD 测试
- **依赖 AI 质量**：自愈质量取决于底层 LLM 能力
- **CDP 绑定**：仅支持 Chromium 内核浏览器

## 启示

1. **极简是新趋势**：592行 > 数万行，少即是多
2. **Harness 的演化方向**：从静态规则 → 动态自愈 → 自我进化
3. **AI-native 工具设计**：为 AI 设计的工具和为人设计的工具有本质区别（前者重自愈，后者重 UI）
4. **技能积累飞轮**：与 [[harness-as-moat]] 的"迭代速度即壁垒"观点一致

## Related

- [[harness-as-moat]] — Harness 作为竞争壁垒的理论框架
- [[agent-system-architecture]] — Agent 系统架构中 Harness 层的定位
- [[anthropic-claude-code-practices]] — Claude Code 的工程实践（另一种 Agent+工具的思路）
