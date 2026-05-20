# Agent 系统架构分层讨论

来源：飞书对话，2026-05-20
背景：讨论 Agent 系统中各层（Loop/Runtime/Harness/SDK/Adapter）的定义、职责边界和协作关系。

---

这些词没有完全统一的行业标准，不同框架会混用。但在一个严肃的 Agent 系统里，应坚持以下边界。

参考：OpenAI Agents SDK running docs、Agents docs，以及 Anthropic "Building effective agents"。

## Agent Loop

Agent Loop 是最内层的"思考-行动循环"。

它做的是：
准备上下文 -> 调模型 -> 解析 tool_use -> 执行工具 -> 把 tool_result 放回消息 -> 判断是否继续 -> 判断是否 compact -> 直到 end_turn / error / max_turns

Agent Loop 负责在运行中发现上下文快爆了，并触发 compact，使下一次模型调用能继续。但它不应该独自负责"压缩结果如何持久化到磁盘"。这是 Runtime/Session 层的职责。

## Agent Runtime

Agent Runtime 是 Agent Loop 外面的运行时环境。

它负责：session 生命周期、消息持久化、恢复历史、compact boundary 写入、取消/中断、并发控制、cwd/workspace 状态、日志、后台任务、错误恢复。

## Agent Harness

Agent Harness 是更大的"装配框架"或"执行外壳"。

它把这些东西装起来：模型客户端、工具系统、权限系统、上下文构建、压缩策略、session runtime、adapter、日志/观测、sandbox/filesystem。

压缩机制应该是 Agent Harness 具备的能力。但真正落到代码里时，压缩会分散到几个组件：
- Harness 提供能力和策略
- Agent Loop 决定何时触发
- Context Manager 生成摘要
- Runtime/Storage 提交 compact boundary
- Adapter 不应该决定这些

正确说法不是"Loop 负责压缩"或者"Harness 负责压缩"二选一，而是：Harness 拥有上下文压缩这个能力；Loop 是触发点；Context Manager 是执行摘要的组件；Runtime 是持久化提交者。

## SDK

SDK 是给开发者或上层应用调用 Agent 的公共接口。例如 sdk.query(...)、sdk.run(...)。

它的角色是把底层复杂性包装起来，让 Feishu、CLI、Daemon、Web UI 这种上层入口不需要知道 Agent Loop 的细节。

两种架构选择：
- 方案 A：SDK 是完整 Runner — SDK 自带 session/runtime/persistence。调用方只传 sessionId，SDK 负责恢复、压缩、写 boundary、保存消息。更产品化。
- 方案 B：SDK 是无状态执行器 — SDK 只跑一轮 agent，历史由外部传入，结果由外部保存。需要独立的 AgentRuntime 在 SDK 外面负责持久化。

如果当前架构没有独立的 AgentRuntime，那么 SDK 作为统一入口，就应该承载 session runtime，或者至少暴露一个明确的 session persistence contract。否则每个 Adapter 都会被迫重复处理消息保存、compact boundary、恢复语义，最终一定会不一致。

## Adapter

Adapter 只负责通道：飞书、CLI、HTTP、IDE。不应该知道 compact boundary，也不应该手写持久化逻辑。它们最多只是展示"已压缩"。

## 正确关系

```
Adapter        — 只负责通道：飞书、CLI、HTTP、IDE
SDK            — 给 Adapter 调用的开发接口：run/query/stream
Agent Runtime  — 管 session、持久化、恢复、compact commit、取消、并发
Agent Harness  — 整个 Agent 执行框架：runtime + loop + tools + model + permissions + context
Agent Loop     — 最内层循环：model -> tools -> model -> compact -> stop
```

## 架构原则

把 MessageStorage + compactBoundary commit 从 Adapter/CLI 中抽出来，放到 AgentRuntime 或 SDK Runner 里，让所有入口共享同一套 session 恢复和 compact 持久化语义。
