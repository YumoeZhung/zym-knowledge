---
title: "真实世界 Agent 测评集分类：从通用能力到长期工作闭环"
created: 2026-08-17
last_updated: 2026-08-17
source: https://mp.weixin.qq.com/s/APKrN2aRYo36PWSscczrdg
tags: [agent, benchmark, evaluation, harness, long-horizon, real-world-agent, tool-use]
sources: [raw/2026-08-17-real-world-agent-benchmark-taxonomy.md]
---

# 真实世界 Agent 测评集分类：从通用能力到长期工作闭环

## 核心结论

“模型会不会做题”和“Agent 能不能把真实工作做完”是两种不同测量。通用能力榜单通常测单题正确性；真实世界 Agent 评测还必须测工具编排、环境状态修改、长周期一致性、主动发现变化，以及最终产物是否满足业务约束。

最关键的不是再做一张混合排行榜，而是先把评测对象拆清楚：

`domain × horizon × environment fidelity × state-change contract × scoring contract × harness`

同一个模型在不同 harness、预算、任务版本和运行次数下会得到不同分数。因此，分数属于完整实验系统，而不是模型名称本身。这与 [[claw-swe-bench-harness-evaluation]] 和 [[long-horizon-agent-drift-loop-control]] 的结论一致。

## 来源覆盖范围

本页整理原文正文与配图中可确认的六个测评集：`LiveBench`、`RealReplicaBench`、`DeepSWE`、`E-Bench`、`VibeLifeBench`、`VibeSearchBench`。其中 `VibeSearchBench` 只出现在文章配图中。

抓取时评论区没有展示任何评论正文，因此没有新增“评论区来源”的测评集。页面虽显示“1条留言”计数，但同时显示“暂无留言”和空列表；没有正文就不能推断名称。

## 分类总表

| 测评集 | 一级类别 | 核心任务形态 | 环境与周期 | 主要评分契约 | 当前可用性 |
|---|---|---|---|---|---|
| `LiveBench` | 通用模型能力对照 | 数学、Coding、推理、语言、指令遵循、数据分析等客观题 | 以题目为中心，持续更新以降低 contamination | 可验证的 objective ground truth，不依赖 LLM judge | 代码与数据公开；适合做通用能力 control，不等同于端到端工作评测 |
| `DeepSWE` | 软件工程 Agent | 在真实开源仓库中完成跨文件、长周期工程改动 | 113 个任务，隔离工作区与 verifier 环境 | program-based verifiers；官方榜单统一由 Pier 驱动 `mini-swe-agent` | 代码与任务公开，可本地抽样或全量运行 |
| `RealReplicaBench` | 商业／电商工作 Agent | 采购、商品发布、店铺、对账、物流、售后等完整工作流 | 107 个任务；CLI、browser、file、API/MCP；高保真本地 replica 和 fresh container | 每任务独立 verifier，包含 deterministic 与 LLM-assisted 两类 | 代码与任务公开；官方 raw task-level result bundles 尚无公开 immutable URL/checksum |
| `E-Bench` | 多步工具调用与状态变更 | 查找隐藏信息、组合工具调用、精确修改产品状态 | 323 个 fully synthetic tasks；王者荣耀、QQ音乐、腾讯会议三个产品域 | database-state diff；同时看 `Avg@3` 和 `Pass^3` | 论文明确暂不开放环境和任务，当前不适合作为可直接落地的本地回归集 |
| `VibeLifeBench` | 长周期生活 Agent | 职业、健身、租房、购物、差旅等持续数周的生活事务 | 200 个任务、十个领域、22 个 mock services；world 自行推进且包含 silent changes | stage-aware weighted checks：最终状态、行动时机、隐含约束 | 论文抓取时承诺未来开源；应先确认实际 release 再纳入 CI |
| `VibeSearchBench` | 主动式研究／搜索 Agent | 模糊需求、多轮澄清、渐进披露、专业研究与生活搜索 | 200 个任务、两个子集、20 个领域；persona-driven user simulator | Triplet F1；知识图谱节点对齐和语义等价使用 LLM-as-judge | 代码与数据公开，可运行，但 judge 模型和 prompt 必须版本化 |

## 按“真实工作程度”分层

### 1. 通用能力 control：LiveBench

`LiveBench` 的价值是提供持续更新、客观评分、降低污染的通用能力对照。它可以回答“模型基础推理、数学、Coding 等能力如何”，但不能单独回答“Agent 能否在多个工具和状态系统中把业务闭环做完”。

因此，在企业 Agent 评测中它更适合作为 control，而不是主验收集。

### 2. 单一专业域的长周期执行：DeepSWE

`DeepSWE` 把对象收窄到软件工程：Agent 必须读仓库、跨文件修改、运行验证器并交付可执行结果。它比普通 Coding 题更接近真实工程，但仍然是专业域内的工作闭环。

它特别适合测：

- workspace 探索和依赖定位；
- 跨文件修改的一致性；
- 测试驱动的恢复与停止策略；
- 在固定 harness 下比较模型，或固定模型比较 harness。

### 3. 跨工具商业工作流：RealReplicaBench

`RealReplicaBench` 更接近企业任务平台：同一道题可能同时涉及邮箱、日历、浏览器、CLI、文档、表格、API/MCP 和业务系统状态。任务不是生成一段“看起来正确”的文字，而是把多个系统留在正确的最终状态。

它的主要价值是暴露组合失败：单个 tool call 都成功，但漏掉一个标签、会议日期、附件、结构化字段或最终提交，整项业务仍然失败。

需要注意，仓库把 verifier 描述为 deterministic 或 LLM-assisted，不能把某一道题“23 组检查全部通过才得分”的规则推广成所有任务都完全相同。

### 4. 可控的状态变更可靠性：E-Bench

`E-Bench` 用 fully synthetic product environments 换取可控性和 deterministic database-state diff。它主要测 Agent 是否能：

1. 发现信息缺口；
2. 选择并组合多个工具；
3. 在 partial observability 下获取必要状态；
4. 精确提交增删改，避免多改或漏改。

`Avg@3` 与 `Pass^3` 必须分开理解：前者是三次运行的平均表现，后者要求同一任务三次全部成功，更接近生产稳定性。

### 5. 动态世界中的长期自主性：VibeLifeBench

`VibeLifeBench` 不把任务看作一次 prompt，而是看作一个带时钟的 world。价格、库存、天气、航班或健康信息可能在无人提醒时变化；Agent 必须主动复查、及时行动，并在不该打扰用户时保持沉默。

它测的是三个普通 tool-use benchmark 很少同时覆盖的性质：

- proactive：何时主动做、问或不做；
- living world adaptation：环境自行变化后能否重新感知并传播到计划；
- long-horizon coherence：数周内持续维护约束和承诺。

### 6. 模糊需求下的主动研究：VibeSearchBench

`VibeSearchBench` 测的不是“给定完整 query 后搜到答案”，而是 Agent 与 persona 模拟用户多轮收敛需求。专业研究和日常搜索各 100 题，目标答案表示为 knowledge graph。

它适合测澄清、检索、证据合并和长期研究轨迹；但 Triplet F1 中包含 LLM-as-judge 的节点对齐与语义等价判断，因此 judge model、judge prompt、采样参数和重试策略都属于评分契约，必须一起版本化。

## 为什么这些分数不能横向比较

| 差异 | 直接比较会造成的误读 |
|---|---|
| 任务分布不同 | 60% 的电商闭环不等于 60% 的软件工程或生活任务 |
| 环境不同 | 真实仓库、高保真 replica、fully synthetic product、living world 的失败面不同 |
| 评分不同 | program verifier、DB diff、weighted checks、LLM judge 的误差结构不同 |
| Harness 不同 | prompt、工具 schema、并发、上下文管理、停止策略和预算都会改变结果 |
| 重复运行定义不同 | `pass@1`、`Avg@3`、`Pass^3` 分别测单次、平均和稳定成功 |
| 版本与开放程度不同 | 动态榜单会更新；有的任务公开，有的只发表论文，污染风险和可复现性不同 |

文章给出的分数应只作为发布时快照。抓取当天，RealReplicaBench 当前仓库表格已经与文章截图存在差异，这恰好说明 leaderboard 数字必须绑定 `benchmark version + harness + config + timestamp`。

## 给 Agent Harness 的落地选型

如果目标是建设企业级 Harness，不应选择一个 benchmark 包打天下，而应建立分层评测组合：

1. `LiveBench`：基础模型能力 control，避免把所有失败都归因于 harness。
2. `DeepSWE`：验证 workspace 操作、跨文件修改、测试闭环和执行恢复。
3. `RealReplicaBench`：验证跨工具业务工作流、最终状态和多产物一致性。
4. `E-Bench` 风格自建集：验证精确状态变更和 `Pass^k` 稳定性；由于原集未开放，不能假装已接入。
5. `VibeLifeBench` 风格时间线：验证主动性、silent change 感知和长期记忆；正式接入前先确认 release 状态。
6. `VibeSearchBench`：验证模糊需求澄清、长程 research 和证据结构化。

统一记录以下字段：

- `benchmark_name`、`benchmark_version`、`task_id`、`task_subset`；
- `model`、`provider`、`harness`、`prompt_digest`、`tool_schema_digest`；
- `token_budget`、`time_budget`、`max_steps`、`run_count`；
- `judge_model`、`judge_prompt_digest`、`verifier_version`；
- `success`、`partial_checks`、`latency`、`cost`、`failure_category`；
- 轨迹、最终状态、产物、日志和环境镜像 lineage。

## Primary Sources

- Article: https://mp.weixin.qq.com/s/APKrN2aRYo36PWSscczrdg
- RealReplicaBench: https://github.com/Accio-org/RealReplicaBench
- DeepSWE: https://github.com/datacurve-ai/deep-swe
- E-Bench: https://arxiv.org/abs/2607.23722
- VibeLifeBench: https://arxiv.org/abs/2608.10875
- VibeSearchBench: https://github.com/VibeBench/VibeSearchBench
- LiveBench: https://github.com/LiveBench/LiveBench

## Related

- [[claw-swe-bench-harness-evaluation]] — 把 `model × harness × task set × budget` 作为完整实验单元
- [[long-horizon-agent-drift-loop-control]] — 长任务需要过程状态、恢复策略和闭环指标
- [[building-self-improving-agents]] — 评测应进入持续改进闭环，而不是停留在一次榜单快照
- [[harness-as-moat]] — Harness 的未来价值来自可复现地释放模型能力
