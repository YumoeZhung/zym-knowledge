---
title: 构建自我改进的 Agent：Close the Loop
created: 2026-06-25
last_updated: 2026-06-25
source: https://mp.weixin.qq.com/s/pu6b96vq9i15uMt2EGiemA
tags: [agent, anthropic, close-the-loop, evaluation, harness, self-improving]
---

# 构建自我改进的 Agent：Close the Loop

Anthropic 产品经理 Theo Chu 的演讲核心主张：**模型角色已从"回答问题"转向"在闭环中持续完成任务"**。开发者应为未来的强模型构建产品，而非为过去的弱模型打补丁。

> "Anthropic 内部超过 80% 的代码由 Claude 合并。"

## 核心论点：Close the Agent Loop

Agent 的本质不是"调用更多工具"，而是形成 **执行 → 验证 → 修正 → 再执行** 的闭环。模型必须拥有验证自身输出的手段，才能真正自我改进。

## 模型能力的三大跃迁

| 能力维度 | 旧模型表现 | 新模型表现 |
|---------|-----------|-----------|
| 规划 | 上来就写代码，不看说明书 | 自适应思考，先规划后执行 |
| 错误恢复 | Doom looping（反复用同一方式失败） | 读取反馈、理解原因、切换路径 |
| 长程连贯 | 跟丢主线（Losing the plots） | 100万+ Token 注意力维持 |

**量化证据**：SWE-bench Verified 从 Sonnet 3.7 的 60% → Opus 4.8 的 88%，失败率降为原来的 1/3。

## 三条开发者战术

### 1. 动态刷新 Evals（面向未来设计）

- Evals 会过时——如果 12 个月前的测试题今天全通过了，说明你在测已知能力
- 好的 Eval 应包含"今天模型尚未解决、但用户体验真正需要"的任务
- 持续将用户报告的最新失败模式加入测试集

与 [[claw-swe-bench-harness-evaluation]] 的关联：评估基准本身需要随模型进化而迭代。

### 2. 精简脚手架（Shrink the Scaffolding）

**脚手架 = 为旧模型漏洞打的补丁**（过度具体的 system prompt、外层约束逻辑、格式规则堆叠）。

陷阱案例：Anthropic 自己发现新模型"引用 Bug"，实际原因是新模型指令遵循能力太强，忠实执行了一条过时的 system prompt 规则。删掉那行即修复。

**原则：针对意图写 prompt，不要针对历史失败写 prompt。**

与 [[anthropic-claude-code-practices]] 和 [[everything-claude-code]] 的关联：CLAUDE.md 等配置也应定期审计，删除过时约束。

### 3. 闭环设计三要素

1. **留出思考空间** — 自适应思考 + Effort Dial（投入度拨盘），让模型自决深度
2. **受控开放权限** — 自动模式分类器，平衡控制欲与自主权（参考 [[anthropic-claude-code-practices]] 中的权限分级）
3. **提供验证工具** — Computer Use、前端点击测试、单元测试执行，让 Agent 能自我质检

与 [[agent-system-architecture]] 的关联：这正是 harness 层应提供的核心能力——为 Agent 构建反馈通道。

## 关键 Insight（个人提炼）

1. **失败率比成功率更重要**：模型进步的本质是失败率下降，失败率足够低时才能支撑长任务链
2. **脚手架是技术债**：每一条 workaround prompt 都是未来需要清理的负担；模型越强，旧脚手架越有害
3. **环境设计 > 模型能力**：给模型什么样的反馈通道，决定了它能达到什么样的表现上限
4. **面向未来测试**：Evals 不是回归测试，而是前瞻性能力探针

## 与 Harness 架构的联系

这场演讲的核心理念与我们的 [[harness-as-moat]] 论点高度一致：

- Harness 的核心价值 = 为模型提供闭环反馈通道
- 脚手架精简 ≠ 去掉 harness，而是将 harness 从"约束层"升级为"赋能层"
- 长任务能力提升意味着 harness 的 [[agent-harness-durable-compaction-runtime-boundary|durable compaction]] 设计更加关键
