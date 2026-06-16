---
title: "Claw-SWE-Bench：把 Harness 作为可测变量的编程 Agent 基准"
created: 2026-06-16
last_updated: 2026-06-16
source: https://mp.weixin.qq.com/s/iCty7MvtQDZzJNhV9nCZIA
tags: [agent, benchmark, coding-agent, cost-analysis, evaluation, harness, open-source]
sources: [raw/2026-06-16-claw-swe-bench-harness-evaluation.md]
---

# Claw-SWE-Bench：把 Harness 作为可测变量的编程 Agent 基准

## 核心观点

编程 Agent 的单一 Pass@1 分数并不能直接说明“模型更强”。真实结果至少由四个变量共同决定：底层模型、harness 设计、任务集分布、运行预算与成本。Claw-SWE-Bench 的价值在于把其中的 harness 变成可控变量，让评测从“谁分数最高”推进到“哪组模型、harness、预算组合在成本和准确率之间更值得采用”。

这补上了 [[harness-as-moat]] 的一个实证维度：如果 harness 能让同一个模型产生双位数的表现差异，那么 harness 不是评测噪声，而是 Agent 系统能力的一部分。

## 为什么 SWE-bench 分数容易误读

SWE-bench 已经是编程 Agent 的事实标准，但公开榜单常把多个因素压缩成一个数字：

| 变量 | 影响 |
|------|------|
| 模型 | 推理、代码理解、补丁生成能力 |
| Harness | prompt、工具接口、agent loop、停止策略、超时、缓存 |
| 任务集 | 语言、仓库、issue 类型、难度分布 |
| 成本预算 | 可用 token、API 价格、运行轮数、缓存命中 |

如果这些变量没有被拆开，同一个 Pass@1 提升可能来自模型升级，也可能来自更强的工具协议、更宽松的预算或更有利的样本选择。对研发团队来说，这会把 benchmark 从决策工具变成营销数字。

## Adapter 是评测接口，不只是胶水代码

OpenClaw 这类通用 Agent 不一定天然输出 SWE-bench 需要的 `model_patch`。它可能会调用工具、编辑文件、输出自然语言、保留会话状态，甚至产生缓存和元数据。Claw-SWE-Bench 用 adapter 把通用 Agent 的执行过程转换成可评分的补丁：

1. Agent 在标准 Docker 工作区内真实修改仓库文件。
2. Runner 从 Git 状态导出最终 patch。
3. 评测器只接收干净补丁和测试结果。
4. 外层统一 prompt、任务集、超时和成本记录。

这个设计说明：评测接口本身会释放或压制能力。让 Agent 手写 diff，与让 Agent 像工程师一样编辑工作区再由 Git 生成 patch，是两种完全不同的能力测量方式。

这也对应 [[agent-system-architecture]] 的分层观点：评测 adapter 属于 Agent Runtime / Harness 边界层，负责把系统行为投影成可验证产物。

## Claw-SWE-Bench 的结构

- Full-350：350 个真实 GitHub issue 修复任务，覆盖 8 种编程语言和 43 个仓库。
- Lite-80：每种语言 10 个任务，总计 80 个，用于低成本日常迭代。
- 任务来源：300 个非 Python 多语言实例来自 SWE-bench-Multilingual，另有 50 个 Python 实例来自 SWE-bench-Verified-Mini。
- 公平性约束：统一 prompt 模板、Docker 环境、任务集、3600 秒超时预算和成本记录。

Lite-80 的意义不是替代完整评测，而是提供一个校准过的快速反馈面。它让开源团队和小团队可以更频繁地调整 prompt、adapter、模型和工具配置，再用 Full-350 验证正式结论。

## 数据泄露修复也是 benchmark 质量的一部分

构建多语言任务集时，研究团队发现部分容器中 base commit 之后的 Git 历史仍然可见。Agent 如果能通过 `git log` 或 `git show` 看到未来修复，分数就会被污染。

Claw-SWE-Bench 将清理 post-base-commit 历史纳入标准流程，并向上游 SWE-bench-Multilingual 反馈。这一点很关键：软件修复 benchmark 的可信度不只取决于测试用例，也取决于仓库状态是否真的隔离了答案。

## 两类横扫实验

### 固定 Harness，比较模型

在 OpenClaw harness 不变时，模型差异仍然显著。文章引用的实验中，最高和最低模型之间的 Pass@1 差距接近 30 个百分点。

更重要的是成本：相近的解决率可能对应完全不同的 API 花费。只看 Pass@1 会隐藏“能否高频迭代”的现实约束。

### 固定模型，比较 Harness

在同一模型下切换 OpenClaw、Hermes-agent、ZeroClaw、GenericAgent、Nanobot 等 harness，也会产生双位数差距。对较弱或更便宜的模型，harness 差异甚至更大。

这支持一个实践判断：当模型固定时，prompt、工具接口、agent loop、停止策略、补丁导出和工作区清理都可能成为主要改进杠杆。

## 实践启示

1. **报告实验单元，而不是只报分数**：至少记录模型、harness、prompt、任务集、预算、token、缓存和总成本。
2. **把成本放进 Pareto 前沿**：研发不是一次冲榜，而是在预算约束下持续试错。
3. **重视 adapter 设计**：差的接口会把 Agent 能力误判为补丁格式失败或环境污染。
4. **用小集做快迭代，用全集做定论**：Lite benchmark 适合回归和调参，完整 benchmark 才适合对外声明。
5. **防止 benchmark 泄露**：清理 Git 历史、隐藏未来提交、隔离缓存和元数据，是编程 Agent 评测的基础卫生。

## Related

- [[harness-as-moat]] — Harness 是否构成壁垒，需要看它能否改变迭代速度和真实能力释放
- [[agent-system-architecture]] — Adapter/Harness 是 Agent 系统边界层的一部分
- [[browser-harness]] — Harness 可以通过工具接口和自愈机制改变 Agent 行为
- [[rag-retrieval-2026-lessons]] — 同样强调评测不能只看单一指标，要看 grounding、透明性和失败边界
