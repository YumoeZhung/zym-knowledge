---
title: Attention 机制的组合维度：GQA、MLA、DSA、CSA 与 KDA
created: 2026-09-07
last_updated: 2026-09-07
tags: [llm, transformer, attention, gqa, mla, dsa, csa, kda]
sources: [raw/2026-09-07-attention-composition-gqa-mla-dsa-csa-kda.md]
---

# Attention 机制的组合维度：GQA、MLA、DSA、CSA 与 KDA

## 核心结论

虽然 GQA、MLA、DSA、CSA、KDA 的名字都含有 `Attention`，但它们**并不必然属于同一层级、彼此互斥的 Attention 类型**。更准确的理解方式，是把一个 Attention 层拆成若干可以分别设计的维度。[^1]

一个实用的抽象是：

```text
Attention architecture
≈ Memory Representation
+ Selection / Routing
+ Head / KV Organization
+ Core Attention Computation
```

也就是说，判断两种机制能不能组合，不要只看它们都叫不叫 Attention，而要看它们是否在修改**同一个结构维度**。[^1]

## 四个维度

### 1. 历史信息怎么表示

这一层回答的是：模型要把过去 token 的信息保存成什么形式？[^1]

常见形式包括：

- 普通 KV cache
- 多个 Q head 共享后的 KV
- MLA 的 latent KV
- compressed KV / block representation
- recurrent state

这里的重点是 **memory representation**。

### 2. 当前 Query 看哪些历史信息

这一层回答的是：历史很长时，本次 Attention 到底读取哪些位置？[^1]

常见策略包括：

- Dense：所有历史位置都参与
- Sliding Window：只读取局部窗口
- Top-K Sparse：由 indexer / router 选择少量位置
- Block Sparse：以块为粒度进行压缩和选择

这里的重点是 **selection / routing**。

### 3. Q head 与 KV head 怎么组织

这一层回答的是：不同 query heads 是否拥有独立的 K/V，以及如何共享。[^1]

典型方式：

- MHA：每个 Q head 有对应的 K/V head
- GQA：多个 Q heads 共享一组较少的 KV heads
- MQA：所有 Q heads 共享同一组 K/V

这里的重点是 **head / KV organization**。

### 4. 选中的信息具体怎么算 Attention

完成 memory 表示与历史选择后，还要决定 Q 如何和选中的 memory 做真正的 Attention 计算。底层可以是 MHA、GQA、MQA，也可以是 MLA 风格的 latent attention computation。[^1]

## 为什么 DSA 可以和 MLA 组合

这是最典型的“不同维度组合”。[^1]

- **MLA**：主要回答 KV 如何压缩、表示、缓存
- **DSA**：主要回答当前 query 从长历史中选哪些位置

结构可以理解为：

```text
hidden state
   ├──> MLA latent KV cache
   └──> indexer 对历史位置打分
             ↓
           Top-K
             ↓
      读取对应 latent KV
             ↓
        MLA attention
             ↓
           output
```

因此，“DSA 有自己的 KV / MLA cache 和 indexer”意味着：**Indexer 负责选择，MLA cache 负责保存被选择对象的表示。**[^1]

这也解释了一个容易混淆的点：

> DSA 并不是在 KDA 的 recurrent state 里面做 Top-K。

如果一个模块使用显式 KV / latent KV cache，并有自己的 indexer，它和 recurrent-state attention 是不同路线。[^1]

## 为什么 GQA 也可以和 Sparse Attention 组合

GQA 与 sparse selection 解决的是两个不同问题，因此天然可以叠加。[^1]

```text
GQA KV cache
    ↓
indexer / sparse selector
    ↓
Top-K positions
    ↓
GQA attention
```

其中：

- GQA：决定 KV heads 如何被多个 Q heads 共享
- Sparse selector：决定历史 token 中哪些位置参与本次计算

因此，一个 Attention 层完全可以同时是 **GQA-style** 和 **Sparse** 的。[^1]

## CSA 与 MQA/GQA 的关系

CSA 更适合理解成一种包含“压缩历史表示 + 稀疏选择”的高层 Attention 设计，而底层仍然可以有自己的 head/KV organization。[^1]

概念上可以写成：

```text
历史 token
   ↓
compressed KV / block representation
   ↓
indexer / sparse selection
   ↓
MQA or GQA core attention
   ↓
output
```

因此，`CSA + MQA` 或机制上的 `CSA + GQA` 并不矛盾：前者描述压缩/选择策略，后者描述 Q/KV heads 的组织与核心计算方式。[^1]

## 为什么 MLA + GQA 不像 DSA + MLA 那么自然

MLA 与 GQA 都会较强地介入 KV 的表示与共享，因此它们并不像“DSA + MLA”那样正交。[^1]

- GQA：通过减少 KV heads 来压缩 KV cache
- MLA：通过 latent representation 压缩 KV，并改变后续 K/V 的生成/计算路径

因此，更好的理解是：**GQA 和 MLA 往往是两条不同的 KV-cache 优化路线，而不是两个天然直接叠加的模块。**[^1]

## 一个更好用的分类表

| 技术 | 更适合归入的维度 | 主要解决的问题 |
|---|---|---|
| MHA | Head / KV organization | 每个 Q head 独立拥有对应 KV |
| GQA | Head / KV organization | 多个 Q heads 共享较少 KV heads |
| MQA | Head / KV organization | 所有 Q heads 共享 KV |
| MLA | Memory representation + computation | 用 latent KV 降低 KV cache 成本 |
| DSA | Selection / routing | 从长历史中稀疏选取重要位置 |
| CSA | Compression + sparse selection | 先压缩历史，再稀疏读取 |
| KDA 类 recurrent attention | Memory representation / state | 用 recurrent state 表示历史，而非保留完整显式 KV 序列 |

这张表的目的不是给所有论文做绝对分类，而是帮助理解：**这些技术名称常常跨越不同抽象层级。**[^1]

## 判断两种 Attention 能否组合的方法

以后遇到新的 `XXX Attention`，可以连续问四个问题：

1. 它改变了历史信息的**表示方式**吗？
2. 它改变了当前 query 的**历史选择方式**吗？
3. 它改变了 Q/KV heads 的**共享关系**吗？
4. 它改变了最终的 **Attention computation** 吗？

如果两个技术主要作用于不同维度，通常可以自然组合；如果都强烈修改同一个维度，则更可能是替代关系或需要专门适配。[^1]

## 面试级记忆

可以直接记住：

> **Attention 不是一个不可拆的整体。GQA/MQA 更像 head-KV 组织方式，MLA 更像 KV 表示与计算方式，DSA 更像 sparse selection；因此 DSA+MLA、Sparse+GQA 都可以成立。判断能否组合，要看它们是不是在改 Attention 的同一个结构维度。**[^1]

## Related

- [[attention-training-lightning-indexer]]
- [[llm-pretrain-data-engineering]]

[^1]: [[../raw/2026-09-07-attention-composition-gqa-mla-dsa-csa-kda|2026-09-07 Attention 机制如何组合：GQA / MLA / DSA / CSA / KDA]]
