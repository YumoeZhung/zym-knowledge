---
title: "2026 RAG 调研：从 Full-doc 争论转向 Query-aware Retrieval"
created: 2026-05-29
last_updated: 2026-07-06
source: "Codex conversation and arXiv papers on 2026 RAG research"
tags: [rag, retrieval, long-context, evaluation, happy-bee]
---

# 2026 RAG 调研：从 Full-doc 争论转向 Query-aware Retrieval

这次调研的核心结论：2026 年的主线不是 "BM25/向量 RAG vs full-doc reader" 二选一，而是 **query-aware retrieval + routed / multi-step retrieval + long-context evidence checking**。

对 `happy-bee-hybrid` 这类合同、制度、流程问答，最危险的误判是把问题简化为"文档只有 29 个，所以直接 full-doc 就该打满"。实际失败显示，全文上下文会带来主合同、解约协议、转让协议、例外条款之间的干扰。更多上下文不等于更可靠的证据。

## 研究脉络

[TREC 2025 RAG Track](https://arxiv.org/abs/2603.09891) 把重点放在复杂叙事查询、事实 grounding、答案完整性、归因验证和透明性。它提醒我们：RAG 质量不只是召回 topK，也包括答案是否能被证据精确归因。

[R3AG](https://arxiv.org/abs/2604.22849) 指出 one-size-fits-all retriever 是瓶颈。不同 query 对 retriever 有不同偏好，而且检索结果不仅要相关，还要能帮助 generator 产出正确答案。这个观点对应 `happy-bee-hybrid` 的问题：有些 query 适合精确 BM25，有些需要语义召回，有些需要多轮上下文改写，有些应直接走上游 intent / transfer。

[Q-RAG](https://arxiv.org/abs/2511.07328) 代表 long-context multi-step retrieval 方向。它说明复杂问题需要多步检索，但这种能力通常需要训练检索器或 embedder，不是简单加一个 agent loop 就能稳定提升。

[Reconstructing Context](https://arxiv.org/abs/2504.19754) 对比 late chunking 和 contextual retrieval。它的启发是：当固定 chunk 切碎上下文时，可以通过上下文化 chunk 或更好的 pooling 方式修复，而不是马上重写整套解析。

## RAPTOR 与 Contextual Chunking 的区别

用户指出 "给每个 chunk 生成上下文说明" 很像 RAPTOR，这个判断对一半。

[RAPTOR](https://arxiv.org/abs/2401.18059) 的目标也是解决 isolated chunk 缺上下文。它递归地 embedding、聚类、摘要 chunks，构造多层 summary tree，查询时从不同抽象层级检索。

但 contextual chunking 和 RAPTOR 的机制不同：

| 方法 | 做什么 | 风险 |
|---|---|---|
| Contextual Retrieval | 给叶子 chunk 加文档上下文说明，仍检索原始 chunk | 离线成本更高 |
| Late Chunking | 先全文编码，再对 chunk pooling，让 embedding 带上下文 | 依赖长上下文 embedding 模型 |
| RAPTOR | 聚类 chunks，递归生成 summary tree | 摘要可能压扁金额、期限、主体、例外 |
| 2026 Tree-RAG 变体 | 动态构树、多粒度查询、减少聚类噪声 | 实现复杂，未必满足低延迟 |

[DTCRS](https://arxiv.org/abs/2604.07012) 认为 recursive summarization 不适合所有问题，应根据问题类型动态决定是否需要 summary tree。[Psi-RAG](https://arxiv.org/abs/2605.00529) 进一步指出已有 Tree-RAG 在跨文档场景有聚类噪声、跨文档隔离、抽象过粗等问题。

对制度 / 合同类 QA，summary tree 不是默认最优。金额、期限、义务主体、例外条件更需要原文级证据，而不是抽象摘要。

## 对 Evidence Package 的修正判断

当前 `happy-bee-hybrid` 的 evidence package 不应继续被称为语义证据层。它目前更接近 chunk merge key：

- 每个 chunk 包一层 metadata。
- structured fields 默认为空。
- knowledge unit 默认是 `source_span`。
- 检索时主要按 `evidence_package_id` 合并 BM25 / vector 命中的 chunk。

因此，先前 evidence package 效果不好，不能否定"语义证据组织"这个方向；但可以否定当前这个实现作为主路线。后续讨论要区分：

- current evidence package：chunk wrapper / merge key。
- semantic evidence unit：真正面向事实、条件、例外、来源 span 的证据单元。

如果不重新定义，就不要继续使用 "evidence package" 这个词，避免概念污染。

## 近期最小实验

在同事尚未交付解析、语义分块和新 embedding 服务前，最小可行实验不是 budgeted multi-step retrieval，而是 **offline contextual retrieval probe**。

实验对象：

- 350 full-doc 官方失败 45 个 case/group。
- 50-case gate 失败中不在 350 失败里的 `HF-010`、`LT-037`。
- 合计 47 个 case/group。

实验变体：

1. 当前 BM25 + 向量 chunk recall。
2. 当前 full-doc selector selected documents。
3. Contextual chunk recall：`doc_context_note + chunk_text`。
4. Contextual chunk + neighbor window：命中 chunk 前后窗口作为小证据。

先不跑完整 350。先看：

- 正确文档是否进入 topK。
- 正确证据窗口是否进入 topK。
- 给定小证据窗口时 reader 是否抽出正确事实。

只有 retrieval / reader probe 明显变好，再跑 50-case gate；50-case 稳定后再跑 350。

## 10 秒首响与 Multi-step

如果企微允许先发一条独立消息安抚用户，那么 10 秒首响不要求完整答案，multi-step retrieval 在产品体验上可行。但这只解决等待体验，不保证准确率。

更合理的线上策略：

- 简单问题走快速召回 + 小证据窗口。
- 低置信、冲突、多轮复杂、缺证据时进入 multi-step branch。
- Full-doc / long-context reader 作为证据确认或 fallback，不作为所有问题默认路径。

这与 [[agent-system-architecture]] 的分层思想一致：不要让一个大模型步骤同时承担路由、召回、证据裁判和最终回答。不同阶段应各自有可观测的输入、输出和失败边界。

## Related

- [[agent-system-architecture]] — Agent 分层与可观测边界
- [[llm-pretrain-data-engineering]] — 数据质量和训练 / 检索效果之间的关系
- [[route-aware-merged-retrieval-rerank]] — Merged retrieval 中保留 route diversity 信号的方法
