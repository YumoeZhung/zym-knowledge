---
title: 大模型强化学习优化链：从 Reward 到 Loss
created: 2026-08-26
last_updated: 2026-08-31
tags: [advantage-estimation, dpo, grpo, llm, optimization, policy-gradient, ppo, reinforcement-learning, reward-modeling]
sources: [raw/2026-08-26-llm-rl-optimization-signal-pipeline.md, raw/2026-08-31-long-horizon-agent-opd.md]
---

# 大模型强化学习优化链：从 Reward 到 Loss

PPO、DPO 和 GRPO 最终都没有脱离传统神经网络训练范式：最后仍然要得到一个可微 Loss，执行 `backward()`，再由优化器更新参数。容易混淆的原因是，强化学习在 Loss 之前增加了“采样、评价、建立基线、估计优势”这条信号加工链。

```text
监督学习：输入 -> 预测 -> 标签误差 -> Loss -> 梯度

在线强化学习：Prompt -> 采样回答 -> Reward
             -> Return/Value/Advantage
             -> Policy Loss + 辅助Loss -> 梯度
```

## 先区分哪些量会被优化

| 概念 | 回答的问题 | 是否直接反向传播 |
|---|---|---:|
| Reward | 完整回答最终有多好 | 否，通常来自外部评价 |
| Return | 从当前位置往后的累计 Reward 是多少 | 否，是计算结果 |
| Value | 从当前状态出发预计能得到多少 Return | 是，PPO 用 Value Loss 训练 Critic |
| Advantage | 实际表现比基线好多少 | 否，是 Policy Loss 的权重 |
| Policy Loss | 哪些动作概率应该升高或降低 | 是 |
| KL Loss | Policy 是否偏离 Reference 太远 | 是 |
| Entropy | 策略是否过早失去探索性 | 作为正则项参与反向传播 |

因此，“Reward、Advantage 和 Loss”不是三个并列优化目标：

```text
Reward提供外部评价
  -> Advantage校正评价基线
  -> Policy Loss把评价转成可微梯度
```

## 通用的信号加工顺序

### 1. Policy 采样动作

大模型把每个 Token 看作一个动作：

```text
state s_t = Prompt + 已生成前缀
action a_t = 下一个Token
policy pi_theta(a_t|s_t) = Token概率
```

Policy 需要先实际采样出回答，奖励系统才知道这次行为好不好。

### 2. 外部系统计算 Reward

Reward 可以来自人类偏好训练出的 Reward Model，也可以来自 F1、格式校验、数学答案、代码测试等程序验证器。它评价任务结果，但通常不在 Policy 的可微计算图中。

### 3. Reward 累积成 Return

```text
G_t = r_t + gamma*r_{t+1} + gamma^2*r_{t+2} + ...
```

大模型任务常在回答结束后才产生主要奖励；如果加入逐 Token KL 代价，中间位置也会出现奖励或惩罚。

### 4. 用基线得到 Advantage

```text
A_t = G_t - baseline
```

Advantage 不只问“分数高不高”，而是问“相对于这个状态或这组回答的正常水平，这次表现是否更好”。

- 正 Advantage：提高已采样动作概率。
- 负 Advantage：降低已采样动作概率。
- 接近零：少更新。

PPO、GRPO 的核心区别之一，就是 baseline 的来源不同：PPO 使用 Critic，GRPO 使用同一 Prompt 下其他回答的组内统计。

### 5. Advantage 进入 Policy Loss

最基础的策略梯度形式是：

```text
L_policy = -A_t * log pi_theta(a_t|s_t)
```

Reward 本身即使不可微，也能通过 Advantage 充当 `log probability` 的权重，进入可微 Loss。

### 6. 加入稳定和约束目标

实际训练通常还需要：

- Value Loss：训练 Critic 的预测能力。
- PPO Clip：限制一轮更新相对 Old Policy 的幅度。
- Reference KL：限制长期偏离初始 SFT 模型。
- Entropy：避免策略过早变得过于确定。

这些目标服务于不同模块，不能简单理解成“多个 Loss 都在争着优化回答质量”。

## PPO：Reward 经 Critic 和 GAE 进入 Loss

PPO 的一次训练循环是：

```text
1. 保存Old Policy或rollout时的old_logprob
2. Policy在线生成回答
3. Reward Model或验证器打分
4. Critic预测各Token位置的Value
5. TD误差和GAE估计Advantage
6. 新旧概率比 + Clip构造Policy Loss
7. Return作为标签构造Value Loss
8. 加入Reference KL和Entropy
9. 更新Policy与Critic
10. 刷新rollout并进入下一轮
```

PPO 概率比：

```text
ratio_t = pi_theta(a_t|s_t) / pi_old(a_t|s_t)
```

PPO Policy Loss：

```text
L_policy = -E[min(ratio_t*A_t,
                  clip(ratio_t, 1-epsilon, 1+epsilon)*A_t)]
```

Critic 的监督损失：

```text
L_value = (V_psi(s_t) - G_t)^2
```

总损失可以概括为：

```text
L_total = L_policy
        + c_v*L_value
        + beta*L_KL
        - c_e*Entropy
```

这里真正有两个被训练的对象：Policy 通过 Policy Loss 更新，Critic 通过 Value Loss 更新。Critic、TD 误差和 GAE 的细节见 [[ppo-critic-td-error-gae]]。

## GRPO：用组内相对奖励替代 Critic

GRPO 的前半段与 PPO 不同，后半段仍接近 PPO 式策略更新：

```text
1. 同一个Prompt生成G条回答
2. 分别计算原始Reward
3. 组内标准化得到Advantage
4. 使用Old Policy概率比和Clip构造Policy Loss
5. 加入Reference KL
6. 只更新Policy
```

常见组内优势为：

```text
A_i = (r_i - mean(r)) / (std(r) + epsilon)
```

组内标准化不是 Reward 函数，而是把绝对 Reward 转换成相对 Advantage。如果一组回答 Reward 相同，Advantage 接近零，几乎没有有效策略学习信号。

GRPO 没有 Critic 和 Value Loss，但同一 Prompt 需要多次生成，rollout 成本依然可能很高。对于长轨迹 Agent，若只用最终 reward，整条轨迹的动作还可能共享过于粗糙的信用信号；OPD如何在学生自己的轨迹状态上提供逐 Token 教师分布，见 [[long-horizon-agent-opd]]。

## DPO：跳过显式 Reward 和 Advantage

DPO 不遵循上面的在线 rollout 流水线。它使用固定偏好对：

```text
(prompt, chosen, rejected)
```

训练顺序是：

```text
1. Policy计算chosen/rejected的序列log probability
2. Reference计算同样两条回答的序列log probability
3. 计算两条回答相对Reference的偏好变化
4. 构造DPO Logistic Loss
5. 只更新Policy
```

```text
Delta_w = log pi_theta(chosen|x) - log pi_ref(chosen|x)
Delta_l = log pi_theta(rejected|x) - log pi_ref(rejected|x)

L_DPO = -log sigmoid(beta*(Delta_w - Delta_l))
```

DPO 可以解释为隐式学习 Reward，但工程训练中没有显式 Reward、Return、Value、Advantage、Old Policy 或 PPO Clip。它把“偏好评价”和“策略更新”合并成一个接近二分类的可微目标。

## 三条完整优化链

```text
PPO
Prompt -> rollout -> Reward -> Return
      -> Critic/GAE Advantage
      -> PPO Clip Loss + Value Loss + KL + Entropy
      -> 更新Policy和Critic

GRPO
Prompt -> G条rollout -> G个Reward
      -> 组内相对Advantage
      -> PPO式Clip Loss + KL
      -> 更新Policy

DPO
prompt/chosen/rejected
      -> Policy与Reference序列概率差
      -> DPO Preference Loss
      -> 更新Policy
```

## 最小对比表

| 阶段 | PPO | GRPO | DPO |
|---|---|---|---|
| 在线生成 | 是 | 是，同题多条 | 否 |
| 显式 Reward | 有 | 有 | 无 |
| Value/Critic | 有 | 无 | 无 |
| Advantage | Critic + GAE | 组内标准化 | 无显式 Advantage |
| Old Policy | 有 | 有 | 无 |
| 核心 Loss | PPO Clip | PPO 式 Group Clip | Logistic Preference Loss |
| Value Loss | 有 | 无 | 无 |
| Reference 约束 | 通常显式 KL | 通常显式 KL | 融入偏好目标 |
| 更新对象 | Policy + Critic | Policy | Policy |

一句话记忆：PPO 用 Critic 建立“预期”，GRPO 用同题其他回答建立“组内基线”，DPO 则直接把 chosen 优于 rejected 写进 Loss。

## Related

- [[llm-ppo-dpo-grpo-comparison]]
- [[ppo-critic-td-error-gae]]
- [[differentiability-derivatives-gradients-backprop]]
- [[long-horizon-agent-opd]]
