---
source: "Codex conversation on Jollibee KB merged retrieval optimization"
captured: 2026-07-06
type: note
title: Route-aware Merged Retrieval Rerank
---

# Route-aware Merged Retrieval Rerank

背景：Jollibee KB retrieval 中，Batch 路径会把多个 route query 拆成多路检索与多次 rerank，准确率可能受益于 route diversity，但并发成本和 parent timeout 后 child task 拖尾风险较高。Merged 路径把多路 query 合并成单次 retrieval 语义，压测更友好，但如果只做一次 topK=25 rerank，容易过早丢掉只有在多 route 证据下才应该进入最终上下文的 chunk。

方法：

1. 每个 route 仍然各自召回足够大的候选池，例如每路 `candidateCount=300`。
2. 对候选按 chunk id 去重，同时记录 route evidence：
   - `retrieval_routes`
   - `retrieval_route_count`
   - `retrieval_raw_rank_by_route`
   - `retrieval_raw_score_by_route`
   - `retrieval_best_raw_rank`
3. 合并后不要只 rerank 最终 topK，而是做 bounded overfetch，例如 Agent 最终需要 `topK=25`，内部 rerank 最多取 45 个候选。
4. 对 rerank 后的 overfetch 候选做轻量 route boost：
   - 多 route 命中的 chunk 得到 coverage boost。
   - 任一路 raw recall 排名靠前的 chunk 得到 rank boost。
   - boost 要有上限，避免覆盖 rerank 主信号。
5. 最终仍截断回 Agent 需要的 topK，不把更多 chunk 直接塞给 Agent。

示例公式：

```text
routeCoverageBoost = min(0.12, max(0, routeCount - 1) * 0.04)
rankBoost = max(0, (targetTopK + 1 - min(bestRank, targetTopK)) / targetTopK) * 0.08
finalScore = rerankScore + routeCoverageBoost + rankBoost
```

关键 insight：收益不是“Merged 天然比 Batch 准”，而是 Merged 需要保留 Batch 曾经隐含提供的 route diversity 信号。Overfetch 让 rank 26-45 的候选进入后处理阶段，route boost 再把多 route 共同支持的 chunk 推进最终 topK。

验证口径：不能只看 raw retrieval topK。对 Agent 问答链路，应同时看 final-context topK 命中、ground-truth rank 分布、最终回答是否引用正确证据，以及延迟和并发成本。20-case 命中提升只能说明 generalized candidate，不能单独证明 production-ready。
