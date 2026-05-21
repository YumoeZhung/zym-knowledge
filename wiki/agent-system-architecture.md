---
title: Agent System Architecture
created: 2026-05-20
last_updated: 2026-05-20
tags: [agent, architecture, llm, system-design]
sources: [raw/2026-05-20-agent-system-architecture-discussion.md]
---

# Agent System Architecture

An Agent system is composed of five layers with distinct responsibilities. These terms are not fully standardized across the industry, but a rigorous system should maintain clear boundaries between them.

References: OpenAI Agents SDK docs, Anthropic "Building effective agents".

## Layers (Inner to Outer)

### Agent Loop

The innermost think-act cycle:

```
prepare context → call model → parse tool_use → execute tool
→ append tool_result → check stop condition → check compact → repeat
```

Terminates on: `end_turn`, error, or `max_turns`.

**Responsibility**: Detect when context is near capacity and trigger compaction. Does NOT own persistence of compaction results.

### Agent Runtime

The execution environment surrounding the loop.

**Responsibilities**:
- Session lifecycle management
- Message persistence
- History recovery
- Compact boundary commits
- Cancellation / interruption
- Concurrency control
- Working directory / workspace state
- Background tasks
- Error recovery

### Agent Harness

The overall assembly framework ("execution shell"). Composes:
- Model client
- Tool system
- Permission system
- Context builder
- Compaction strategy
- Session runtime
- Adapter
- Observability / logging
- Sandbox / filesystem

### SDK

Public interface for callers (`sdk.run()`, `sdk.query()`). Hides internal complexity from entry points (Feishu, CLI, Daemon, Web UI).

Two architectural choices:

| | Complete Runner | Stateless Executor |
|---|---|---|
| Session management | SDK owns it | External |
| Persistence | SDK commits | Caller's responsibility |
| Compaction | SDK handles | External AgentRuntime needed |
| Trade-off | More product-ready | More flexible |

**Principle**: If no independent AgentRuntime exists, the SDK should either embed session runtime or expose an explicit session persistence contract. Otherwise every Adapter reinvents persistence inconsistently.

### Adapter

Pure channel layer. Examples: Feishu, CLI, HTTP, IDE plugin.

**Should NOT**: know about compact boundaries, handle message storage, implement recovery logic.

**Should**: translate channel-specific I/O into SDK calls, display status ("compacted"), handle user interaction patterns.

## Responsibility Distribution for Context Compaction

Compaction is not owned by a single layer — it is a cross-cutting concern:

| Layer | Role in Compaction |
|---|---|
| Harness | Owns the capability and strategy |
| Agent Loop | Triggers compaction (detects context pressure) |
| Context Manager | Executes summarization |
| Runtime/Storage | Commits the compact boundary to persistent state |
| Adapter | Displays status only |

## Key Architectural Principle

> Extract MessageStorage + compact boundary commits out of Adapters. Place them in AgentRuntime or SDK Runner so all entry points share unified session recovery and compaction semantics.

## Related

- [[harness-as-moat]] — Harness 作为竞争壁垒的产业辩论与控制论视角
