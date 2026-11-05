# 模型适配器与动态提示词：讨论摘要

- 来源：2026-11-05 用户与助手关于“什么是模型适配器”的对话，以及此前 DSH 提示词入口的源码核查说明。
- 采集日期：2026-11-05（北京时间）。
- 材料类型：对话摘要，非逐字原文。
- 核验范围：本次入库整理概念和已有核查记录，没有重新执行模型请求、验证部署或修改业务代码。DSH 细节限定于讨论中核查的 `deepseek-harness-sdk==0.2.1rc2` 与底层 `0.2.1-rc.2`，不代表其他版本。

## 核心解释

模型适配器是 Agent 内部请求/响应格式与具体模型 API 协议之间的转换层。它将系统提示词、对话消息、工具定义等映射成 API 请求，再将模型正文、工具调用和流式事件等转换回内部格式。格式转换本身不需要再调用一个 LLM。

协议差异的简化示例：OpenAI Chat Completions 的系统指令可放在 messages 中的 system 消息；具体模型也可能要求 developer 角色。Anthropic Messages 使用独立的顶层 system 字段。工具定义、工具结果、流式事件和停止原因等也存在差异。示例不代表所有模型、版本或兼容网关均接受同一字段。

这里的 model adapter 不等于 CLI/飞书/HTTP 入口 adapter，也不等于 LoRA 训练中的 adapter 权重。模型适配器可以作为 Harness 插件，也可以由模型客户端库实现；部署位置不是概念定义的一部分。

## DSH 案例：已有核查记录

此前对话查阅了以下同版本源码：

- Python `deepseek_harness/api.py` 的 `Session.run(input, on_notification=...)`：没有单独的 instructions 或 system_prompt 参数。
- `@deepseek-ai/dsh-system-prompt/lib/index.js`：`systemPrompt.section()` 的 text 支持函数；`systemPrompt.variable()` 支持动态变量；`assemble()` 执行这些 provider。
- `@deepseek-ai/dsh-agent-loop/lib/index.js`：`preStep()` 组装提示词，`step()` 使用渲染结果。每个模型步骤可以重新组装，搜索结果返回后的下一步骤也在其内；同一步的请求重试复用已组装的系统提示词。
- `SystemPromptProjection.project()`：根据适配器声明的 systemPromptUpdate 能力及请求系列状态，选择替换或追加系统消息。变更仍可能作为事件记录；不能据此保证完全不持久化。
- 原生 runtime context 也可能追加为用户消息，名称含 context 不证明它是临时数据。

源码项目指针：https://github.com/deepseek-ai/deepseek-harness （指针便于追查，不表示当前主分支与上述版本一致）。本条来源没有附完整源码快照或实际 HTTP 抓包。

## 推导与未决边界

“SDK 暴露了参数”“底层支持动态生成”“最终请求正确更新”“旧值不进入有效上下文”“旧值不留持久化记录”是不同问题。DSH 底层存在动态入口，不意味着 Python SDK 已提供直接调用方式，也不意味着它天然满足后两项。

应分别查看提示词组装、适配器能力声明、最终请求体与会话持久化记录。不能只把问题归因于适配器；Agent Loop、投影逻辑、适配器和接口共同决定行为。本次没有实现动态时间插件，也没有证明第五轮请求只含一个最新时间。
