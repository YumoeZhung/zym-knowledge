---
title: "Everything Claude Code (ECC)：近20万Star的Agent Harness配置框架"
created: 2026-05-28
last_updated: 2026-05-28
source: https://mp.weixin.qq.com/s/EWfhQMrfHJXyZ-MjfxybNA
tags: [agent, harness, claude-code, open-source, developer-tools]
---

# Everything Claude Code (ECC)：近20万Star的Agent Harness配置框架

旧金山开发者 Affaan Mustafa 将自己打磨十个月的 Claude Code 工作流开源，形成一套"harness-native operator system"。61个专业Agent + 246个Skill + 76个Command，支持 Claude Code / Codex / Cursor / Gemini 等多平台。GitHub 近20万Stars。

## 起源故事

2025年9月 Anthropic + Forum Ventures 黑客松 → Affaan 用 Claude Code 一天内构建 zenith.chat（AI客户调研平台）→ 夺冠 → 将背后工作流开源 → 3个月冲到近20万Star。

## 核心架构

```
ECC
├── agents/       # 61个专业Agent（架构、测试、审查、安全…）
├── skills/       # 246个技能（按语言/框架分类）
├── commands/     # 76个命令
├── hooks/        # 自动触发检查
├── rules/        # 规则文件（需手动复制）
└── memory/       # 跨会话记忆系统
```

### 关键设计：按需加载

246个技能不会同时占用上下文。系统根据当前项目语言和任务类型，只加载相关子集：
- TypeScript 项目 → 加载 TS 审查 Agent
- 写测试 → 启动 TDD Agent
- 安全扫描 → 启动 AgentShield

这解决了"技能多 vs 上下文有限"的矛盾。

### AgentShield 安全系统

- 毫秒级代码扫描，拦截凭证/私钥泄露
- `--opus` 模式启动红蓝对抗：
  - 红队 Agent：专找漏洞
  - 蓝队 Agent：负责修复
  - 审计师 Agent：汇总结果

## 实用建议

| 配置项 | 建议值 | 原因 |
|--------|--------|------|
| MCP 总配置数 | 20-30 | 过多工具定义会占上下文 |
| 单项目启用 MCP | ≤10 | 保持聚焦 |
| 活跃工具数 | ≤80 | 200k上下文启用过多工具可能缩水到70k |

## 核心洞察

1. **Harness 层正在产品化**：ECC 证明了 [[harness-as-moat]] 中的观点——配置（技能、规则、记忆、安全）正变得和模型本身一样重要
2. **个人工作流 ≠ 通用最优**：ECC 是作者个人十个月磨出来的，社区最大争议就是"太多功能用不到"。正确用法是挑选+裁剪+定制
3. **上下文管理是核心挑战**：246个技能能跑起来的前提是按需加载，否则直接撑爆窗口。这是所有 Agent Harness 面临的工程约束
4. **跨平台趋势**：ECC 不只服务 Claude Code，还兼容 Codex/Cursor/Gemini/Zed——Harness 层正在与底层模型解耦

## 与 Claude Code 官方实践的对比

| 维度 | Claude Code 官方（Boris Cherny 风格） | ECC |
|------|--------------------------------------|-----|
| 哲学 | 极薄产品 + 重个人实践 | 厚配置 + 社区共享 |
| Agent数 | 按需手动开子Agent | 61个预定义Agent |
| 复杂度 | 极简 | 极繁（可裁剪） |
| 适合 | 高手自定义 | 入门者快速获得能力 |

这印证了 [[anthropic-claude-code-practices]] 中的观点：Claude Code 产品本身极薄，但使用者的实践可以很厚。ECC 就是"厚实践"的社区产物。

## Related

- [[harness-as-moat]] — Harness 作为竞争壁垒，ECC 是这一理论的最大规模社区验证
- [[anthropic-claude-code-practices]] — 官方实践（薄产品+重流程）vs ECC（厚配置+社区共享）
- [[agent-system-architecture]] — Agent 系统架构中 Harness 层的定位
- [[browser-harness]] — 另一个 Harness 案例（浏览器自动化方向）
