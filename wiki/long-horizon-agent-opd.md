---
title: 长轨迹 Agent 的 GRPO 信用分配与 On-Policy Distillation
created: 2026-08-31
last_updated: 2026-09-07
tags: [agent, credit-assignment, deepseek, distillation, glm, grpo, kl-divergence, long-horizon, on-policy-distillation, reinforcement-learning]
sources: [raw/2026-08-31-long-horizon-agent-opd.md, raw/2026-09-07-opd-full-vocabulary-clarifications.md]
---

# 长轨迹 Agent 的 GRPO 信用分配与 On-Policy Distillation

## 一句话理解

OPD（On-Policy Distillation，在线策略蒸馏）的核心是：**学生自己做题，教师在学生实际走到的位置指导下一步，再更新学生。**

它结合了“在学生自己的状态上学习”和“教师提供密集监督”。On-policy 说的是轨迹来自谁，不是某一种固定 KL 方向，也不等于必须取得全词表 logits。[来源：补充核验笔记][s2]

## 面试问题：长轨迹 GRPO 为什么难

对同一任务生成一组轨迹，用最终奖励计算相对优势：

$$
A_i=\frac{R_i-\operatorname{mean}(R)}{\operatorname{std}(R)+\epsilon}
$$

仅采用终局奖励的常见实现，会将同一个轨迹级优势用于该轨迹的多个生成位置：

- 全组奖励相同，组内优势为零，缺少这部分任务学习信号。
- 失败轨迹若低于组内平均，里面的正确尝试也可能受到负向更新。
- 成功轨迹若高于组内平均，无效绕路也可能被一并强化。
- 长任务可能更难探索到完整成功路径，且最终结果难以归因到具体动作。

注意，“失败”不必然等于负优势，仍取决于组内相对奖励；KL 等辅助项也可能继续产生梯度。奖励稀疏与信用分配是相关但不同的问题。[来源：面试讨论及本次澄清][s1][s2]

相关基础：[[llm-ppo-dpo-grpo-comparison]]、[[llm-rl-optimization-signal-pipeline]]。

## 你的阶段奖励思路是否正确

把任务拆成子目标并设置阶段奖励，是合理的 reward shaping 思路；过程监督与里程碑奖励是相关做法，但不是完全同义词。

难点是开放式任务存在多条正确路径，中间标注可能昂贵，固定里程碑也可能被投机利用。不能把面试官的反馈泛化为“过程奖励已经不用了”。有可靠自动验证器时，中间反馈仍然有价值。OPD 是利用教师提供另一类密集信号，不是证明阶段奖励无效。[来源：面试讨论；边界为整理者分析][s1][s2]

## OPD 怎么训练

1. 准备任务 prompt；Agent 任务还需要可交互环境和工具。
2. 当前学生生成回答或工具调用轨迹，保留错误尝试及真实工具返回。
3. 教师读取相同的历史前缀，在每个受监督的生成位置计算候选 token 概率。
4. 构造分布散度损失，或将教师/学生 logprob 差转成策略梯度信号。
5. 冻结教师，只更新学生；随后刷新学生轨迹。

这里的状态包含 prompt、此前生成内容和可见的环境反馈。教师不能偷看未来工具结果；通常只对模型生成位置计算损失，工具返回属于上下文。轨迹已知后，教师可以利用因果掩码批量评分，不代表必须每生成一个 token 就调用一次教师。[来源：补充核验笔记；mask/上下文部分为工程解释][s2]

### 与普通离线蒸馏的区别

离线蒸馏常让学生模仿教师生成的轨迹；OPD 让教师评价学生生成的轨迹。学生偏离标准路径后，训练仍覆盖这些实际遇到的状态。

类比：看高手下棋是离线模仿；自己下棋，只看最终输赢是终局奖励 RL；自己下棋，教练按当前棋局指导，是 OPD。教师是否能可靠指导错误状态，仍需验证。[来源：补充核验笔记][s2]

## Full-vocabulary logits 到底是什么意思

### 先区分 logits 与概率

模型最后一层 hidden state 经过输出头（unembedding / LM head），得到长度为词表大小的分数向量 \(z\)。这些分数叫 logits，经 softmax 才成为概率：

$$
p(v\mid s)=\frac{\exp(z_v/\tau)}
{\sum_{u\in V}\exp(z_u/\tau)}
$$

\(V\) 为词表，\(\tau\) 为温度。Full-vocabulary 指在同一个预测位置使用所有候选 token 的分布，而不是生成词表里每个 token 的后续轨迹。[来源：对话澄清与独立数学说明][s2]

### 四个 token 的例子

假设整个词表只有四个 token，温度为 1：

| 候选 token | 教师概率 \(p_T\) | 学生概率 \(p_S\) |
|---|---:|---:|
| 北京 | 0.70 | 0.30 |
| 上海 | 0.20 | 0.40 |
| 杭州 | 0.08 | 0.20 |
| 深圳 | 0.02 | 0.10 |

学生这次采到了“上海”。

**只取采样 token 的教师信号**：知道教师给上海 0.20，学生给它 0.40；教师/学生 logprob 差为 \(\log(0.20/0.40)\approx-0.693\)，可用来降低对此次选择的偏好。

**使用完整分布**：还知道教师最偏好北京，对杭州和深圳更不看好，能同时利用所有候选的相对偏好。

修正旧解释：单 token 损失也会通过 softmax 与共享参数改变其他 token，不是“只更新上海”。区别是有没有直接拿到其余候选的教师监督，而非其他候选是否产生梯度。表格是教学假设，不代表真实分词或实验测量。[来源：对话例子及数学澄清][s2]

## KL 方向：别把通用示例当成 DeepSeek 的公式

### 正向 KL：教师加权

$$
D_{\mathrm{KL}}(p_T\parallel p_S)
=\sum_{v\in V}p_T(v)\log\frac{p_T(v)}{p_S(v)}
$$

教师固定时，其对学生的梯度等价于软标签交叉熵：

$$
L_{\mathrm{CE}}=-\sum_{v\in V}p_T(v)\log p_S(v)
$$

在温度 1、固定状态下，对学生 logits 的梯度为 \(p_S-p_T\)。上例为 \([-0.40,0.20,0.12,0.08]\)：梯度下降提高北京 logit、降低另外三个。这是易懂的全分布监督演示，**不是 DeepSeek V4 反向 KL 的梯度公式**。[来源：本次独立数学说明][s2]

### 反向 KL：学生加权

$$
D_{\mathrm{KL}}(p_S\parallel p_T)
=\sum_{v\in V}p_S(v)\log\frac{p_S(v)}{p_T(v)}
$$

DeepSeek V4 此处采用这个方向。两个方向都以分布一致为最小值，但权重、梯度和优化偏好不同，不能直接互换。[来源：DeepSeek 报告核验及数学说明][s2]

典型的固定 rollout、逐位置蒸馏更新可写成：

$$
L(\theta)=\frac{1}{\sum_t m_t}
\sum_t m_t D_{\mathrm{KL}}
\left(p_\theta(\cdot\mid s_t)\parallel p_T(\cdot\mid s_t)\right)
$$

\(m_t\) 为生成位置 mask。轨迹先由学生采样，更新时把已采样前缀视作固定数据；通过学生概率反传，不对离散采样或环境本身反传。这是位置级蒸馏写法，不声称包含整个状态访问分布变化的全部梯度项。[来源：verl 核验及数学说明][s2]

## 为什么完整词表能降低方差

固定一个状态 \(s\)，若 \(a\sim p_S(\cdot\mid s)\)：

$$
\mathbb{E}_{a\sim p_S}
\left[\log p_S(a\mid s)-\log p_T(a\mid s)\right]
=D_{\mathrm{KL}}(p_S\parallel p_T)
$$

只采一个 token，得到的是随机估计。不同次可能采到北京或上海，信号会不同；全词表方法直接把各候选的贡献加权求和，消除这个固定状态下的 token 抽样噪声。

但 prompt、历史前缀、环境及 mini-batch 仍随机，所以不是“方差为零”或“必然收敛”。比较时还应控制目标、状态分布及计算预算。[来源：本次数学澄清；DeepSeek 报告提供其稳定性观察][s2]

### 抽样 KL 值不能直接当成正确梯度

抽样方法常使用：

$$
\hat A_t=\operatorname{sg}\left[
\log p_T(a_t\mid s_t)-\log p_{\mathrm{rollout}}(a_t\mid s_t)
\right]
$$

再作为策略梯度损失的权重；sg 表示停止梯度，必要时配合 importance ratio / clipping。它不是直接对采样后的 logprob 差做 backward：那样会漏掉离散采样分布相关的梯度项。

全词表精确 KL 可直接对学生分布反传。这是两条实现路径；不能把“采样值是无偏估计”误读成“直接对该值求导就得到正确的无偏梯度”。[来源：Thinking Machines / verl 核验及数学说明][s2]

## 它帮助长任务的原因与边界

OPD 不必只等终局的一个标量反馈，而能在学生自己的前缀上获得密集监督，减少只模仿教师轨迹的分布偏移。

但它学的是“教师在这个前缀下倾向怎么继续”，不是“这个 token 对最终成功贡献了多少”。教师也可能顺着错误前缀继续，或在异常工具状态下失效。逐 token 模仿不等于逐步骤的真实因果信用分配。[来源：面试讨论与补充核验][s1][s2]

## DeepSeek V4 与 GLM-5：用途及实现不同

| 维度 | DeepSeek V4 报告 | GLM-5 报告 |
|---|---|---|
| 教师来源 | 分别培养的领域专家 | 前序 SFT/RL 阶段 checkpoint |
| 主要用途 | 把专家能力统一到一个模型 | 恢复顺序训练中退化的能力 |
| 此处训练信号 | 完整词表反向 KL | 采样 token 的教师/学生 logprob 比替换 advantage |
| 是否替代所有 RL | 否，专家仍使用 SFT + GRPO | 否，仍有多个 RL 阶段 |

DeepSeek 报告使用十多个教师，按任务向相关专家学习，不表示每条样本都必须同时查询所有教师。它缓存教师最后一层 hidden states，训练时用对应 LM head 重建 logits，并按教师调度及使用专用 KL kernel 降低成本。

GLM-5 的跨阶段蒸馏中 group size 可为 1，因为 advantage 来自教师差异，不再需要组内奖励标准化。这不表示普通终局奖励 GRPO 用单样本就能正常计算组内相对优势。

本节仅归纳上述具体报告，不自动外推到所有后续 GLM/DeepSeek 版本；异步 rollout 的吞吐优化也不等于精细信用分配算法。[来源：既有讨论；本次对两个报告相关章节的核验][s1][s2]

## SFT、终局 GRPO 与 OPD 怎么选

| 方法 | 常见轨迹来源 | 学习信号 | 主要限制 |
|---|---|---|---|
| 离线 SFT / 序列蒸馏 | 人工或教师示范 | 目标 token 的交叉熵 | 学生错误状态覆盖不足 |
| 终局奖励 GRPO | 学生同题多条 rollout | 组内相对 outcome reward | 奖励同质化、长轨迹信用粗糙 |
| OPD | 学生 rollout | 教师概率差或分布散度 | 教师质量、访问能力与计算成本 |

这张表描述典型设置，不意味着所有 SFT 都是离线、所有 RL 都只有稀疏奖励。OPD 的 on-policy 属性与 full-vocabulary 属性是两个不同维度。[来源：对话与补充核验][s1][s2]

## 工程落地检查

- 教师是否真的强于学生，尤其在学生的错误状态上？
- 能否获取指定学生前缀的教师 logprobs，而不是只有教师自己生成回答的 logprobs？
- 全词表对齐需要兼容的 token 空间；不同 tokenizer 不能直接按 token ID 比较。
- 温度、chat template、特殊 token、工具协议、损失 mask 是否一致？
- 保存整个 \(B\times L\times |V|\) 概率张量成本很高，是否需要分块、重算或截断近似？
- 更新后是否刷新 rollout，并控制异步策略滞后？
- 是否在独立任务集上检查成功率、成本和能力回退，而不只看 KL 降低？

只有普通文本 API 时，通常无法直接复现完整词表 logits 蒸馏；可以做教师生成数据的序列蒸馏，但二者不能混称。[来源：核验笔记基础上的工程推论，不是特定服务的接口承诺][s2]

## 面试简答

> 长轨迹只给最终奖励，既有奖励稀疏，也有信用分配粗糙的问题。阶段奖励是合理思路，但开放式任务的逐步标注难扩展。OPD 让学生先生成自己的轨迹，再由教师在这些真实前缀上提供逐 token 监督，兼顾状态分布匹配与密集学习信号。DeepSeek V4 先用 SFT 和 GRPO 训练领域专家，再用完整词表反向 KL 做多教师能力融合；完整求和能减少当前位置的 token 采样噪声。它没有取代专家训练中的全部 RL，也不等于彻底解决长期因果信用分配。

## Sources

- [面试讨论原始归档][s1]
- [本轮 full-vocabulary 讲解、数学澄清及一手资料核验][s2]

[s1]: ../raw/2026-08-31-long-horizon-agent-opd.md
[s2]: ../raw/2026-09-07-opd-full-vocabulary-clarifications.md

## Related

- [[llm-ppo-dpo-grpo-comparison]]
- [[llm-rl-optimization-signal-pipeline]]
- [[ppo-critic-td-error-gae]]
- [[long-horizon-agent-drift-loop-control]]
