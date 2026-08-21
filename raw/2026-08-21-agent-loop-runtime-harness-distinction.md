---
source: "Codex conversation; OpenAI Codex CLI and DeepSeek Harness official source code"
captured: 2026-08-21
type: note
---

# Agent Loop、Agent Runtime 与 Agent Harness 辨析

这些术语没有统一的行业标准，尤其是 Harness 与 Runtime 经常被混用。为了建立稳定的工程语言，可以把三者分别理解为算法、运行系统和装配框架。

## 核心关系

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

## Agent Loop

Agent Loop 是最内层的控制流算法：

```text
组装模型请求
→ 调用模型
→ 模型返回 tool call 或最终回答
→ 对 tool call 做策略检查并执行
→ 把 observation 写回上下文
→ 继续调用模型或进入 terminal state
```

可靠的 Loop 还需要维持多轮 state、tool call 与 observation 配对、stop reason、turn/token/tool budget、cancellation、context compaction 触发、并发顺序和错误终止语义。

## Agent Runtime

Agent Runtime 是 Loop 运行所需的执行系统：

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

Runtime 不必拥有业务目标和行业流程，但必须保证给定任务被安全、准确、可观测地执行。持久化可以由 Runtime 内置，也可以由外部实现，但必须存在明确且一致的 session/persistence contract。

## Agent Harness

Agent Harness 是用于装配、扩展、嵌入和交付 Runtime 的工程框架。它通常定义公共 API、依赖注入、插件和工具注册、provider adapter、配置、生命周期、CLI/SDK/headless/web 运行形态，以及测试和发布边界。

Harness 更接近“可复用的软件包和装配规则”，Runtime 更接近“这些组件启动后的执行系统”，Loop 则是 Runtime 内部反复运行的控制算法。

## 开源实现对照

### Codex CLI

OpenAI Codex CLI 的 `run_turn()` 是明显的 Agent Loop：模型请求 function call 时执行工具，并把结果送入下一次 sampling；只返回 assistant message 时结束本轮。

Codex Core 在 Loop 外还提供 session、tool runtime、approval、sandbox、retry、compaction、cancellation、MCP、Skills 和 telemetry，因此属于更完整的 Agent Runtime。整个 Codex CLI 则可以视为面向 coding 场景的 Harness/Product，尽管官方未把 Harness 作为它的主产品术语。

### DeepSeek Harness

DeepSeek Harness 明确采用 Everything is a Plugin。model adapter、tool registry、session log 和 agent loop 都是可替换插件；profile 与 bundle 在启动时组成一棵 plugin tree。

`dsh-agent-loop` 是其中唯一包含具体 Loop 逻辑的 package。启动后的完整 plugin tree 是 Runtime，而 DeepSeek Harness 是装配并交付这些能力的框架和产品。

## 推荐术语合同

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

## Sources

- https://developers.openai.com/codex/cli/
- https://github.com/openai/codex/blob/bd19459358f534ed1cae464ec13d56600aeb45f2/codex-rs/core/src/session/turn.rs
- https://github.com/openai/codex/blob/bd19459358f534ed1cae464ec13d56600aeb45f2/codex-rs/core/src/tools/orchestrator.rs
- https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/docs/architecture.md
- https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/core/agent-loop/README.md
