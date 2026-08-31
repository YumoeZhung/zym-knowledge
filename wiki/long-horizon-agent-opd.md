---
title: 长轨迹 Agent 的 GRPO 信用分配与 On-Policy Distillation
created: 2026-08-31
last_updated: 2026-08-31
tags: [agent, credit-assignment, deepseek, distillation, glm, grpo, long-horizon, on-policy-distillation, reinforcement-learning]
sources: [raw/2026-08-31-long-horizon-agent-opd.md]
---

# 长轨迹 Agent 的 GRPO 信用分配与 On-Policy Distillation

## 一句话理解

普通 GRPO 用整条轨迹的最终 reward 评价轨迹，长任务中很难判断具体哪一步应该被奖励；On-Policy Distillation（OPD）则让学生在自己的轨迹上运行，由强教师在学生实际到达的每个状态提供逐 Token 概率分布，从而获得更密集、更稳定的学习信号。

## 问题：为什么长轨迹 GRPO 难训练

GRPO 对同一个任务采样多条轨迹，并计算组内相对优势：

```text
A_i = (R_i - mean(R)) / std(R)
```

在普通实现中，同一条轨迹内的生成内容通常共享由最终 reward 得到的 advantage。对几十或几百步的 Agent 任务，这会带来：

- **全组失败，无信号**：若所有轨迹 reward 相同，组内 advantage 接近零。
- **好步骤被误罚**：失败轨迹中正确的检索、定位和修改也会收到负向更新。
- **坏步骤被误奖**：成功轨迹中的绕路、偶然成功和无效动作也会收到正向更新。
- **探索概率下降**：轨迹越长，随机探索出完整成功路径的概率越低。

这包含两个相关但不同的问题：

- **奖励稀疏**：有用 reward 出现得太晚、太少。
- **信用分配**：无法判断最终结果应该归因于哪些中间动作。

GRPO 的 Reward、Advantage 与 Loss 关系见 [[llm-rl-optimization-signal-pipeline]]；它与 PPO、DPO 的区别见 [[llm-ppo-dpo-grpo-comparison]]。

## 第一反应：阶段奖励

将任务拆成多个子目标，每完成一个里程碑就给奖励，属于 reward shaping、process reward 或 milestone reward。

它在逻辑上是有效的，但开放式 Agent 任务存在多条正确路径，人工逐步标注成本高，而且固定里程碑可能诱导模型迎合中间分数而忽略最终目标。当前更可扩展的趋势是保留最终可验证结果，同时让教师、环境、Critic 或分支 rollout 自动产生更细粒度的学习信号。

## OPD 是什么

### 普通离线蒸馏

```text
教师生成正确轨迹 -> 学生模仿教师轨迹
```

学生只见过教师访问的状态。一旦实际运行中犯错并进入新状态，可能不知道如何恢复。

### On-Policy Distillation

```text
学生生成自己的轨迹
  -> 教师读取学生当前的真实前缀状态
  -> 教师输出完整 Token 概率分布
  -> 学生通过 KL Loss 对齐教师
```

可以概括为：

```text
L_OPD = sum_i w_i * KL(student || teacher_i)
```

关键在于训练状态来自当前学生策略。学生走弯路、工具报错或进入不理想状态时，教师仍能在这些状态上指导下一步，因此比固定教师轨迹更能覆盖学生部署时遇到的状态分布。

## OPD 为什么能缓解长轨迹训练困难

假设 Agent 在测试报错后准备选择下一步动作：

| 动作 | 学生概率 | Agent 专家概率 |
|---|---:|---:|
| 查看错误日志 | 15% | 55% |
| 检查依赖版本 | 10% | 25% |
| 随机修改其他代码 | 30% | 1% |

终局 GRPO 必须等整个任务结束后才能给出奖励。OPD则能在当前 Token 位置直接推动学生提高前两个动作的概率、降低第三个动作的概率。

它的价值包括：

1. **密集监督**：沿轨迹的每个 Token 都有教师分布，而不是只在终点得到一个标量。
2. **较低方差**：完整 logits 比单次采样动作包含更多信息。
3. **覆盖学生状态**：教师在学生自己访问的状态上纠偏。
4. **能力合并稳定**：不同领域专家无需直接做参数平均或混合 RL。
5. **减少灾难性遗忘**：后训练不同阶段的能力可以通过教师重新注入。

## DeepSeek V4：先专家化，再统一

DeepSeek V4 的公开流程是：

```text
Base Model
  -> 数学/代码/Agent/指令等领域专家
  -> 每个专家进行领域 SFT + GRPO
  -> 多教师 Full-Vocabulary OPD
  -> 统一模型
```

DeepSeek V4使用十多个领域教师。学生从自己的策略采样轨迹，再针对相关领域教师计算 reverse KL。它采用 full-vocabulary logit distillation，而不是只利用学生实际采样 Token 的对数概率近似 KL，从而降低估计方差并提高蒸馏稳定性。

需要准确表述：

> DeepSeek V4没有用 OPD 替代所有强化学习。领域专家本身仍由 SFT + GRPO 训练；OPD主要替换最终的 mixed RL 能力融合阶段。

所以 OPD缓解了统一模型的稀疏监督、领域冲突和能力合并问题，但并未彻底解决最初训练 Agent 专家时的信用分配。

## GLM：跨阶段 OPD 防止能力遗忘

GLM-5采用顺序后训练：

```text
SFT
  -> Reasoning RL
  -> Agentic RL
  -> General RL
  -> On-Policy Cross-Stage Distillation
```

后一个阶段可能覆盖前一个阶段的能力。GLM因此把各阶段 checkpoint 作为教师，让最终模型在 on-policy 轨迹上恢复此前获得的能力。

GLM的异步 Agent RL、slime、大规模可验证环境和并行 rollout 主要解决：

- 长短轨迹不均造成的同步等待；
- Agent rollout 成本和探索规模；
- 异步策略滞后带来的 off-policy 不稳定；
- 沙箱故障等噪声奖励。

这些基础设施能够让长轨迹 RL 实际跑起来，但不能等同于精细的 step-level credit assignment。

## DeepSeek V4 与 GLM 的区别

| 维度 | DeepSeek V4 | GLM-5 |
|---|---|---|
| 训练组织 | 多个领域专家并行培养 | Reasoning、Agentic、General 顺序 RL |
| OPD 教师 | 数学、代码、Agent等领域专家 | 不同后训练阶段的 checkpoint |
| 主要目的 | 专家能力统一与减少领域冲突 | 恢复顺序训练中遗忘的能力 |
| 共同点 | 学生在自己的轨迹上接受教师 logits 监督 | 学生在自己的轨迹上接受教师 logits 监督 |

## 三种方法不要混淆

| 方法 | 信号来源 | 解决重点 |
|---|---|---|
| 阶段奖励 | 人工或规则定义的中间里程碑 | 显式缩短动作与 reward 的距离 |
| 异步 Agent RL | 大规模持续生成可验证轨迹 | rollout 吞吐量与 off-policy 稳定性 |
| OPD | 教师在学生轨迹上的 Token 分布 | 密集监督、能力融合与减少遗忘 |

## 面试简答

> 这个问题本质上是长轨迹下的稀疏奖励和信用分配。普通 GRPO根据完整轨迹的最终 reward 计算组内 advantage，因此失败轨迹中的正确步骤也可能被惩罚；如果同组轨迹全部失败，advantage 还可能接近零。
>
> 阶段奖励属于 reward shaping，逻辑上可行，但开放式 Agent 的正确路径不唯一，人工定义和标注中间目标难以扩展。更可扩展的思路是 On-Policy Distillation。比如 DeepSeek V4先通过领域 SFT 和 GRPO分别训练数学、代码和 Agent 专家，再让统一学生模型在自己生成的轨迹上接受相关专家的 full-vocabulary logits 监督。这样学生在自己实际到达的状态上获得逐 Token、低方差的密集学习信号，同时避免 mixed RL 合并多种能力时的冲突。
>
> GLM也使用跨阶段 OPD，在 Reasoning RL、Agentic RL 和 General RL 后用各阶段 checkpoint 作为教师，恢复顺序训练中可能遗忘的能力。严格来说，OPD并没有消灭最初训练 Agent 专家时的稀疏奖励问题，而是利用强专家的密集监督，降低最终统一模型直接依赖终局 reward 的难度。

## 边界与易错点

- 不要说“OPD完全解决了长轨迹信用分配”。
- 不要说“DeepSeek V4已经不使用 GRPO”。
- 不要把 GLM 的异步 RL 说成 step-level reward 算法。
- “On-policy”指训练状态来自当前学生策略，不是指教师生成标准答案。
- OPD的代价是需要强教师，并承担教师前向计算和完整 logits 处理成本。

## Related

- [[llm-ppo-dpo-grpo-comparison]]
- [[llm-rl-optimization-signal-pipeline]]
- [[ppo-critic-td-error-gae]]
- [[long-horizon-agent-drift-loop-control]]
