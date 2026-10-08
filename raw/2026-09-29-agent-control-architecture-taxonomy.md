# 2026-09-29 Agent Control Architecture taxonomy discussion

## Confirmed taxonomy

- Agent Loop: runtime 内部的核心控制循环。
- Reasoning / Control Pattern: ReAct、Plan-and-Execute、Replanning、Tree/Search-based。
- Verification / Recovery: Reflexion、Self-Refine、Critic、Verifier。
- Orchestration topology: Single-Agent、Manager-Worker、Agent-as-Tool、Handoff、Debate、Graph。
- Agent Runtime / Harness: 承载上述机制的执行与装配层，不是与这些模式并列的第五种控制策略。

Reflexion 是反馈与恢复机制；Multi-Agent 是编排拓扑，因此二者不是同一维度。

## Architecture

```text
Agent Harness
└── Agent Runtime
    ├── Agent Loop
    │   ├── Reasoning / Control Pattern
    │   ├── Verification / Recovery
    │   └── Tool / Observation transitions
    ├── Orchestration
    │   ├── Single Agent
    │   └── Multi-Agent
    └── Runtime capabilities
        ├── Context / Session
        ├── Memory / Persistence
        ├── Tool Runtime
        ├── Sandbox / Permissions
        ├── State
        ├── Budgets / Cancellation
        └── Tracing / Observability
```
