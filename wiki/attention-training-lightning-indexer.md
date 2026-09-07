---
title: Attention 新结构怎么训练：Lightning Indexer、CSA、HCA 与 KDA
created: 2026-09-07
last_updated: 2026-09-07
tags: [llm, transformer, attention, long-context, sparse-attention, distillation, deepseek, glm]
sources: [raw/2026-09-07-attention-training-lightning-indexer-csa-hca-kda.md]
---

# Attention 新结构怎么训练：Lightning Indexer、CSA、HCA 与 KDA

## 核心结论

理解现代 Attention 架构的训练，可以先把模块分成两类：[^1]

1. **连续、可微模块**：如 CSA/HCA compressor、KDA recurrent state update，可以主要靠标准 next-token prediction loss 端到端学习。
2. **包含离散选择 / routing 的模块**：如 Lightning Indexer + Top-K，容易遇到 cold start、离散选择与 credit assignment 问题，因此通常需要额外的蒸馏、辅助 loss 和 staged warm-up。

Lightning Indexer 最关键的训练思想是：**不需要人工标注“该看哪些历史位置”，而是让同层 Dense Attention 当 teacher，Indexer 学着模仿 Dense Attention 的读取分布。**[^1]

## Lightning Indexer：先学会“去哪里找”

Indexer 可以类比为 Attention 内部的轻量 learned retriever：[^1]

```text
当前层 hidden state h_t^(l)
        ↓
轻量投影
        ↓
Indexer Query q_t^I
        │
        │ 与历史 Indexer Key 点积
        ↓
relevance score
        ↓
Top-K
        ↓
Core Attention 真正读取这些位置
```

它和 RAG 中“先召回、再精读”的工作流很像，但它是 Transformer Attention 层内部的 routing 机制，而不是外部检索系统。[^1]

## Dense Attention 为什么能当 Teacher

标准 Dense Attention 原本就会产生当前 query 对所有历史位置的 attention distribution。对于第 `l` 层，可以把它记为：[^1]

```text
P_teacher^(l)(t, s)
```

Indexer 根据同层 hidden state 产生自己的 score，并归一化成：

```text
P_indexer^(l)(t, s)
```

然后通过 KL divergence 对齐：

```text
L_indexer = KL(P_teacher || P_indexer)
```

所以 Indexer 学到的不是“最终答案是什么”，而是：

> **如果这一层仍然跑完整 Dense Attention，这一层本来会看哪里？**[^1]

这可以理解为 attention distillation / self-distillation。

## 为什么不能一开始就直接 Top-K Sparse

随机初始化的 Indexer 一开始没有可靠的 relevance 判断。如果直接做 Top-K：[^1]

```text
Indexer 随机打分
    ↓
Top-K 选错位置
    ↓
关键历史信息不可见
    ↓
主 Attention 学习信号变差
```

而且 Top-K 是离散操作：score 的微小变化可能让候选集合突然改变。因此不能简单期待最终语言模型 loss 自动把一个随机 router 平滑训练好。[^1]

更稳定的办法是 staged training：

```text
Dense Attention
    ↓
Indexer warm-up：模仿 Dense Attention
    ↓
Indexer 已具备基本检索能力
    ↓
切换 Top-K sparse selection
    ↓
主模型继续训练，适应稀疏连接
```

DeepSeek V3.2 的 DSA 明确体现了 Dense warm-up → Sparse training 的训练逻辑；V4 CSA 延续了同类的 Lightning Indexer + Top-K 路线，只是它进一步在 compressed KV entries 上做 sparse selection。[^1]

## 两种 Loss 各自负责什么

### 1. Indexer Loss：学会“找谁”

```text
L_indexer
≈ 学会“去哪里找”
```

它主要来自 Dense Attention teacher 的 relevance distribution。[^1]

### 2. Language-model Loss：学会“怎么用这些信息”

```text
L_LM = next-token prediction loss
```

Sparse Attention 打开后，主 Transformer 继续通过 `L_LM` 学习：[^1]

> 在只有 Top-K 历史位置可见的情况下，怎样继续做好语言建模。

因此可以把两条训练信号理解为：

```text
Indexer loss → routing
LM loss      → model capability
```

## CSA Compressor 怎么训练

CSA 同时做两件事：[^1]

1. 先沿序列维度压缩历史 KV；
2. 再通过 Lightning Indexer 在 compressed entries 中做 Top-K sparse selection。

```text
若干原始 token
      ↓
learned compressor
      ↓
compressed KV entry
      ↓
Lightning Indexer
      ↓
Top-K
      ↓
Core Attention
```

Compressor 本身由连续可微参数构成，所以通常不需要人为提供“正确压缩结果”。它直接通过最终语言模型 loss 反向传播学习：[^1]

```text
LM loss
  ↓
Attention output
  ↓
compressed KV
  ↓
compression parameters
```

可以直接记：

```text
CSA compressor：LM loss 端到端训练
CSA Indexer：Dense Attention distillation + routing-specific loss
```

## HCA 怎么训练

HCA 也是压缩长历史，但它通常把历史压成更短的 compressed sequence，然后对这个短序列做 Dense Attention。[^1]

因为没有和 CSA 一样的 Top-K routing 问题，核心 compressor 和 Attention 参数可以直接通过标准 next-token prediction loss 训练：

```text
长历史
  ↓
heavy compression
  ↓
compressed sequence
  ↓
Dense Attention
  ↓
LM loss
```

所以 HCA 属于更典型的“连续、可微、端到端训练”模块。[^1]

## KDA 怎么训练

KDA 属于 recurrent / linear-attention 路线。它不是保留完整历史 KV 序列，而是不断维护 recurrent state：[^1]

```text
S_t = f(S_(t-1), K_t, V_t)
O_t = g(Q_t, S_t)
```

其中 projection、gate、delta update、state update 等都是可微计算，所以不需要人工标注“state 中应该记什么”。[^1]

```text
历史 token
   ↓
state update
   ↓
S_t
   ↓
KDA output
   ↓
后续 Transformer
   ↓
next-token prediction
   ↓
LM loss
```

因此 KDA 的历史状态是通过语言建模目标逐步形成的 emergent representation。[^1]

## 一个统一判断框架：模块可不可微？

以后看到新的 Attention 结构，可以先问：[^1]

### A. 它是不是连续、可微？

例如：

- Q/K/V projection
- CSA compressor
- HCA compressor
- KDA state update
- MLP
- residual mixing

这类模块通常可以：

```text
Next-token prediction loss
        ↓
     Backprop
```

### B. 它是不是包含离散选择 / routing？

例如：

- Lightning Indexer + Top-K
- Sparse selector
- 某些 router / retrieval module

这类模块容易出现：

- cold start
- 离散选择不平滑
- credit assignment 困难

因此经常需要：

- auxiliary loss
- distillation
- warm-up
- staged training
- 其他 routing-specific objective

## 不同层的 Hidden State 会不会影响 Indexer

会，而且这是设计的一部分。[^1]

同一个 token 在不同层有不同 hidden state：

```text
h_t^(0) → h_t^(1) → ... → h_t^(L)
```

浅层表示可能更偏 lexical / local / syntactic；中深层逐渐形成 entity / semantic / reasoning-level features。因此不同层的 Indexer query 也会随着层深变化。[^1]

但这里最重要的是：

> **第 `l` 层 Indexer 不需要提前知道最终答案，只需要模仿第 `l` 层 Dense Attention 的读取模式。**[^1]

```text
第 l 层 h_t^(l)
   ├──→ Dense Attention teacher → 同层 importance distribution
   └──→ Lightning Indexer       → predicted distribution
                                   ↑
                                  KL
```

所以浅层即使还不能直接预测“北京”，仍然可以正确关注“中国”“首都”、局部句法或实体关系，为后续层继续加工提供原材料。[^1]

## Logit Lens 与 Indexer 在问不同的问题

Logit Lens 常见分析方式是：[^1]

```text
h_t^(l) → W_U → logits
```

它问的是：

> **这一层的表示离最终 vocabulary prediction 有多近？**

Indexer 问的是：

> **基于这一层目前已经知道的东西，下一步应该读哪些历史位置？**[^1]

因此可以记成：

```text
Logit Lens：这一层离“答案”多近？
Indexer：这一层下一步“看哪里”？
```

这两个问题不能等价。

## 多层 Sparse Attention 可以看成“迭代检索”

一个有用的直觉是：深层 Transformer 会随着 residual stream 不断丰富，逐层形成更好的 retrieval query。[^1]

```text
Layer 3:
已有信息 A
→ 找到 B

Layer 8:
已有 A+B
→ 形成更成熟 query
→ 找到 C

Layer 15:
已有 A+B+C
→ 找到关键远程证据 D

Layer L:
综合表示
→ 最终 token prediction
```

因此，后层的 Indexer query 本身就是由前层 Attention / MLP 已写入 residual stream 的信息逐渐塑造出来的。[^1]

## 面试级记忆

可以直接记住：

> **Lightning Indexer 的难点不是“怎么点积”，而是 sparse routing 怎么稳定学出来。典型做法是用同层 Dense Attention 当 teacher，通过 KL 蒸馏先让 Indexer 学会“该看哪里”，再切换到 Top-K sparse attention；主模型继续用 next-token loss 适应稀疏连接。CSA/HCA compressor 与 KDA recurrent state 都是连续可微模块，主要靠 LM loss 端到端学习。浅层 Indexer 不需要提前知道最终答案，只需要完成当前层的信息读取职责。**[^1]

## Related

- [[attention-mechanism-composition]]
- [[llm-pretrain-data-engineering]]

[^1]: [[../raw/2026-09-07-attention-training-lightning-indexer-csa-hca-kda|2026-09-07 对话：Lightning Indexer、CSA/HCA/KDA 的训练方式]]
