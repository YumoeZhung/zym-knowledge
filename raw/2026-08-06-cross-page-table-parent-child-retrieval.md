---
source: "Codex conversation selection"
captured: 2026-08-06
type: note
---

# 跨页表和行窗口治理

可以“不拆权威表”，但不建议“不拆检索表示”。这里要区分三个概念：

- 权威存储单元：整张表作为完整 AST 保存，绝不破坏。
- 检索单元：按逻辑行组生成多个检索表示和 embedding。
- Agent 阅读单元：命中后可读取行窗口、整页或整张表。

小表可以整表一个 Chunk；但表 A.1 这种跨多页大表若只生成一个 embedding，会遇到截断、语义稀释、召回不准和上下文浪费。即便“表不拆”，最终也需要多个检索入口。

推荐 parent-child 方式：

```text
完整表 AST（Parent，不拆）
├── 调味品行组（Retrieval Child）
├── 饮料类行组（Retrieval Child）
└── 油脂及其制品行组（Retrieval Child）
```

检索命中“调味品”后，Agent 先拿这一行组；信息不足时，再通过统一 `table_id` 读取相邻行组或完整表。因此，“每个窗口重复表名和表头”不是复制出多份权威数据，而只是生成多个可丢弃、可重建的检索投影。真正的表仍只有一份。
