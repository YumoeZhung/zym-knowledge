---
source: "Codex conversation on happy-bee-hybrid retrieval architecture; sources include arXiv papers listed below"
captured: 2026-05-29
type: note
---

# 2026 RAG / Long-Context Retrieval 调研启发

## 背景

围绕 `happy-bee-hybrid` 的检索架构讨论：

- 当前 full-doc reader 在 50-case 和 350-case 上没有稳定超过旧向量召回链路。
- 现有 evidence package 基本是 chunk wrapper / merge key，不是语义证据包。
- 用户同事正在优化解析、语义分块和统一图文 embedding，但尚未交付。
- 当前要判断是否应该立即做 budgeted multi-step retrieval，还是先做离线增强索引实验。

## 调研来源

- TREC 2025 RAG Track overview: https://arxiv.org/abs/2603.09891
- R3AG: Retriever Routing for Retrieval-Augmented Generation: https://arxiv.org/abs/2604.22849
- DTCRS: Dynamic Tree Construction for Recursive Summarization: https://arxiv.org/abs/2604.07012
- Hierarchical Abstract Tree for Cross-Document RAG / Psi-RAG: https://arxiv.org/abs/2605.00529
- Q-RAG: Long Context Multi-step Retrieval via Value-based Embedder Training: https://arxiv.org/abs/2511.07328
- Reconstructing Context: Evaluating Advanced Chunking Strategies for RAG: https://arxiv.org/abs/2504.19754
- RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval: https://arxiv.org/abs/2401.18059

## 核心观察

2026 的方向不是简单的 "classic RAG vs full-doc" 二选一，而是：

- Query-aware retrieval
- Retriever routing
- Multi-step retrieval
- Long-context evidence checking
- Attribution-rich / grounded answers

TREC 2025 RAG Track 强调长叙事查询、透明性、事实 grounding、归因验证和答案完整性。R3AG 指出 one-size-fits-all retriever 是瓶颈，需要按 query 同时考虑 retrieval quality 和 generation utility。Q-RAG 说明复杂问题可能需要 multi-step retrieval，但它依赖训练 retrieval/embedder 能力，不是简单上线一个 agent loop。

RAPTOR 和 contextual chunking 目标相近，都是解决 isolated chunks 缺上下文的问题，但机制不同：

- Contextual retrieval / contextual chunking enriches leaf chunks.
- RAPTOR recursively embeds, clusters, and summarizes chunks into a tree.
- DTCRS and Psi-RAG are newer tree-RAG variants that explicitly address RAPTOR-like methods' redundancy, clustering noise, question-type mismatch, cross-document isolation, and coarse abstraction.

对合同、制度、金额、期限、主体、例外类问答，RAPTOR-style summary nodes 有压扁细节的风险，不能默认优于 contextual chunk/window。

## 对 happy-bee-hybrid 的判断

当前 evidence package 不应继续被当成关键方案。代码层面它主要是：

- 每个 chunk 包一层 metadata。
- 默认 structured fields 为空。
- knowledge unit 默认是 source_span。
- 检索时主要用 evidence_package_id 合并 BM25 / vector chunk 结果。

因此先前 evidence package 效果不好，并不能否定语义证据组织本身；但它可以说明当前 evidence package 版本不值得继续作为主路线。

更合适的近期实验是离线增强索引，而不是立刻做线上 budgeted multi-step retrieval：

1. 保留现有原始 chunk，不重复同事的解析 / 语义分块 / embedding 工作。
2. 离线生成 contextual chunk 变体，例如 `doc_context_note + chunk_text`。
3. 增加 neighbor window 变体，例如命中 chunk 前后片段拼成小证据窗口。
4. 用 350 full-doc 官方失败 45 个 case/group，加上 50-case gate 失败中不在 350 失败里的 `HF-010`、`LT-037`，形成 47 个 case/group 的 probe set。
5. 先测 retrieval / reader 分层指标：
   - 正确文档是否进入 topK。
   - 正确证据窗口是否进入 topK。
   - 给定证据窗口时 reader 是否抽取正确事实。
6. 只有 contextual retrieval probe 明显改善，再跑 50-case gate；50-case 稳定后再跑 350。

## 10 秒首响

如果 "10 秒首响" 允许先发一条企微消息安抚用户，而不是 10 秒内输出完整答案，则 multi-step retrieval 在产品体验上可行。

但 multi-step retrieval 不应成为所有问题默认路径。更合理的是：

- 简单问题走快速召回 + 小证据窗口。
- 低置信、冲突、多轮复杂、缺证据时进入 multi-step branch。
- 企微 staged reply 只解决等待体验，不保证最终答案质量。

当前 repo 中 WeCom staged reply 已有开关 `WECOM_STAGED_REPLY_ENABLED`，默认 false。full-doc staged reply 更多是 debug/metrics，不等于真实企微分阶段发送。

## 默认后续建议

- 不再继续小步调 full-doc selector/reader/final prompt 作为主路线。
- 不复用当前 evidence package 作为"语义证据包"概念。
- 优先做 47-case offline contextual retrieval probe。
- full-doc / long-context reader 应作为证据确认或低置信 fallback，而不是所有问题默认主路径。
