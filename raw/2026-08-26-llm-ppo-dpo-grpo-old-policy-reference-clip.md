---
source: Codex conversation note on LLM PPO, DPO, GRPO, Old Policy, Reference Model, and PPO Clip
captured: 2026-08-26
type: note
---

# 大模型 PPO、DPO、GRPO 与 PPO 策略约束

## 原始问题脉络

本次对话围绕以下问题展开：

1. 从使用模型、奖励、损失函数、数据形式等维度比较强化学习算法。
2. 重点学习大模型后训练中的 PPO、DPO 与 GRPO。
3. 区分 PPO 中的 Old Policy 和 Reference Model。
4. 理解 PPO Clip 的作用以及 `clip` 函数如何计算。

## 三种方法的核心概括

- PPO：在线生成回答，由奖励系统打分，Critic 提供价值基线，GAE 形成 Advantage，再通过 PPO Clip 和 Reference KL 更新策略。
- DPO：使用固定的 `prompt + chosen + rejected` 偏好对，直接优化 Policy 相对 Reference Model 对 chosen 和 rejected 的偏好差，不进行在线 rollout，也不训练 Critic。
- GRPO：同一 Prompt 在线生成一组回答，分别计算奖励，以组内相对奖励形成 Advantage，省去 Critic，再使用 PPO 式概率比、Clip 和 Reference KL 更新策略。

## 关键组件

### Policy Model

正在训练的语言模型 `pi_theta(y|x)`，PPO、DPO 和 GRPO 最终都更新它。

### Old Policy

本轮 rollout 或策略更新开始时的策略快照，用于记录生成行为发生时的概率。PPO 通过

```text
ratio_t = pi_theta(a_t|s_t) / pi_old(a_t|s_t)
```

衡量当前策略相对行为策略在本轮改变了多少。工程上不一定常驻一份完整 Old Policy，也可以保存 rollout 时逐 Token 的 `old_logprob`：

```text
ratio_t = exp(new_logprob_t - old_logprob_t)
```

Old Policy 随训练轮次刷新，主要约束单轮更新。

### Reference Model

通常是训练开始前冻结的 SFT 模型，用于计算当前策略相对初始能力分布的 KL 代价。它通常不随训练刷新，主要约束长期漂移。

### Old Policy 与 Reference Model

```text
Old Policy：上一帧，检查这一步改变了多少。
Reference Model：原点或道路中心线，检查训练至今总体偏了多远。
```

两者可能在训练开始时权重相同，但生命周期和用途不同，不能混为一谈。

## PPO Clip

`clip(x, a, b)` 的定义是：

```text
clip(x, a, b) = min(max(x, a), b)
```

若 `epsilon = 0.2`，则概率比的裁剪区间为 `[0.8, 1.2]`：

| ratio | clip(ratio, 0.8, 1.2) |
|---:|---:|
| 0.5 | 0.8 |
| 0.9 | 0.9 |
| 1.0 | 1.0 |
| 1.1 | 1.1 |
| 1.5 | 1.2 |

PPO 的 Clipped Surrogate Objective 为：

```text
L_clip = E[min(ratio_t * A_t,
               clip(ratio_t, 1-epsilon, 1+epsilon) * A_t)]
```

训练框架通常最小化损失，因此实现中会在该目标前加负号。

- 当 `A_t > 0` 时，希望提高该动作概率；若 `ratio > 1+epsilon`，目标不再奖励继续提高。
- 当 `A_t < 0` 时，希望降低该动作概率；若 `ratio < 1-epsilon`，目标不再奖励继续降低。

Clip 裁剪的是损失中的概率比，不是参数，也不是对真实策略概率施加硬边界。由于共享参数、其他 Token 和其他损失项的共同作用，实际 ratio 仍可能越界。

## PPO 数据与模型

PPO 策略更新通常消费 Prompt 集以及在线产生的 rollout。Rollout 中常包含：

```text
prompt tokens
response tokens
old logprobs
reference logprobs
critic values
rewards
returns
advantages
masks
```

典型组件包括 Policy、Critic、Reference Model、奖励模型或验证器，以及生成时的 Old Policy 概率快照。

## DPO 数据与目标

DPO 使用固定偏好对：

```json
{
  "prompt": "问题",
  "chosen": "更好的回答",
  "rejected": "较差的回答"
}
```

定义：

```text
Delta_chosen = log pi_theta(chosen|x) - log pi_ref(chosen|x)
Delta_rejected = log pi_theta(rejected|x) - log pi_ref(rejected|x)
```

其目标鼓励 `Delta_chosen > Delta_rejected`：

```text
L_DPO = -log sigmoid(beta * (Delta_chosen - Delta_rejected))
```

DPO 不需要显式 Reward Model、Critic 或在线 Advantage，但依赖偏好数据的覆盖度和质量。

## GRPO 数据与目标

GRPO 通常从 Prompt 或 `prompt + solution/verification metadata` 出发，同一 Prompt 在线生成多个 completion：

```text
completion_1 -> reward_1
completion_2 -> reward_2
...
completion_G -> reward_G
```

常见组内优势形式为：

```text
A_i = (r_i - mean(r)) / std(r)
```

GRPO 不训练 Critic，而是依靠同组回答的相对奖励建立基线。它适合数学、代码、结构化抽取等具有程序验证器或确定性规则奖励的任务。

若同组奖励全部相同，则组内标准差为零或接近零，无法产生有效排序信号。因此 GRPO 同时依赖奖励区分度、采样多样性、每组生成数量和任务难度。

## 选型结论

- 有高质量偏好对、希望低成本稳定训练、不需要在线探索：优先考虑 DPO。
- 有开放式奖励模型、需要在线探索和 Token 级价值估计、资源充足：考虑 PPO。
- 有可靠程序验证器或规则奖励、能对同一 Prompt 生成多个候选、希望省去 Critic：考虑 GRPO。

三种方法都不能仅凭训练损失或训练奖励断言任务效果提升，仍需要独立验证集、业务指标、格式合法率、失败切片与奖励投机检查。
