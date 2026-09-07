---
source: 当前对话：面试中的长轨迹 Agent 强化学习、GRPO 与 OPD
captured: 2026-08-31
type: conversation
title: 长轨迹 Agent 的稀疏奖励问题与 OPD 解法
---

# 对话背景

面试官先提出：GRPO 通过同一任务下多条 rollout 的组内奖励计算 advantage，但 Agent 任务可能包含几十乃至数百个步骤。如果只在任务结束时给一个 reward，长轨迹的强化学习容易因奖励稀疏、信用分配粗糙而难以收敛。

用户当时提出的思路是：把任务拆成多个子目标，完成每个子目标后给予阶段性奖励。面试官认可该方向，但指出手工定义和标注中间目标难以扩展，并进一步询问 DeepSeek V4、GLM 等最新模型在后训练中采用的方法。后续确认面试官指的是 On-Policy Distillation（OPD）。

# 对话中形成的核心解释

## 普通 GRPO 的长轨迹问题

GRPO 常对同一输入采样一组完整轨迹，并根据每条轨迹的最终奖励计算组内相对 advantage：

```text
A_i = (R_i - mean(R)) / std(R)
```

在长轨迹中，这会产生三个典型问题：

1. 如果一组轨迹全部失败，reward 相同，advantage 接近零，缺少有效梯度。
2. 失败轨迹中可能包含大量正确动作，却因最终失败而一起受到负向更新。
3. 成功轨迹中可能包含无效绕路或错误尝试，却因最终成功而一起受到正向更新。

因此，问题不只是 reward sparse，还包括 long-horizon credit assignment：最终结果应该归因给哪些中间动作。

## 阶段奖励的价值与限制

把任务拆成子目标并设置 milestone/process reward 是合理的 reward shaping 方法，可以缩短 reward 与动作之间的距离。

其扩展难点包括：

- 开放式 Agent 任务通常存在多条正确路径；
- 每个领域都需要重新定义里程碑；
- 人工逐步标注成本高；
- 固定阶段奖励可能诱发 reward hacking；
- 中间进展不一定单调，失败尝试也可能为后续纠错提供信息。

更可扩展的方向不是完全放弃中间信号，而是让环境、教师模型、价值模型或分支 rollout 自动产生信号。

## OPD 的基本机制

普通离线蒸馏通常由教师生成标准轨迹，学生模仿；学生实际执行时一旦偏离教师轨迹，容易进入训练数据未覆盖的状态。

OPD 则让学生模型先按照当前策略生成自己的轨迹。教师模型在学生真实到达的每个前缀状态上输出 token 概率分布，学生通过 KL loss 学习教师：

```text
学生当前策略生成轨迹
  -> 教师在学生的每个轨迹状态上计算 logits
  -> 逐 token 比较教师与学生的概率分布
  -> 反向传播更新学生
```

因此，OPD 的关键不是“教师给学生一条完美答案”，而是“教师在学生自己的状态分布上持续纠偏”。相比只在终点得到一个 0/1 reward，它在蒸馏阶段提供密集、低方差的 token-level 学习信号，并减少离线模仿的分布偏移问题。

## DeepSeek V4

DeepSeek V4 使用 specialize-then-unify 两阶段后训练：

1. 数学、代码、Agent、指令遵循等领域专家分别经过领域 SFT 和 GRPO。
2. 最终统一模型作为学生，在自己生成的轨迹上接受多个专家教师的 On-Policy Distillation。

公开报告称其使用十多个教师，并采用 full-vocabulary logit distillation 计算 reverse KL，而不是仅对采样 token 近似 KL。完整词表分布能降低梯度估计方差，提高专家能力合并的稳定性。

严谨边界：DeepSeek V4 并未用 OPD 取代所有 RL。各领域专家仍使用 SFT + GRPO；OPD主要替换过去的 mixed RL 能力合并阶段。它缓解最终统一模型直接依赖稀疏 reward、领域冲突和能力融合不稳定的问题，但没有从根本上解决 Agent 专家初始训练阶段的精细信用分配。

## GLM

GLM-5 的主要后训练顺序是：

```text
SFT -> Reasoning RL -> Agentic RL -> General RL
    -> On-Policy Cross-Stage Distillation
```

顺序训练不同能力可能导致后续阶段覆盖或损害前面阶段的能力。GLM把不同阶段的 checkpoint 作为教师，在最终阶段通过跨阶段 OPD 恢复此前获得的能力。

GLM还通过 slime 异步 RL、可验证沙箱、大规模并行 rollout、importance sampling、丢弃过旧或环境异常轨迹等方法，提高长轨迹探索吞吐量和训练稳定性。但异步 RL 主要解决 rollout 效率、长尾等待和 off-policy 稳定性，不等同于解决精细信用分配。

# 面试简答

> 这个问题本质上是长轨迹下的稀疏奖励和信用分配。普通 GRPO 根据完整轨迹的最终 reward 计算组内 advantage，因此失败轨迹中的正确步骤也可能被惩罚；如果同组轨迹全部失败，advantage 还可能接近零。
>
> 我提出的阶段奖励属于 reward shaping，逻辑上可行，但开放式 Agent 的正确路径不唯一，人工定义和标注中间目标难以扩展。更可扩展的做法是 On-Policy Distillation。比如 DeepSeek V4 先通过 SFT 和 GRPO 分别训练数学、代码和 Agent 专家，再让统一学生模型在自己生成的轨迹上接受相关专家的 full-vocabulary logits 监督。这样学生在自己实际到达的状态上获得逐 token、低方差的密集学习信号，同时避免 mixed RL 合并多种能力时的冲突。GLM则使用跨阶段 OPD，恢复 Reasoning RL、Agentic RL 和 General RL 顺序训练过程中可能遗忘的能力。
>
> 严格来说，OPD并没有消灭最初训练 Agent 专家时的稀疏奖励问题，而是利用强专家的密集监督，降低最终统一模型直接依赖稀疏终局 reward 的难度。

# 参考资料

- DeepSeek-AI, [DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence](https://arxiv.org/html/2606.19348)
- GLM-5 Team, [GLM-5: From Vibe Coding to Agentic Engineering](https://arxiv.org/html/2602.15763)
- Z.ai, [GLM-5 官方仓库](https://github.com/zai-org/GLM-5)
