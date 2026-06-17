---
source: user conversation note
captured: 2026-06-17
type: note
---

# Agent Harness Durable Compaction Runtime Boundary

## Core Idea

“压缩边界持久化 / 恢复不膨胀”应该是 Agent Harness 的 session/runtime 层能力，而不应该散落在 CLI、飞书、HTTP runner 这些 adapter 里。

## Architecture Judgment

Durable Compaction 的本质不是某一种启动入口的交互逻辑，而是 Agent Harness 对 session 历史的生命周期管理：

- 何时加载 session 历史。
- 何时追加新 message。
- 何时提交 compaction boundary。
- compact 后哪些历史应该从恢复上下文中排除。
- 如何避免 compact event 中的 messages 被后续 message event 重复持久化。
- 如何维护 `lastCwd`、`lastModel`、`spilledToolResults` 等 session metadata。

这些语义决定了“恢复时上下文是否会重新膨胀”，所以它们应由 Agent Harness 的 session/runtime 层统一承担。

## Adapter Boundary

CLI、飞书、HTTP runner / Task Engine runner 的职责应该是：

- 提供用户输入或平台请求。
- 绑定执行环境，例如 cwd、模型、权限、运行目录。
- 选择具体 SessionStore 实现。
- 把 runtime 产出的事件转发给终端、飞书、trace、HTTP response 或 artifacts。

它们不应该各自实现 compaction boundary 计算、恢复裁剪、message 去重和 session metadata 更新。否则同一个 Agent Harness 在不同运行方式下会出现不同的 durable compaction 行为。

## Consequence

把 Durable Compaction 放在 Agent Harness session/runtime 层之后：

- CLI 自动 compact / 手动 compact 有效。
- 飞书 bot 的 effective cwd 和 compact 后恢复逻辑保持有效。
- 通过 HTTP API 启动的 Task Engine 也能共享同一套 compaction 持久化和恢复语义。
- Infra 平台不需要改变 HTTP 请求或响应协议，只需要让 Task Engine runner 在 run directory 中选择 run-scoped SessionStore。
- Run artifacts 可以作为 same-run execution state 的 source of truth，RunStore / Run Dictionary 继续作为 run 状态和 artifact 指针索引。

## Design Heuristic

如果某个逻辑回答的是“这个 agent session 的历史应该如何被持久化、裁剪和恢复”，它属于 Agent Harness session/runtime。

如果某个逻辑回答的是“这个 session 从哪个入口启动、事件输出到哪里、运行目录或平台请求如何绑定”，它属于 adapter / runner。

## Related Concepts

- [[agent-harness]]
- [[session-runtime]]
- [[task-engine]]
- [[durable-compaction]]
