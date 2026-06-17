---
title: Agent Harness Durable Compaction Runtime Boundary
created: 2026-06-17
last_updated: 2026-06-17
tags: [agent-harness, durable-compaction, session-runtime, architecture, task-engine]
sources: [raw/2026-06-17-agent-harness-durable-compaction-runtime-boundary.md]
---

# Agent Harness Durable Compaction Runtime Boundary

压缩边界持久化和恢复不膨胀应作为 Agent Harness 的 session/runtime 层通用能力，而不是散落在 CLI、飞书、HTTP runner 等 adapter 中。adapter 负责启动方式和 I/O 边界，runtime 负责 session load、message append、compaction commit、恢复去重和 cwd/model 等 session metadata 维护。这样 HTTP API 启动的 Task Engine、CLI 和飞书路径都能共享同一套 durable compaction 语义，避免不同入口各自实现导致状态不一致。

## Core Position

Durable Compaction 的关键问题不是“某个入口如何展示 compact 结果”，而是“一个 agent session 的历史如何被持久化、裁剪、恢复，并保证恢复后上下文不会重新膨胀”。

因此，压缩边界持久化、恢复裁剪和 compact 后消息去重应该归属于 Agent Harness 的 session/runtime 层，而不是 CLI、飞书、HTTP runner 或 Task Engine runner 各自实现。

## Runtime Responsibilities

Agent Harness session/runtime 层应统一负责：

- 加载 session 历史。
- 追加新的 message。
- 提交 compaction boundary。
- compact 后只恢复 boundary 之后的有效上下文。
- 避免 compact event 中的 messages 被后续 message event 重复持久化。
- 维护 `lastCwd`、`lastModel`、`spilledToolResults` 等 session metadata。

这些语义直接决定恢复时是否会把压缩前历史重新带回上下文，所以它们必须有一个统一的 source of truth。

## Adapter Responsibilities

CLI、飞书、HTTP runner / Task Engine runner 的职责应限制在入口和 I/O 边界：

- 提供用户输入或平台请求。
- 绑定执行环境，例如 cwd、模型、权限、运行目录。
- 选择具体的 `SessionStore` 实现。
- 把 runtime 产出的事件转发到终端、飞书、trace、HTTP response 或 run artifacts。

adapter 不应该各自实现 compaction boundary 计算、恢复裁剪、message 去重或 session metadata 更新。否则同一个 Agent Harness 在不同启动方式下会拥有不同的 durable compaction 语义。

## Consequences

把 Durable Compaction 放在 Agent Harness session/runtime 层后：

- CLI 自动 compact 和手动 compact 共享同一套恢复语义。
- 飞书 bot 的 effective cwd 和 compact 后恢复逻辑仍然有效。
- 通过 HTTP API 启动的 Task Engine 也能获得同样的压缩边界持久化和恢复不膨胀能力。
- Infra 平台不需要改变 HTTP 请求或响应协议。
- Task Engine runner 只需要在 run directory 中选择 run-scoped `SessionStore`。
- Run artifacts 可以作为 same-run execution state 的 source of truth；RunStore / Run Dictionary 继续作为 run 状态和 artifact 指针索引。

## Design Heuristic

如果某个逻辑回答的是“这个 agent session 的历史应该如何被持久化、裁剪和恢复”，它属于 Agent Harness session/runtime。

如果某个逻辑回答的是“这个 session 从哪个入口启动、事件输出到哪里、运行目录或平台请求如何绑定”，它属于 adapter / runner。

## Related

No related wiki pages yet.
