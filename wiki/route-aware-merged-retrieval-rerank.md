---
title: Route-aware Merged Retrieval Rerank
created: 2026-07-06
last_updated: 2026-07-06
source: "raw/2026-07-06-route-aware-merged-rerank.md"
tags: [rag, retrieval, rerank, evaluation, agent]
---

# Route-aware Merged Retrieval Rerank

Route-aware merged retrieval 是一个折中方案：保留 Merged 的单次合并检索和单次 rerank 成本，同时补回 Batch 路径里隐含的 route diversity 信号。

它适用于这种场景：Agent 会生成 3-4 个 route query，Batch 路径的准确率可能来自多路召回和多次 rerank，但 Batch 的后端并发压力、timeout 后 child task 拖尾、rerank 调用成本都不可接受。

## 核心判断

不要把问题理解成“Batch vs Merged 谁天然更准”。更准确的分解是：

- Batch 的优势：每一路 query 都有机会独立把自己的 top candidates 推进 rerank / final context。
- Batch 的代价：多路 retrieval、embedding、Milvus、rerank 和 timeout tail risk。
- 原始 Merged 的风险：合并后如果只 rerank 最终 `topK=25`，会过早丢掉多 route 共同支持但单路 raw score 不够高的 chunk。

因此，优化方向不是回到 Batch，而是让 Merged 显式建模 route evidence。

## 方法

第一步，每个 route 仍然保持足够大的 recall candidate pool。例如生产形态可以继续让每路 `candidateCount=300`。Merged 不应该为了省成本在 recall 阶段过早砍候选，否则后面的 rerank 和 boost 没有机会救回正确 chunk。

第二步，按 chunk id 合并去重，同时把 route 证据写成 metadata：

- `retrieval_routes`
- `retrieval_route_count`
- `retrieval_raw_rank_by_route`
- `retrieval_raw_score_by_route`
- `retrieval_best_raw_rank`
- `retrieval_best_raw_score`

第三步，rerank 做 bounded overfetch。Agent 最终可能只需要 `topK=25`，但内部可以让 rerank 返回更多候选，例如最多 45 个。这样 rank 26-45 的候选仍然有机会被 route evidence 推进最终 top25。

第四步，在 rerank score 之后加一个有上限的 route boost：

```text
routeCoverageBoost = min(0.12, max(0, routeCount - 1) * 0.04)
rankBoost = max(0, (targetTopK + 1 - min(bestRank, targetTopK)) / targetTopK) * 0.08
finalScore = rerankScore + routeCoverageBoost + rankBoost
```

这个 boost 必须是 bounded signal，而不是替代 rerank 的主排序逻辑。它只表达两个直觉：

- 同一个 chunk 被多条 route query 独立召回，说明它更可能是稳定证据。
- 如果它在任一路 raw recall 中排名靠前，说明它不是纯粹靠合并噪声进入候选池。

第五步，最终仍然截断回 Agent 需要的 topK，不把 overfetch 数量直接暴露给 Agent。overfetch 是 rerank / fusion 的内部机制，不是扩大 Agent 上下文窗口。

## 评估口径

只看 raw retrieval top25 容易误判。更合理的指标是：

- final-context topK 是否包含 ground-truth chunk。
- ground-truth chunk 的 rank 分布是否前移。
- Agent 最终回答是否引用正确证据。
- latency p50/p95/p99 是否仍满足并发目标。
- Merged 是否仍保持单次 rerank，而不是退化回 Batch 的 3-4 次 rerank。

20-case 命中提升只能证明这是 `generalized-candidate`，不能证明 `production-ready`。生产前仍需要更大 case set、负例、out-of-contract 输入和回滚开关。

## 工程约束

- 不要用 case id、固定产品名、固定业务文本或 golden output 做生产逻辑。
- boost 常量应可配置，并保留快速关闭开关，例如 `route-score-boost-enabled=false`。
- rank boost 应绑定实际 `targetTopK`，不要写死 25/26。
- metadata 要保留 route 证据，方便后续观察哪些 route 对最终上下文有贡献。

## Related

- [[rag-retrieval-2026-lessons]] — RAG 评估不能只看 raw topK，还要看 grounding 和 final answer
- [[agent-system-architecture]] — 检索、证据选择、回答生成应有清晰边界
