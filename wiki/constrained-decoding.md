---
title: LLM 约束解码：状态机、Logit 屏蔽与结构化输出
created: 2026-09-01
last_updated: 2026-09-01
tags: [constrained-decoding, finite-state-machine, json-schema, llm, logits, structured-output]
sources: [raw/2026-09-01-constrained-decoding-conversation.md]
---

# LLM 约束解码：状态机、Logit 屏蔽与结构化输出

## 核心结论

约束解码（constrained decoding）不是用提示词劝模型遵守格式，而是在模型每次选择下一个 token 前，直接屏蔽所有违反语法约束的候选 token。

```text
模型计算全词表 logits
→ 约束器计算当前状态下的合法 token 集合
→ 非法 token 的 logit 设为 -∞
→ 从合法 token 中采样
→ 更新模型上下文和约束器状态
```

因此，模型仍负责在合法范围内选择内容，约束器只负责划定不可越过的结构边界。([对话原始记录](../raw/2026-09-01-constrained-decoding-conversation.md))

## 状态机：对历史的最小化总结

状态机可以写成：

```text
当前状态 + 新输入 → 执行动作 + 新状态
```

“状态”不是完整历史，而是为了判断下一步行为，对过去发生之事所做的最小化总结。

以地铁闸机为例：

| 当前状态 | 输入 | 动作 | 新状态 |
|---|---|---|---|
| 锁定 | 刷卡 | 解锁 | 已解锁 |
| 锁定 | 推门 | 拒绝通行 | 锁定 |
| 已解锁 | 推门 | 允许通行 | 锁定 |

同一个“推门”输入在不同状态下产生不同结果，因此系统必须保存状态。

“有限状态机”（FSM）的“有限”表示状态集合预先确定且数量有限，运行时只会在这些状态之间转移。([对话原始记录](../raw/2026-09-01-constrained-decoding-conversation.md))

## 用状态机理解 JSON 生成

假设目标结构是：

```json
{"name":"小明"}
```

约束器可以把生成过程理解为一组解析状态：

| 已生成前缀 | 解析状态 | 下一步允许的内容 |
|---|---|---|
| 空 | 等待对象开始 | `{` |
| `{` | 等待字段名 | 空白、`"` |
| `{"name"` | 字段名结束，等待冒号 | 空白、`:` |
| `{"name":` | 等待字符串值 | 空白、`"` |
| `{"name":"小明"` | 值结束，等待对象结束 | 空白、`}` |
| `{"name":"小明"}` | 接受状态 | 停止 |

“字段名结束，等待冒号”是面向人的解释。实际系统通常只保存状态编号、语法节点或解析栈，不会把这句话作为提示发送给模型。

模型和约束器读取同一份已生成前缀，但职责不同：

- 模型根据上下文计算所有候选 token 的 logits；
- 约束器根据语法状态计算合法 token 集合；
- 解码器合并二者后选择下一个 token。

## Logit 屏蔽如何形成硬约束

假设当前前缀为：

```json
{"name"
```

模型原始 logits 可能为：

| token | 原始 logit |
|---|---:|
| `是` | 12.1 |
| `}` | 11.3 |
| `:` | 9.8 |
| 空格 | 6.2 |

约束器判断当前只能接受冒号或空白，于是修改为：

| token | 约束后 logit |
|---|---:|
| `是` | `-∞` |
| `}` | `-∞` |
| `:` | 9.8 |
| 空格 | 6.2 |

被设为 `-∞` 的 token 经 Softmax 后概率为 0，模型不可能选中。相比之下，提示词“请只输出 JSON”没有删除任何候选，因此只是软约束。

简化伪代码：

```python
state = grammar.start_state()

while not state.finished:
    logits = model.forward(generated_tokens)
    allowed = grammar.allowed_tokens(state)
    logits[all_tokens - allowed] = float("-inf")

    token = sample(logits)
    generated_tokens.append(token)
    state = grammar.update(state, token)
```

## Token 不是单个字符

模型的生成单位是 token。一个 token 可能表示一个字符、一个词，也可能同时包含多个 JSON 字符。

因此约束器不能只判断“下一个字符是否合法”，而要检查：

> 将该 token 对应的字符或字节序列接到当前前缀后，解析器是否能合法地连续推进？

一个 token 可能跨过多个语法状态。工程实现通常会预计算、缓存或增量计算“状态 → 合法 token 集合”，避免每一步暴力扫描整个词表。

## FSM、PDA 与 CFG

| 机制 | 额外记忆 | 适合表达 |
|---|---|---|
| FSM（有限状态机） | 有限当前状态 | 正则语言、固定或有限结构 |
| PDA（下推自动机） | 状态 + 栈 | 任意深度的括号和递归嵌套 |
| CFG/增量解析器 | 文法产生式与解析状态 | 更一般的递归语法 |

JSON 允许对象和数组任意嵌套，仅靠一张简单、固定大小的 FSM 不容易自然表达任意深度；工程框架可能使用 PDA、上下文无关文法（CFG）、增量解析器或优化后的混合方案。

所以“把 JSON Schema 编译成状态机”适合作为入门理解，但不应机械地认为所有实现底层都一定是简单 FSM。([对话原始记录](../raw/2026-09-01-constrained-decoding-conversation.md))

## JSON Schema 能保证到哪一层

需要区分三层正确性：

| 层次 | 示例 | 约束解码能否保证 |
|---|---|---|
| JSON 语法 | 引号、逗号、括号合法 | 通常可以 |
| Schema 结构 | 必填字段、类型、枚举、额外字段 | 取决于实现支持的 Schema 子集 |
| 事实与业务语义 | 年龄是否真实、答案是否正确 | 不能仅靠结构约束 |

约束器可以保证 `age` 是整数，却不能保证年龄值与真实世界一致。格式可靠性不能替代事实验证或业务校验。

## 调用模型供应商 API 时的边界

### 普通文本 API

逐 token 推理循环运行在供应商服务器内部。客户端通常无法在每一步：

1. 获取完整 logits；
2. 修改非法 token 的 logits；
3. 复用同一次服务端生成的 KV Cache 继续采样。

即使 API 返回 logprobs，它通常也只是事后展示分数，不代表客户端获得了采样控制权。因此，普通文本 API 的客户端无法自行实现真正的硬约束解码。

### 原生结构化输出 API

如果供应商提供 Structured Outputs、JSON Schema、Grammar 或 Response Schema，客户端可以提交约束，由服务端实施逐 token 约束或其他等价保证。

但不同能力的承诺范围不同：

- JSON mode 可能只保证结果是合法 JSON；
- Schema-based Structured Outputs 可能进一步保证字段和类型；
- Function/Tool Calling 是否严格符合 Schema，应以具体 API 文档为准，不能只从功能名称推断底层实现。

### 不支持硬约束时

可以采用：

```text
生成 → JSON 解析 → Schema 校验 → 携带具体错误重试或修复
```

这是生成后的验证闭环，不是逐 token 约束解码。它能提高最终可靠性，但仍可能增加延迟、成本，并需要处理重试耗尽。

## 面试版回答

> 约束解码会把 JSON Schema 或文法编译成可增量推进的语法约束。模型逐 token 生成时，外部解析器根据已生成前缀维护当前状态，计算下一步合法 token 集合，再把非法 token 的 logit 设为负无穷。因此模型只能从合法候选中采样。FSM 适合有限或固定结构，递归嵌套通常需要 PDA、CFG 或增量解析器。它能保证语法和受支持的 Schema 结构，但不能保证事实语义。调用普通闭源文本 API 时，客户端拿不到逐 token 采样控制权；只有供应商原生支持 Structured Outputs/Grammar，或自行部署推理服务，才能实施真正的硬约束。

## Related

- [[agent-system-architecture]] — 约束解码器可位于 Model adapter 或 Runtime 的输出控制边界
