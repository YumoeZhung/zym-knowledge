---
title: Agent Loop、Agent Runtime 与 Agent Harness 的边界
created: 2026-05-20
last_updated: 2026-09-01
tags: [agent, agent-harness, agent-loop, agent-runtime, architecture, llm, open-source, system-design]
sources: [raw/2026-05-20-agent-system-architecture-discussion.md, raw/2026-08-21-agent-loop-runtime-harness-distinction.md]
---

# Agent Loop、Agent Runtime 与 Agent Harness 的边界

## 核心结论

三个概念处在不同抽象层级：

| 概念 | 本质 | 回答的问题 |
|---|---|---|
| Agent Loop | 控制流算法或 driver | 下一步是继续调用模型、执行工具，还是停止？ |
| Agent Runtime | Loop 实际运行所需的执行系统 | 这次 Agent 如何安全、可靠、可恢复地运行？ |
| Agent Harness | 装配、扩展和交付 Runtime 的工程框架 | 如何把模型、工具、策略、会话和宿主系统组合起来？ |

它们的典型包含关系是：

```text
Agent Harness（代码包、装配框架、扩展契约）
        │ 启动并注入配置
        ▼
Agent Runtime（正在运行的执行环境或实例）
        ├── Agent Loop（核心控制循环）
        ├── Model adapter
        ├── Tool registry/executor
        ├── Session/context
        ├── Permission/sandbox
        ├── Budget/cancellation
        └── Events/trace/persistence
```

术语并没有统一标准。尤其是 Harness 和 Runtime，有些项目用 Harness 指整个产品，有些项目只用它指外围测试或装配层。因此，讨论架构时必须同时声明“包含哪些能力”和“运行时由谁拥有”，不能只依赖名称。

## Agent Loop：控制算法

Agent Loop 是最内层的 model–tool–observation 循环：

```text
组装模型请求
→ 调用模型
→ 模型返回 tool call 或最终回答
→ 对 tool call 做策略检查并执行
→ 把 observation 写回上下文
→ 继续调用模型或进入 terminal state
```

一个可靠的 Loop 不只是 `while (true)`，还需要维护：

- 多轮 state 和 message history；
- tool call 与 observation 的严格配对；
- completed、error、budget、cancelled 等封闭终止原因；
- turn、token、tool-call 和时间预算；
- cancellation 与中断后的状态收敛；
- context pressure 检测及 compaction 触发；
- 并发工具执行的顺序和一致性。

Loop 可以触发压缩或终止，但不应独自拥有 durable persistence、产品配置或业务流程。

## Agent Runtime：执行系统

Runtime 是让 Loop 真正运行起来的一组机制：

```text
Agent Runtime
= Agent Loop
+ Model Client
+ Tool Runtime
+ Context/Session
+ Permission/Sandbox
+ Budget/Timeout
+ Cancellation
+ Trace/Event
+ Error/Terminal Contract
```

Runtime 不等于业务编排。它不应根据模糊目标发明行业流程，但必须准确执行已经声明的目标、工具目录和约束，并强制不可绕过的权限、预算和取消边界。

Session persistence 可以内置在 Runtime，也可以通过外部 contract 提供；关键是不允许 CLI、HTTP、飞书或 IDE 等 Adapter 分别实现一套恢复和压缩语义。

## Agent Harness：装配与交付框架

Harness 通常负责：

- 定义公共 API、类型和依赖注入接口；
- 连接 model provider 与 tool provider；
- 注册或替换 tools、plugins、hooks 和 policies；
- 组合 session、sandbox、permission、trace 和 persistence；
- 提供 CLI、SDK、headless、web 等宿主形态；
- 管理生命周期、配置、测试、打包和发布边界。

可以从生命周期角度辅助区分：

- Harness 是可复用的代码、契约和装配方式；
- Runtime 是 Harness 启动或被宿主调用后形成的执行系统；
- Loop 是 Runtime 内部反复运行的算法。

## Codex CLI 对照

OpenAI Codex CLI 的 `run_turn()` 是典型 Agent Loop：模型返回 function call 时执行工具并把结果送回下一次 sampling；只返回 assistant message 时结束本轮。

Loop 外部还有 session、tool runtime、approval、sandbox、retry、compaction、cancellation、MCP、Skills 和 telemetry，它们共同形成 Codex Core Runtime。整个 Codex CLI 则可以视为面向 coding 场景的 Harness/Product，尽管 Harness 不是官方主产品术语。

因此，不能把 Codex 的 `run_turn()` 与整个 Codex CLI 画等号，也不能把 coding-oriented Harness 的全部策略默认移入通用企业 Runtime。

## DeepSeek Harness 对照

DeepSeek Harness 采用 Everything is a Plugin：model adapter、tool registry、session log 和 agent loop 都是可替换插件；profile 与 bundle 在启动时组成一棵 plugin tree。

它明确将 `dsh-agent-loop` 定义为唯一包含具体 Loop 逻辑的 package，其余能力通过 service 或 plugin 接入扩展点。这给出了清晰分层：

```text
DeepSeek Harness
├── session plugin
├── system-prompt plugin
├── tools plugin
├── llm adapter plugin
├── sandbox/approval/persistence plugins
└── agent-loop plugin
```

完整 Harness 启动后的 plugin tree 是 Runtime，`agent-loop` 只是其中的控制 driver。

## 推荐术语合同

为避免在设计和面试中混淆，建议固定采用：

```text
AgentLoop
  = 内部 model/tool/observation 控制算法

Kernel Runtime
  = AgentLoop + tools + permissions + budgets
    + cancellation + terminal/events

Agent Harness
  = 发布并承载 Runtime contract 的代码包和装配框架

Business Orchestrator
  = Runtime 之外的业务流程、目标、策略和结果映射
```

一句话总结：**Loop 是算法，Runtime 是执行系统，Harness 是装配并交付这个执行系统的工程框架。**

## Context Compaction 的跨层分工

Compaction 能说明三个层级为何不能混为一谈：

| 层级 | 职责 |
|---|---|
| Harness | 提供可替换的 compaction capability 和配置 seam |
| Agent Loop | 在运行中检测 context pressure 并触发状态转移 |
| Context Manager | 执行摘要或历史变换 |
| Runtime/Storage | 提交 compact boundary，并保证恢复时不重新膨胀 |

详细的持久化边界见 [[agent-harness-durable-compaction-runtime-boundary]]。

## Sources

- [OpenAI Codex CLI](https://developers.openai.com/codex/cli/)
- [OpenAI Codex `run_turn`](https://github.com/openai/codex/blob/bd19459358f534ed1cae464ec13d56600aeb45f2/codex-rs/core/src/session/turn.rs#L139-L159)
- [OpenAI Codex Tool Orchestrator](https://github.com/openai/codex/blob/bd19459358f534ed1cae464ec13d56600aeb45f2/codex-rs/core/src/tools/orchestrator.rs#L1-L8)
- [DeepSeek Harness Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/docs/architecture.md#L9-L25)
- [DeepSeek `dsh-agent-loop`](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/core/agent-loop/README.md#L1-L15)

## Related

- [[agent-harness-durable-compaction-runtime-boundary]] — durable session、compaction 与恢复边界
- [[harness-as-moat]] — Harness 的控制论与竞争壁垒视角
- [[long-horizon-agent-drift-loop-control]] — 长任务中的 Loop 控制与验证
- [[claw-swe-bench-harness-evaluation]] — 把 Harness 作为可测变量
- [[constrained-decoding]] — Model adapter/Runtime 中的结构化输出与逐 token 约束边界
