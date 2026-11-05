---
title: 模型适配器：Agent 与模型 API 的协议边界
created: 2026-11-05
last_updated: 2026-11-05
tags: [agent, architecture, llm, model-adapter, prompt-engineering]
sources: [raw/2026-11-05-model-adapter-and-dynamic-prompts.md]
---

# 模型适配器：Agent 与模型 API 的协议边界

**模型适配器（Model Adapter）把 Agent 内部统一的请求转换成具体模型 API 所需的格式，再把响应转换回来。**它是代码层，格式转换本身不额外调用 LLM。[来源](../raw/2026-11-05-model-adapter-and-dynamic-prompts.md#核心解释)

## 它在什么位置

```text
Agent Loop / 上下文组装
        ↓ 内部请求：指令、历史、工具
模型适配器
        ↓ API 所需的字段与协议
模型服务
        ↓ 正文、工具调用、流式事件
模型适配器 → Agent Loop
```

适配器可以由 Harness 插件或客户端库实现；它不必是一个独立服务。Agent Loop 决定是否继续请求模型或执行工具，上下文管理负责保留什么信息，适配器负责协议转换与能力对接。[来源](../raw/2026-11-05-model-adapter-and-dynamic-prompts.md#核心解释)

## 为什么需要它

以下是简化的协议差异示例，不是通用于所有模型的配置模板：[来源](../raw/2026-11-05-model-adapter-and-dynamic-prompts.md#核心解释)

| 内容 | 可能存在的差异 |
|---|---|
| 系统指令 | OpenAI Chat Completions 可使用 messages 中的 system 消息，部分模型要求 developer；Anthropic Messages 使用顶层 system 字段 |
| 工具调用 | 工具定义、参数、调用 ID 和结果消息的表示不同 |
| 输出读取 | 流式事件、正文增量和结束原因的表示不同 |

名字相似不表示职责相同：模型 API adapter 处理模型协议；CLI、飞书或 HTTP 入口 adapter 处理用户输入和事件输出；LoRA adapter 是模型参数适配概念。[来源](../raw/2026-11-05-model-adapter-and-dynamic-prompts.md#核心解释)

## 动态系统提示词为什么涉及适配器

假设每个模型步骤重新生成“当前时间：北京时间2026-11-05 15:20”，应拆开检查以下问题：[推导依据](../raw/2026-11-05-model-adapter-and-dynamic-prompts.md#推导与未决边界)

1. SDK 是否有可直接传入或替换指令的参数？
2. 底层是否在每个模型步骤重新组装提示词？
3. 适配器与接口如何表达系统提示词的更新？
4. 最终请求是否仍包含旧值？
5. 持久化事件是否记录了旧值？

**动态更新、有效上下文只保留最新值、完全不写入持久历史，是三种不同的保证。**不能仅凭存在 instructions 槽位或 dynamic context 接口，就认定这三种保证同时成立；实际行为由组装、投影、适配器与 API 共同决定。

## DSH 的版本限定案例

2026-11-05 对话中的源码核查记录针对 Python SDK `0.2.1rc2` 与底层 `0.2.1-rc.2`：[来源与源码位置](../raw/2026-11-05-model-adapter-and-dynamic-prompts.md#dsh-案例已有核查记录)

- Python `Session.run()` 没有独立的 instructions/system_prompt 参数。
- 底层 `systemPrompt.section()` 支持函数形式的 text，`systemPrompt.variable()` 支持动态变量，可在每个模型步骤组装时计算；同一步的网络重试复用已组装的系统提示词。
- 系统提示词投影根据适配器能力和请求系列状态选择替换或追加，且可能保留变更事件。

以上是已有源码核查的整理，**没有在本次入库时重做实际请求验收，也不代表项目已实现动态时间插件**。若需要“每次请求只携带一个最新时间”，仍应检查实际适配器、最终请求体以及恢复后的行为。

## Related

- [[agent-system-architecture]] — 模型适配器在 Loop、Runtime 与 Harness 中的位置
- [[repeated-turn-instructions-context-bloat]] — 有效请求上下文与持久对话历史的区别
