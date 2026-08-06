---
title: "跨页表的 Parent-Child 检索：权威结构不拆，检索投影按行窗口治理"
created: 2026-08-06
last_updated: 2026-08-06
source: "Codex conversation selection"
tags: [rag, retrieval, document-parsing, knowledge-governance, table-retrieval, system-design]
---

# 跨页表的 Parent-Child 检索：权威结构不拆，检索投影按行窗口治理

处理跨页大表时，“表是否拆分”不是一个单层问题。更准确的设计是：**权威表不拆，检索表示按需拆，Agent 阅读粒度动态扩大**。

这避免了两个极端：既不把一张表破坏成互不相干的 chunks，也不强迫一个 embedding 承载整张跨页大表的全部语义。

## 三层数据边界

| 层 | 单元 | 职责 | 是否权威 |
|---|---|---|---|
| 权威存储 | 完整表 Parent | 保存完整结构、内容、页码与来源证据 | 是 |
| 检索投影 | 行窗口 / 行组 Child | 提供多个语义聚焦的 keyword/vector 检索入口 | 否，可重建 |
| Agent 阅读 | 行窗口、相邻窗口、整页或整表 | 根据问题逐步扩大证据范围 | 读取视图 |

关键边界是：Retrieval Child 不是另一份表，也不能反向成为事实真相。它只是由完整 Parent 派生的索引投影；投影损坏或策略变化时，可以从 Parent 重新生成。

## 为什么跨页大表仍需要多个检索入口

若把整张跨页表只生成一个 embedding，常见问题包括：

- 超过模型或 embedding 输入上限，发生截断；
- 不同商品类别和规则被压进同一向量，语义信号被稀释；
- 局部问题难以准确召回，尤其是只问某一类别时；
- 每次命中都携带整张表，浪费上下文预算；
- Agent 很难判断应该继续读相邻内容，还是已经获得完整证据。

因此，“权威表不拆”不等于“只建一个检索向量”。两者解决的是不同问题。

## Parent-Child 组织方式

```text
完整表 AST（Parent，仅一份）
├── 调味品行组（Retrieval Child）
├── 饮料类行组（Retrieval Child）
└── 油脂及其制品行组（Retrieval Child）
```

所有 Child 共享稳定的 `table_id`，并携带自身覆盖的逻辑行范围、源页范围、前后窗口关系和 Parent 定位信息。它们不复制或修改 Parent 的权威结构。

## 行窗口治理规则

一个可靠的行窗口至少应满足：

1. 不在逻辑行内部截断，避免把对象与数值、条件与结论拆开。
2. 保留必要的表名、表头、单位、脚注和合并单元格继承语义。
3. 跨页时识别重复表头，但仍保留原始页级 lineage。
4. 使用稳定 `table_id`、窗口顺序和 source span，使 Agent 可以读相邻窗口或回到完整 Parent。
5. 投影只做检索上下文化；若投影与 Parent 冲突，以 Parent 为准。

窗口中重复表名和表头属于**上下文注入**，不是权威数据复制。其目的，是让每个 Child 在脱离整表时仍具备足够的检索语义。

## Agent 的渐进式读取

推荐读取流程：

1. 先用 keyword/vector 检索命中最相关的行窗口。
2. 若答案所需条件、脚注或上下文不足，根据同一 `table_id` 读取相邻窗口。
3. 若问题涉及整表范围、跨类别比较或全局脚注，升级读取整页或完整 Parent。
4. 最终回答引用 Parent 中可定位的权威证据，而不是把多个 Child 拼接结果当作事实源。

这种方式把 multi-step retrieval 变成受控的“逐步扩大证据范围”，与 [[rag-retrieval-2026-lessons]] 中的 query-aware retrieval 思路一致。

## 何时不需要拆检索投影

小表若满足以下条件，可以让 Parent 同时作为唯一 Retrieval Child：

- 完整内容在预算内；
- 表头、单位和脚注能与表体一起保留；
- 一个向量足以表达主要主题；
- 命中后不会造成明显上下文浪费。

因此，拆分应由结构和预算触发，而不是“所有表固定按 N 行切分”。

## 反模式

- 直接破坏完整表，只保存行 chunks。
- 按字符数或换行机械切分，截断逻辑行。
- 每个窗口复制成互相独立的“权威表”。
- 让检索 Child 丢失 `table_id`、页码、表头或脚注关系。
- 检索命中后只读单个 Child，不允许扩大到相邻窗口或 Parent。
- 将 Child 拼接出的文本反向覆盖原始表结构。

## 核心结论

跨页表治理应坚持：**一份完整权威表，多个可重建检索投影，多档可升级 Agent 阅读粒度**。Parent 保证事实与结构完整性；Child 提升召回精度和上下文效率；`table_id` 与 source lineage 让 Agent 能从局部命中安全地扩展到完整证据。

## Related

- [[rag-retrieval-2026-lessons]] — Query-aware、多步检索与证据窗口
- [[agent-system-architecture]] — 分层职责与可观测边界
- [[version-bound-signed-cursor]] — 多步读取时保持版本一致性的 Cursor 合同
