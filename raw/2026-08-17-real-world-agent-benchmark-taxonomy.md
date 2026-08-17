---
source: https://mp.weixin.qq.com/s/APKrN2aRYo36PWSscczrdg
captured: 2026-08-17
type: article
---

# 真实世界 Agent 测评集分类：来源摘录

Source archive note: 本文件保存来源元数据、测评集名称、可复用事实和评论区覆盖范围，不保存文章全文。

- 标题：说一个反常识的真相，Agent如今在真实工作场景的成功率依然很低。
- 公众号：数字生命卡兹克
- 发布：2026-08-17 08:09 Asia/Shanghai
- 作者署名：卡兹克、tashi
- 原文：https://mp.weixin.qq.com/s/APKrN2aRYo36PWSscczrdg

## 文章中出现的测评集

### 正文明示

- `LiveBench`：作为通用能力分类榜单的例子出现，覆盖 Coding、数学、推理等能力；它不是文章重点讨论的端到端真实工作基准。
- `RealReplicaBench`：阿里国际 Accio 团队构建的商业工作流评测。文章称其包含 107 个任务，覆盖供应商采购、商品发布、店铺经营、订单对账、国际物流、售后争议等电商流程。
- `DeepSWE`：长周期软件工程评测。文章称其包含 113 个任务，统一使用 `mini-swe-agent` 执行。
- `E-Bench`：多步工具调用与产品状态变更评测。文章称其包含 323 个任务，覆盖王者荣耀、QQ音乐和腾讯会议三个模拟产品域，并同时报告多次运行的平均表现和稳定性。
- `VibeLifeBench`：长期生活助理评测。文章称其包含 200 个持续数周的生活任务，覆盖十个领域。

### 配图中出现

- `VibeSearchBench`：出现在“小红书 VibeLifeBench & VibeSearchBench 发布”的配图中；正文没有展开其任务和指标。

## 评论区覆盖范围

2026-08-17 抓取时，文章页评论模块同时显示“暂无留言”“1条留言”“已无更多数据”，但评论列表没有展示任何评论正文；独立 `only_comment=1` 页面也没有呈现可读评论内容。因此本次没有可确认的评论区测评集名称，不能把未显示的那 1 条计数推断成任何具体 benchmark。

文章开头嵌入了一张此前文章评论的截图，内容是在询问“能不能有个测评评价不同模型做不同事情的水平”，但没有出现测评集名称；它属于文章配图，不属于本篇文章当前评论区。

## 主来源核验

- RealReplicaBench code：https://github.com/Accio-org/RealReplicaBench
- DeepSWE code：https://github.com/datacurve-ai/deep-swe
- E-Bench paper：https://arxiv.org/abs/2607.23722
- VibeLifeBench paper：https://arxiv.org/abs/2608.10875
- VibeSearchBench code：https://github.com/VibeBench/VibeSearchBench
- LiveBench code：https://github.com/LiveBench/LiveBench

## 可复用事实与边界

- RealReplicaBench 当前公开仓库说明为 107 个任务，其中 53 个 CLI、28 个 browser、16 个 file、10 个 API/MCP；任务在 fresh container 中运行，并由各自的 deterministic 或 LLM-assisted verifier 评分。
- DeepSWE 当前公开仓库说明为 113 个任务，覆盖 TypeScript、Go、Python、JavaScript、Rust，使用隔离环境和 program-based verifiers；官方榜单由 Pier 驱动 `mini-swe-agent` 产生。
- E-Bench 论文说明为 323 个 fully synthetic、state-changing tasks，以 database-state diff 做确定性评分；论文明确说为防止 benchmark-specific training/overfitting，不开放环境与任务。
- VibeLifeBench 论文说明为 200 个 multi-week tasks、十个生活领域、22 个 mock services；评分读取 Agent 留下的最终状态，并考察时机和隐含约束。论文在抓取时使用“will open-source”的未来时表述。
- VibeSearchBench 当前公开仓库说明为 200 个任务、两个子集、20 个领域；以 persona-driven progressive disclosure 模拟多轮需求澄清，主指标是 Triplet F1，其中节点对齐和三元组语义等价使用 LLM-as-judge。
- LiveBench 以持续更新、客观可验证答案和减少 contamination 为主要设计目标，适合作为通用能力对照，不等价于真实世界端到端 Agent 工作评测。
- 文章中的排行榜数字只是特定时间点、特定 benchmark 版本、模型配置和 harness 的快照。RealReplicaBench 当前仓库的表格已经与文章截图不同，不能把文章数字当成稳定的“模型能力常数”。

## Reusable Takeaways

- 评测分类至少同时记录 `domain × horizon × environment × state change × scoring contract`，不能只按“Coding/非 Coding”二分。
- 实际实验单元应写成 `model × harness × benchmark version × task subset × budget × run count`。
- `Avg@3` 衡量三次运行的平均得分，`Pass^3` 衡量同一任务三次全部成功；二者回答的问题不同。
- 高保真 replica、fully synthetic environment、真实开源仓库和动态 living world 是不同证据层级，分数不能横向直接比较。
- 评论区计数不等于可读评论证据；没有正文时应保留为空，而不是猜测 benchmark 名称。
