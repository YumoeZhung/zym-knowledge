---
title: PPO 中的 Critic、TD 误差与 GAE
created: 2026-08-24
last_updated: 2026-08-24
tags: [advantage-estimation, critic, gae, llm, ppo, reinforcement-learning, td-learning]
sources: [raw/2026-08-24-ppo-critic-td-error-gae.md]
---

# PPO 中的 Critic、TD 误差与 GAE

PPO 全称 **Proximal Policy Optimization**，中文通常译为“近端策略优化”。“近端”表示新策略每次只在旧策略附近更新，避免单次变化过大。

PPO 的核心不是直接用最终奖励更新整段动作，而是借助 Critic 建立基准，再用 Advantage 表示某个动作相对于预期究竟好多少。对于大模型，一条回答可以视为一条轨迹，每生成一个 Token 就发生一次状态转移。

## 从文本生成映射到强化学习

| 强化学习概念 | 大模型中的对应物 |
|---|---|
| 状态 `s_t` | Prompt 加当前回答前缀 |
| 动作 `a_t` | 下一个 Token |
| 策略 `pi(a_t\|s_t)` | Policy LM 的 Token 概率分布 |
| 轨迹 | 一整段生成回答 |
| 状态价值 `V(s_t)` | 从当前前缀继续生成的预计未来回报 |
| 最终奖励 | Reward Model、规则或程序验证器打分 |

## PPO 的训练数据长什么样

PPO 是 On-policy 算法，它的核心训练数据通常不是预先固定的标准答案，而是当前策略与环境交互产生的 rollout。

传统 PPO 的一条 rollout transition 通常包含：

```text
(state, action, reward, next_state, done,
 old_logprob, value, return, advantage)
```

其中 `old_logprob` 用来计算新旧策略概率比，`value`、`return` 和 `advantage` 用来训练 Critic 和 Policy。多条连续 transition 共同构成 trajectory 或 rollout batch。

### 大模型 PPO 的两层数据

训练前准备的通常是 Prompt-only 数据集：

```json
{
  "prompt": "请解释为什么天空是蓝色的",
  "metadata": {"task": "science"}
}
```

有些任务还会附带参考答案、验证信息或难度标签，但 Policy 不一定直接模仿参考答案。

训练过程中，Policy 为 Prompt 在线生成回答，系统再构造 rollout batch：

```text
prompt_input_ids
response_input_ids
attention_mask / response_mask
old_logprobs          # 旧策略对每个回答Token的log probability
reference_logprobs    # Reference Model的log probability，用于KL
values                # Critic对各生成位置的价值预测
rewards               # 最终任务奖励以及可能的逐Token KL代价
returns               # 各位置的目标累计回报
advantages            # 通常由GAE计算
```

因此，大模型 PPO 的数据流是：

```text
固定Prompt集
   -> 当前Policy在线生成Response
   -> Reward Model或验证器打分
   -> Critic和GAE计算Value、Return、Advantage
   -> 形成短期Rollout Buffer
   -> PPO更新若干轮后丢弃或刷新旧Rollout
```

需要区分三个阶段的数据：

| 阶段 | 常见数据格式 | 作用 |
|---|---|---|
| SFT | `prompt + 标准回答` | 初始化Policy |
| Reward Model | `prompt + chosen + rejected` | 学习偏好奖励 |
| PPO | Prompt集 + 在线生成的rollout | 更新Policy和Critic |

PPO通常不会在策略更新阶段直接把 `chosen/rejected` 当作训练样本；偏好对主要用于先训练 Reward Model。由于它是 On-policy 算法，旧 rollout 在策略更新后会逐渐失效，通常只能训练少量 epoch，随后必须重新采样。

## Critic 估计的是状态价值

Critic 在每个生成位置读取 `Prompt + 当前回答前缀`，输出一个标量：

```text
V(s_t) = 从当前状态继续按照当前策略行动时，预计得到的未来累计回报
```

它不是脱离上下文评价某个 Token 本身。更准确地说，它评价的是生成这个 Token 后形成的新前缀状态。常见实现是在 Transformer 每个 Token 的 hidden state 后增加一个 `hidden_size -> 1` 的 Value Head，也可以使用单独的 Value Model。

Critic 的作用是提供基准。最终奖励为 1，并不意味着整段回答里的所有 Token 都同样优秀；需要比较实际结果和每个位置原本的预期。

## TD 误差：新观察减去旧预期

一步 TD 误差为：

```text
delta_t = r_t + gamma * V(s_{t+1}) - V(s_t)
```

| 符号 | 含义 |
|---|---|
| `V(s_t)` | 执行动作前对未来回报的预测 |
| `r_t` | 当前状态转移立即得到的奖励 |
| `V(s_{t+1})` | 执行动作后对剩余未来回报的新预测 |
| `gamma` | 对未来回报的折扣 |
| `delta_t` | 新观察相对旧预期的误差 |

因此可以把它记为：

```text
TD误差 = 当前奖励 + 折扣后的新预期 - 旧预期
```

例如：

```text
V(s_t) = 0.6
r_t = 0
gamma = 1
V(s_{t+1}) = 0.9

delta_t = 0 + 1 * 0.9 - 0.6 = 0.3
```

正值说明这次状态转移使前景比原先预期更好；负值说明比预期更差。

## GAE：汇总当前及后续的 TD 误差

GAE（Generalized Advantage Estimation）定义为：

```text
A_t^GAE = delta_t
        + gamma*lambda*delta_{t+1}
        + (gamma*lambda)^2*delta_{t+2}
        + ...
```

当前动作的影响可能不会立即表现出来，因此 GAE 会参考后续 TD 误差。但越远的结果越可能受到后续动作影响，所以使用指数衰减权重。

两个系数承担不同职责：

- `gamma`：任务本身对远期回报的折扣。
- `lambda`：优势估计的偏差—方差折中，控制信用向后传播多远。

| `lambda` | 信息来源 | 典型性质 |
|---:|---|---|
| `0` | 只使用当前一步 TD 误差 | 方差低，但高度依赖 Critic 的准确性 |
| `0` 到 `1` | 加权使用多步 TD 误差 | 在偏差与方差之间折中 |
| 接近 `1` | 接近使用完整后续回报 | 对 Critic 偏差依赖较低，但方差更高 |

例如当 `gamma=1`、`lambda=0.95` 时，当前及后续误差的权重依次为：

```text
1, 0.95, 0.9025, 0.8574, ...
```

## 大模型中的奖励位置

开放式回答的任务奖励通常在序列结束后才产生：

```text
r_0 = 0, r_1 = 0, ..., r_final = 整体回答奖励
```

如果加入相对 Reference Model 的 KL 惩罚，中间位置也可以有逐 Token 信号：

```text
r_t^KL = -beta * 当前 Token 的 KL 代价
```

最终位置再加入完整回答奖励。Critic 和 GAE 负责把这些稀疏、延迟的信号转换成各生成位置上的 Advantage。

## GAE解决的核心矛盾

只用完整回报更新所有 Token，估计方差很大；只用一步 TD，又会过度依赖 Critic。GAE在两者之间插值：

```text
更依赖Critic、方差更低  <--- lambda --->  更依赖真实后续回报、方差更高
```

需要注意，GAE并不能严格证明最终奖励由哪个 Token“导致”。它提供的是基于价值预测的信用分配估计，而不是因果归因。

## PPO与GRPO的关键区别

| 维度 | PPO | GRPO |
|---|---|---|
| 基准来源 | Critic预测的状态价值 | 同一Prompt下其他回答的奖励 |
| 优势粒度 | 根据各Token位置的价值和GAE计算 | 通常由整条回答的组内相对奖励得到 |
| 是否训练Critic | 是 | 通常否 |
| 主要代价 | Value Model训练和显存 | 同一Prompt需要多次生成 |

## 记忆方式

```text
Critic：当前前缀未来大概能得多少分？
TD误差：做完这一步后，新情况比旧预期好多少？
GAE：把当前和后续惊喜加起来，但越远权重越低。
Advantage：当前动作最终比基准好多少？
```

## Related

- [[llm-pretrain-data-engineering]]
