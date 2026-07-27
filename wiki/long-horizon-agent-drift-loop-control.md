---
title: "长任务 Agent 跑偏、绕路与死循环：Harness 控制闭环"
created: 2026-07-28
last_updated: 2026-07-28
source: https://b23.tv/jRCBPEQ
tags: [agent, agent-harness, evaluation, harness, observability, reliability, system-design, verification]
sources: [raw/2026-07-28-long-horizon-agent-drift-loop-control.md]
---

# 长任务 Agent 跑偏、绕路与死循环：Harness 控制闭环

## 一句话结论

长任务 Agent 的可靠性不能靠一句“请不要跑偏”的 prompt 保证，而要把执行过程做成一个**带显式目标状态、进度证明、验证门、预算、checkpoint 和终止条件的受控状态机**。

视频提出 `Planner → Memory → Critic → Guardrail → Observability` 五层闭环，方向正确，但有两个关键修正：

1. 不能“锁死计划”，应当**锁定目标与不变量，允许计划经过证据驱动、版本化的受控变更**。
2. 不能假设所有操作都能直接回滚；对外部副作用必须使用**幂等、事务边界和补偿操作**。

## 先区分三种失败

三者看起来相似，但探测信号和处理方式不同：

| 失败类型 | 定义 | 可观测信号 | 首选处置 |
|---|---|---|---|
| 跑偏 `goal drift` | 当前动作不再服务原始目标或违反不变量 | 目标一致性下降、产出无法通过 verifier、出现未授权子目标 | 阻断当前分支，回到最后合法状态，重新规划 |
| 绕路 `unproductive detour` | 动作仍与目标相关，但没有产生足够新信息或有效进度 | 工具调用增加但状态增量接近零、重复探索已否定路径 | 比较替代路径，设置探索预算，切换策略 |
| 死循环 `loop` | Agent 重复进入等价状态或重复执行同类动作 | state/action signature 周期性重复、同错重试、预算持续燃烧 | 硬中断，输出诊断或转人工，不允许无条件重试 |

核心区别是：**跑偏看方向，绕路看单位成本的进展，死循环看状态是否重复。**

## 根因不是“上下文不够”这么简单

视频指出上下文挤压、任务拆解不规范和缺少逐步校验，这三项成立，但从 Harness 视角还应补齐四类根因：

- **目标没有被编译成机器可检查的 contract**：只保存自然语言原句，无法判断一步是否真正前进。
- **状态与聊天历史混在一起**：Agent 只能从长 transcript 猜测“现在做到哪了”。
- **失败分类太粗**：权限失败、参数错误、瞬时网络错误、业务拒绝都走同一个 retry 分支。
- **工具缺少副作用语义**：Harness 不知道一次调用是只读、幂等、可补偿，还是不可逆。

因此，上下文压缩只能缓解遗忘，不能单独解决跑偏。可靠性来自 `state + transition + verifier + budget + recovery` 的共同约束。

## 一套更可落地的控制架构

### 1. Goal Contract：目标不变量与完成标准

任务开始时，不只是保存用户原话，而是生成并校验一个 `Goal Contract`：

```yaml
objective: 修复长任务执行中的重复检索问题
success_criteria:
  - 原始 repro 不再重复检索
  - changed-case 仍能选择正确检索路径
  - negative case 不误触发提前终止
invariants:
  - 不修改用户未授权的生产数据
  - 不把特定 case id 或业务文本写进生产规则
out_of_scope:
  - 不重构无关模块
budgets:
  max_steps: 24
  max_retries_per_failure_class: 2
  max_tokens: 80000
```

真正应该“锁死”的是 `objective`、`invariants`、权限边界和预算上限。计划只是实现目标的一个假设，不应被永久冻结。

### 2. Versioned Planner：允许受控重规划

计划中的每一步都应包含：

- 前置条件；
- 预期状态变化；
- 可验收产物；
- verifier；
- 失败后的替代路径；
- 是否有外部副作用。

重规划只能由明确事件触发，例如新证据推翻假设、前置条件不成立、预算收益比过低或 verifier 连续失败。每次修改生成新 `plan_version`，记录：

```text
旧计划为什么失效 → 哪条新证据触发变更 → 新计划如何仍满足 Goal Contract
```

这样既避免模型随意改计划，也不会因为早期计划错误而机械地“坚持主线”。

### 3. Structured State：不要让模型从日志猜进度

每一轮只向模型提供受控的 state packet：

```yaml
goal_contract: ...
plan_version: 3
current_step: verify_changed_cases
completed_artifacts:
  - path: tests/test_loop_detection.py
    verifier: pytest
    result: passed
evidence:
  - changed-case-1 still fails because state hash ignores tool arguments
open_risks:
  - retry classifier has no permission-denied branch
budget:
  steps_remaining: 7
  tokens_remaining: 21000
last_checkpoint: cp-08
```

完整日志仍然持久化，但不应默认全部塞回模型。Context builder 按当前步骤检索相关证据，同时始终携带目标、不变量、预算和未决风险。这与 [[agent-harness-durable-compaction-runtime-boundary]] 的原则一致：压缩与恢复属于 session/runtime 的稳定能力。

### 4. Progress Verifier：用“新状态”证明进展

每一步执行后都需要回答两个问题：

1. 产出是否满足该步骤的 acceptance criteria？
2. 与执行前相比，是否产生了可度量的新状态？

验证优先级应是：

1. 确定性 verifier：tests、schema、type checker、数据库约束、文件 hash、API 状态；
2. 环境反馈：真实工具返回、服务日志、浏览器状态；
3. 规则或统计 judge；
4. LLM Critic：用于语义质量和开放式判断。

Critic 是补充，不是唯一裁判。若执行器与 Critic 使用相同上下文、相同模型和相同错误假设，“独立角色”并不等于独立证据。

### 5. Loop Detector：检测等价状态，而不只数重试

“同一步骤重试三次就停”过于粗糙：三次重试可能每次都获得新证据，也可能步骤名称不同但实际在原地打转。

更稳健的方法是记录 transition signature：

```text
signature = hash(
  normalized_goal,
  plan_step_type,
  normalized_tool_call,
  relevant_state_before,
  failure_class,
  relevant_state_after
)
```

然后组合多个探测器：

- `exact_repeat`：相同 signature 重复；
- `semantic_repeat`：不同措辞但工具、参数和结果等价；
- `no_progress_window`：最近 `N` 步没有新增 artifact、证据或已满足条件；
- `oscillation`：状态在 A↔B 之间切换；
- `retry_same_failure`：相同 failure class 重试但策略没有改变；
- `budget_burn_rate`：消耗快速增长而 verifier score 不升。

中断后不应继续写一句“再试一次”，而要转入明确状态：`replan`、`rollback`、`degraded_result`、`human_escalation` 或 `abort`。

### 6. Safe Recovery：checkpoint 不等于万能回滚

内部状态容易回滚，例如 git diff、临时文件、数据库事务和 session state。但邮件发送、审批提交、支付、消息通知等外部行为不能靠恢复旧 checkpoint 撤销。

工具注册时应声明 effect contract：

```yaml
effect: read_only | idempotent_write | compensatable_write | irreversible
idempotency_key: supported
compensation_tool: cancel_approval
requires_confirmation: true
```

恢复策略由 effect 决定：

- `read_only`：可以安全重试；
- `idempotent_write`：复用同一个 idempotency key；
- `compensatable_write`：记录补偿动作和执行结果；
- `irreversible`：执行前确认，执行后禁止自动回放。

### 7. Budget Governor：预算必须由代码执行

至少设置：

- 全局 step、token、wall-clock 和费用上限；
- 每个工具、步骤和 failure class 的局部预算；
- 探索分支数量与深度；
- 最大无进展窗口；
- 低剩余预算时的降级策略。

预算触发由 Harness 代码决定，不能交给模型自行遵守。接近上限时，Agent 应优先收敛：保存 checkpoint、输出已有证据、明确未完成项，而不是继续开新分支。

### 8. Observability：观察“为什么还没完成”

只看最终成功率太晚。建议记录：

| 指标 | 含义 |
|---|---|
| `goal_alignment_score` | 当前步骤与 Goal Contract 的一致程度 |
| `verified_progress_rate` | 通过 verifier 的有效状态增量 / 总步骤 |
| `state_repeat_ratio` | 重复或近似重复状态占比 |
| `retry_by_failure_class` | 每类错误的重试次数 |
| `plan_churn` | 计划版本变更频率及触发证据 |
| `rollback_or_compensation_rate` | 恢复机制触发比例 |
| `budget_burn_per_verified_step` | 每个有效进展消耗的 token、时间或费用 |
| `escalation_precision` | 转人工是否发生在真正需要人工的案例上 |

高 `plan_churn` 不一定坏：新证据驱动的重规划是正常行为。真正危险的是无证据改计划，或者计划不变但状态持续不前进。

## 推荐状态机

```text
INIT
  → PLAN
  → EXECUTE
  → VERIFY
      ├─ pass + goal complete → DONE
      ├─ pass + incomplete → EXECUTE
      ├─ recoverable failure → RETRY_WITH_CHANGED_STRATEGY
      ├─ plan invalidated → REPLAN
      ├─ side effect failure → COMPENSATE_OR_ESCALATE
      ├─ loop / budget limit → CHECKPOINT_AND_ABORT
      └─ out of contract → HUMAN_ESCALATION
```

每个 transition 都需要 reason code 和 evidence。没有 evidence 的 `REPLAN`、没有策略变化的 `RETRY`、没有补偿合同的 `ROLLBACK` 都应被 Harness 拒绝。

## 最低泛化验证合同

视频给出的是工程框架，没有实验数据，因此当前证据状态只能是 **generalized-candidate**。要达到 production-ready，至少验证：

1. **Original repro**：已知跑偏或循环案例能够被检测并安全终止。
2. **Changed-case**：替换实体、工具顺序、错误类型、任务长度和表达方式，机制仍成立。
3. **Negative/adversarial**：
   - 合法的多次重试不会被误判为循环；
   - 高相似动作但状态持续推进时不会被提前中断；
   - 恶意或错误 Critic 无法绕过确定性 verifier；
   - 模型不能自行提高预算或删除不变量。
4. **Out-of-contract**：
   - 不可逆外部动作没有补偿能力时，系统会确认或升级，而不是伪装成可回滚；
   - verifier 不足、目标冲突或权限不足时，系统明确停止并报告边界。

评测单位应是 `model × harness × task distribution × tool/effect contract × budget`，并同时报告成功率、误杀率、成本和恢复正确率。这与 [[claw-swe-bench-harness-evaluation]] 对真实 Harness 评测单元的判断一致。

## 面试时可以这样回答

> 我不会靠 prompt 要求 Agent “别跑偏”，而会把长任务执行设计成受控状态机。首先把用户目标编译成不可随意修改的 Goal Contract，包括完成标准、不变量和预算；计划可以改，但必须有新证据触发并生成版本。每步执行后用 tests、schema、真实工具状态等 verifier 检查产出和状态增量，再用 LLM Critic 补充语义判断。Harness 对 state/action signature 做 loop detection，同时限制同类错误重试、无进展窗口、token、step 和 wall-clock。内部状态用 checkpoint 恢复；外部副作用则靠幂等键、事务或补偿动作，不能假装都可回滚。线上监控 verified progress、state repeat、plan churn 和 budget burn，线下用 changed-case、negative/adversarial、out-of-contract cases 验证，避免只修原始 case。

如果面试官继续追问实现细节，可以落到三个接口：

- `GoalContract`：目标、完成标准、不变量、权限和预算；
- `StepResult`：状态增量、artifact、evidence、failure class 和 verifier result；
- `ToolEffectContract`：只读/幂等/可补偿/不可逆副作用。

这三个结构决定 Harness 能否真正检测跑偏、判断进展和安全恢复。

## 对视频五层框架的客观评价

| 视频观点 | 评价 | 工程修正 |
|---|---|---|
| Planner 锁死主线 | 目标稳定是对的，固定计划过于僵硬 | 锁 Goal Contract，计划版本化并允许证据驱动重规划 |
| Memory 精简上下文 | 必要但不足 | 把状态从 transcript 中分离，固定携带不变量、预算和证据 |
| 独立 Critic 定期校验 | 对开放式语义任务有价值 | 确定性 verifier 优先；周期触发与异常/低置信度触发结合 |
| 重试或超预算后回滚 | 硬中断是必要底线 | 按 tool effect 选择重试、回滚、补偿、升级或终止 |
| 监控中间轨迹 | 非常关键 | 重点监控 verified progress 和重复状态，而不只是计划修改次数 |

## Related

- [[agent-system-architecture]] — Agent Loop、Runtime、Harness、SDK 和 Adapter 的职责边界
- [[agent-harness-durable-compaction-runtime-boundary]] — 长任务上下文压缩、持久化和恢复
- [[harness-as-moat]] — 约束、记忆、验证和纠错的控制论视角
- [[building-self-improving-agents]] — 执行、验证、修正的反馈闭环
- [[claw-swe-bench-harness-evaluation]] — 把 Harness 和预算纳入真实评测单元
- [[skillopt-self-evolving-agent-skills]] — 用独立 validation gate 防止单 case 自我确认
