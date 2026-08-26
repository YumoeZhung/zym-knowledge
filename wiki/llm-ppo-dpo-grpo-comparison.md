---
title: 大模型后训练：PPO、DPO 与 GRPO 对比
created: 2026-08-26
last_updated: 2026-08-26
tags: [dpo, grpo, llm, policy-optimization, ppo, preference-optimization, reinforcement-learning, rlvr]
sources: [raw/2026-08-26-llm-ppo-dpo-grpo-old-policy-reference-clip.md]
---

# 大模型后训练：PPO、DPO 与 GRPO 对比

PPO、DPO 和 GRPO 都试图让语言模型更偏向高质量回答，但三者获得学习信号的方式不同：PPO 从奖励和 Critic 获得 Advantage，DPO 从离线偏好对直接构造目标，GRPO 从同一 Prompt 下多条回答的相对奖励获得 Advantage。

## 一张表看清核心区别

| 维度 | PPO | DPO | GRPO |
|---|---|---|---|
| 是否在线强化学习 | 是 | 否，属于直接偏好优化 | 是 |
| Policy 输入数据 | Prompt + 在线 rollout | `prompt + chosen + rejected` | Prompt + 同组多个在线 completion |
| 质量信号 | 奖励模型、规则或验证器 | chosen 优于 rejected | 每条 completion 的奖励 |
| Critic | 需要 | 不需要 | 通常不需要 |
| Reference Model | 通常需要 | 通常需要 | 通常需要 |
| Advantage | Critic + GAE | 无显式 Advantage | 组内相对奖励 |
| 策略约束 | Old Policy Clip + Reference KL | 相对 Reference 的偏好目标 | PPO 式 Clip + Reference KL |
| 在线探索 | 有 | 无 | 有 |
| 数据复用 | 弱，旧 rollout 会过期 | 强，可重复训练固定偏好对 | 弱，更新后需要新 rollout |
| 主要成本 | Critic、在线生成和多模型显存 | 偏好数据建设 | 同一 Prompt 多次生成 |
| 主要风险 | Critic 偏差、奖励投机、系统复杂 | 偏好覆盖不足、不能在线探索 | 奖励同质化、探索不足、奖励投机 |

## PPO：奖励减去预期

PPO 的典型大模型训练流程是：

```text
Prompt
  -> Policy在线生成回答
  -> 奖励系统打分
  -> Critic估计各Token位置的状态价值
  -> GAE计算Advantage
  -> PPO Clip更新Policy
  -> Value Loss更新Critic
  -> Reference KL限制长期漂移
```

PPO 的核心概率比是：

```text
ratio_t = pi_theta(a_t|s_t) / pi_old(a_t|s_t)
```

Clipped Surrogate Objective 是：

```text
L_clip = E[min(ratio_t*A_t,
               clip(ratio_t, 1-epsilon, 1+epsilon)*A_t)]
```

它通过 Critic 降低策略梯度方差，通过 Clip 控制单轮更新，通过 Reference KL 控制长期偏移。Critic、TD 误差与 GAE 的细节见 [[ppo-critic-td-error-gae]]。

## DPO：直接学习偏好差

DPO 使用固定偏好对：

```json
{
  "prompt": "问题",
  "chosen": "偏好的回答",
  "rejected": "不偏好的回答"
}
```

它比较 Policy 相对 Reference Model 对两条回答的概率变化：

```text
Delta_w = log pi_theta(chosen|x) - log pi_ref(chosen|x)
Delta_l = log pi_theta(rejected|x) - log pi_ref(rejected|x)

L_DPO = -log sigmoid(beta * (Delta_w - Delta_l))
```

DPO 不需要显式奖励模型、Critic、在线 rollout 或 Advantage。它的训练形式接近监督学习，成本较低且通常较稳定，但无法主动探索偏好数据之外的新回答，效果高度依赖偏好对的质量和覆盖范围。

## GRPO：用组内比较替代 Critic

GRPO 对同一个 Prompt 生成一组回答：

```text
completion_1 -> reward_1
completion_2 -> reward_2
...
completion_G -> reward_G
```

常见组内优势为：

```text
A_i = (r_i - mean(r)) / std(r)
```

高于组内平均的回答获得正优势，低于平均的回答获得负优势。之后再使用 PPO 式概率比、Clip 和 Reference KL 更新 Policy。

GRPO 省去了 Critic，但并不等于训练便宜：同一 Prompt 需要生成多条回答，rollout 仍可能是主要成本。若一组回答的奖励相同或近似相同，组内 Advantage 就会失去有效信号。

## PPO 中两个容易混淆的模型

| 对比 | Old Policy | Reference Model |
|---|---|---|
| 来源 | 本轮 rollout 或更新开始前的 Policy | 通常是初始 SFT 模型 |
| 生命周期 | 随训练轮次刷新 | 通常始终冻结 |
| 比较对象 | 当前 Policy 与生成数据时的策略 | 当前 Policy 与初始参考策略 |
| 用途 | 计算概率比和 PPO Clip | 计算 KL 惩罚 |
| 约束尺度 | 单轮更新幅度 | 长期整体漂移 |

工程实现不一定保存完整 Old Policy。只要 rollout 时保存了逐 Token `old_logprob`，就能计算：

```text
ratio = exp(new_logprob - old_logprob)
```

记忆方式：Old Policy 是“上一帧”，Reference Model 是“原点”。

## Clip 函数

```text
clip(x, lower, upper) = min(max(x, lower), upper)
```

若 `epsilon=0.2`，则：

```text
clip(ratio, 0.8, 1.2)
```

- `ratio=0.5`，返回 `0.8`。
- `ratio=1.1`，返回 `1.1`。
- `ratio=1.5`，返回 `1.2`。

当 Advantage 为正时，Clip 不再奖励把好动作概率提高到上界之外；当 Advantage 为负时，Clip 不再奖励把坏动作概率降低到下界之外。Clip 裁剪的是损失中的概率比，不是模型参数，也不是对策略概率的硬限制。

## 数据形式

### PPO

```text
固定Prompt集
  -> 在线Response
  -> old/reference logprobs
  -> rewards、values、returns、advantages、masks
```

### DPO

```text
prompt + chosen + rejected
```

### GRPO

```text
prompt + 可选solution/验证信息
  -> 在线生成G条completion
  -> G个reward
  -> 组内相对Advantage
```

## 选型

- 已有高质量 chosen/rejected 数据，希望训练简单且不做在线探索：DPO。
- 有成熟奖励系统，需要在线探索与 Token 级价值基线，且能承担复杂训练系统：PPO。
- 任务有可靠规则或程序验证器，同一 Prompt 能产生多种候选，希望避免训练 Critic：GRPO。

如果奖励或偏好无法准确代表最终任务，三种方法都会优化错误目标。选型之前应先验证奖励区分度、偏好一致性、采样多样性和独立评测集。

## Related

- [[differentiability-derivatives-gradients-backprop]]
- [[ppo-critic-td-error-gae]]
- [[llm-pretrain-data-engineering]]
