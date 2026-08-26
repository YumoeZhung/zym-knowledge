---
source: Codex conversation note on PPO, DPO, and GRPO optimization order
captured: 2026-08-26
type: note
---

# 按训练顺序理解大模型强化学习中的 Reward、Advantage 与 Loss

## 用户问题

用户熟悉传统神经网络中“构造一个 Loss，然后反向传播”的训练方式，但在学习 PPO、DPO、GRPO 时，容易把 Reward、Return、Value、Advantage、Policy Loss、Value Loss、KL 和熵都理解成并列的“优化函数”。用户希望按照一次模型强化学习训练实际发生的顺序，将这些概念串起来。

## 核心结论

PPO、DPO、GRPO 最终仍然都会构造可微 Loss，并执行 `loss.backward()`。Reward、Return、Value 和 Advantage 并不是都被优化的目标，而是从任务评价逐步加工成可微 Policy Loss 的中间信号。

传统监督学习：

```text
输入 -> 模型预测 -> 与标签比较 -> Loss -> 反向传播
```

在线大模型强化学习：

```text
Prompt
  -> Policy采样回答
  -> 奖励系统计算Reward
  -> Reward转换成Return和Advantage
  -> Advantage构造Policy Loss
  -> 加入Value Loss、KL、Entropy等
  -> backward更新参数
```

## 信号层级

1. **Reward**：外部系统评价回答最终有多好，通常不可微。
2. **Return**：从当前位置开始，未来 Reward 的折扣累计和。
3. **Value**：Critic 对当前状态未来 Return 的预测。
4. **Advantage**：实际 Return 相对 Value 基线好多少。
5. **Policy Objective**：应该提高还是降低已采样动作的概率。
6. **Policy Loss**：把 Policy Objective 写成可最小化、可反向传播的形式。
7. **辅助 Loss**：Value Loss、KL、Entropy 等稳定和约束目标。
8. **Total Loss**：按权重组合所有可微目标，执行反向传播。

## Reward、Return、Value 与 Advantage

轨迹上的 Return 为：

```text
G_t = r_t + gamma*r_{t+1} + gamma^2*r_{t+2} + ...
```

Value 表示从当前状态继续行动时的预期累计回报：

```text
V(s_t) = expected future return from s_t
```

Advantage 表示实际表现相对预期表现的差值：

```text
A_t = G_t - V(s_t)
```

- `A > 0`：已采样动作比预期好，应提高概率。
- `A < 0`：已采样动作比预期差，应降低概率。
- `A` 接近 0：和基线差不多，策略更新应较小。

最基础的策略梯度损失是：

```text
L_policy = -A_t * log pi_theta(a_t|s_t)
```

Reward 可以由规则、验证器、F1、单元测试或 Reward Model 得到，但这些评分过程通常不可微。Reward 通过 Advantage 乘到 `log probability` 上，才进入可微计算图并影响模型参数。

## PPO 的训练顺序

PPO 通常涉及 Policy、Critic、Old Policy、Reference Model 和冻结的奖励系统。

1. 保存本轮更新前的 Old Policy，或保存 rollout 时的逐 Token `old_logprob`。
2. Policy 根据 Prompt 在线生成回答，并记录动作、旧概率和 Critic 的 Value。
3. Reward Model、程序规则或验证器计算回答的原始 Reward。
4. 可选地加入相对 Reference Model 的逐 Token KL 代价。
5. 使用 Critic、TD 误差和 GAE 计算各位置的 Advantage。
6. 计算新旧策略概率比：

```text
ratio_t = pi_theta(a_t|s_t) / pi_old(a_t|s_t)
```

7. 构造 PPO clipped policy loss：

```text
L_policy = -E[min(ratio_t*A_t,
                  clip(ratio_t, 1-epsilon, 1+epsilon)*A_t)]
```

8. 使用实际 Return 作为监督标签训练 Critic：

```text
L_value = (V_psi(s_t) - G_t)^2
```

9. 组合总损失：

```text
L_total = L_policy
        + c_v*L_value
        + beta*L_KL
        - c_e*Entropy
```

10. 更新 Policy 和 Critic。一批 rollout 通常只训练少量 epoch，随后刷新 Old Policy 并重新采样。

因此 PPO 的多个 Loss 并不是重复优化同一件事：Policy Loss 更新行为策略，Value Loss 训练基线，KL 约束长期漂移，Entropy 防止策略过早失去探索。

## GRPO 的训练顺序

GRPO 保留 PPO 式 Policy 更新，但去掉 Critic：

1. 对同一个 Prompt 在线生成一组回答。
2. 使用规则、验证器或 Reward Model 分别计算原始 Reward。
3. 将组内 Reward 转换为相对 Advantage：

```text
A_i = (r_i - mean(r)) / (std(r) + epsilon)
```

4. 使用 Old Policy 概率比和 PPO 式 Clip 构造 Policy Loss。
5. 加入相对 Reference Model 的 KL 约束。
6. 只更新 Policy，不训练 Critic，因此没有 Value Loss。

组内标准化不是 Reward 函数本身，而是将已经得到的绝对评分转换成相对学习信号。如果同组回答 Reward 全部相同，Advantage 接近零，几乎没有有效策略梯度。

## DPO 的训练顺序

DPO 不是在线强化学习，不需要 rollout、显式 Reward、Critic、Return、Advantage、Old Policy 或 PPO Clip。它直接使用固定偏好对：

```text
(prompt, chosen, rejected)
```

1. Policy 计算 chosen 和 rejected 的序列 log probability。
2. Frozen Reference Model 计算同样两个回答的序列 log probability。
3. 计算两条回答相对 Reference 的偏好变化：

```text
Delta_chosen = log pi_theta(chosen|x) - log pi_ref(chosen|x)
Delta_rejected = log pi_theta(rejected|x) - log pi_ref(rejected|x)
```

4. 构造 DPO Logistic Loss：

```text
L_DPO = -log sigmoid(beta*(Delta_chosen - Delta_rejected))
```

5. 反向传播，只更新 Policy。

DPO 把奖励建模和策略优化压缩进偏好分类式 Loss 中。它可以被解释为学习隐式 Reward，但训练过程不显式计算 Reward 或 Advantage。

## 三者对比

| 阶段 | PPO | GRPO | DPO |
|---|---|---|---|
| 初始数据 | Prompt | Prompt | Prompt + chosen + rejected |
| 在线生成 | 是 | 是，同题多条 | 否 |
| 原始 Reward | 奖励模型、规则或验证器 | 奖励模型、规则或验证器 | 无显式 Reward |
| Value | Critic 预测 | 无 | 无 |
| Advantage | Critic + GAE | 组内标准化 | 无显式 Advantage |
| Old Policy | 有 | 有 | 无 |
| Policy Loss | PPO Clip | PPO 式 Group Clip | Logistic Preference Loss |
| Value Loss | 有 | 无 | 无 |
| Reference 约束 | 通常显式 KL | 通常显式 KL | 融入相对 Reference 的目标 |
| 更新模型 | Policy + Critic | Policy | Policy |

一句话总结：PPO 用 Critic 建立预期，再把 Reward 转成 Advantage；GRPO 用同题多回答的组内比较替代 Critic；DPO 跳过在线 Reward 和 Advantage，直接把偏好对写成可微 Loss。
