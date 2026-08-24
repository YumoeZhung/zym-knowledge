---
source: Codex conversation note on PPO Critic, TD error, and GAE
captured: 2026-08-24
type: note
---

# PPO 中的 Critic、TD 误差与 GAE

## 背景

PPO 全称 Proximal Policy Optimization，中文通常译为“近端策略优化”。它是通用的 On-policy Actor-Critic 算法。映射到大模型后：

- 状态：Prompt 加已经生成的 Token 前缀
- 动作：下一个 Token
- 策略：大语言模型
- 轨迹：一整段生成回答
- 奖励：Reward Model、人工规则或程序验证器的打分
- Critic：Value Model 或 Value Head
- 策略约束：PPO Clip 加相对 Reference Model 的 KL 惩罚

典型流程：Policy 生成回答，奖励系统打分，Critic 估计各生成位置的价值，GAE 计算 Advantage，PPO 再更新 Policy 和 Critic。

## PPO 的训练数据

传统 PPO 不以固定监督数据集为核心，而是由当前策略与环境交互生成 rollout。Rollout Buffer 常包含：

```text
(state, action, reward, done, old_logprob, value, return, advantage)
```

大模型 PPO 通常先准备 Prompt-only 数据，例如：

```json
{"prompt": "请解释为什么天空是蓝色的", "metadata": {"task": "science"}}
```

Policy 在线生成回答后，训练系统形成包含 Prompt Token、Response Token、旧策略逐 Token log probability、Reference Model log probability、Critic value、奖励、return、advantage 和 mask 的 rollout batch。Reward Model 的偏好对和 SFT 问答数据属于 PPO 之前的模型准备数据，不是 PPO 策略更新直接消费的主要数据格式。

## Critic 估计每个位置的价值

“每个位置”指每个生成 Token 对应的状态。Critic 读取 `Prompt + 当前回答前缀`，估计从这个状态继续按照当前策略生成，预计能获得的未来累计奖励：

```text
V(s_t) = 从当前前缀继续生成时的预计未来回报
```

它估计的不是某个 Token 脱离上下文后的独立质量，而是整个当前前缀的状态价值。实现上通常把每个 Token 的 Transformer hidden state 输入一个标量 Value Head。

## TD 误差

```text
delta_t = r_t + gamma * V(s_{t+1}) - V(s_t)
```

直观解释：执行动作后看到的“当前奖励加新预期”，减去执行前的旧预期。

- `delta_t > 0`：结果比原先预期更好
- `delta_t < 0`：结果比原先预期更差

例如 `V(s_t)=0.6`、`r_t=0`、`gamma=1`、`V(s_{t+1})=0.9`，则 `delta_t=0.3`。

## GAE

```text
A_t = delta_t + gamma*lambda*delta_{t+1}
    + (gamma*lambda)^2*delta_{t+2} + ...
```

GAE 不只使用当前一步的 TD 误差，还向后汇总后续 TD 误差；距离越远，权重越低。

- `gamma`：时间折扣，控制未来回报的重要性
- `lambda`：控制向后参考多远以及偏差与方差的平衡
- `lambda=0`：只使用一步 TD 误差，方差较低，但更依赖 Critic
- `lambda` 接近 1：参考更完整的后续结果，偏差通常较低，但方差更高

在大模型 PPO 中，中间 Token 的任务奖励往往为 0，完整回答结束后才加入整体奖励；如果使用逐 Token KL 惩罚，中间位置也可能存在负的 KL 奖励。

## 与 GRPO 的区别

PPO 使用 Critic 估计不同前缀的状态价值，再通过 GAE 形成 Token 位置上的 Advantage。GRPO 通常不训练 Critic，而是用同一 Prompt 下多条完整回答的组内相对奖励形成优势信号。
