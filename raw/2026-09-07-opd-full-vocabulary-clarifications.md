---
source: "当前对话：OPD 与 full-vocabulary logits 的解释及一手资料核验"
captured: 2026-09-07
type: conversation
title: "OPD：学生轨迹、完整词表监督与 KL 方向澄清"
---

# 来源与范围

用户要求把 OPD 相关知识整理到个人知识库。本次延续 2026-08-31 面试讨论，只整理 OPD，不扩展 RSI。
以下是对话整理及核验笔记，不是论文逐字原文；数值例子和推导为教学用构造。

## 用户关注的问题

面试中的长任务只给最终 reward，GRPO 的组内 advantage 难以提供足够细的信号。用户提出阶段奖励，随后确认面试官提到 OPD。
本轮追问：为什么比较教师和学生的整个词表分布，比只看学生采样 token 更稳定？

## 对话例子

假设词表只有北京、上海、杭州、深圳四个 token。
教师分布为 [0.70, 0.20, 0.08, 0.02]，学生分布为 [0.30, 0.40, 0.20, 0.10]。
学生采到上海，只取得这一项教师概率时，拿到的是一个抽样信号；完整分布还提供其余候选的教师偏好。
这些地名仅作为假想的单 token，不代表实际 tokenizer 的切分结果。

## 需要纠正的旧解释

- logits 是 softmax 前的分数，不是概率；KL 通常比较 softmax 后的分布。
- 此前的教师加权交叉熵对应 forward KL 的梯度，不是 DeepSeek V4 此处的 reverse KL。
- 单 token 损失也通过 softmax 归一化与共享参数影响其他 token；不能说其他 token 不更新。
- 固定前缀上的全词表精确求和消除了这一层 token 抽样噪声；任务、前缀、环境与 mini-batch 的随机性仍存在。
- token 概率不是环境奖励或动作价值；密集模仿不能保证正确的因果信用分配。
- OPD 不要求所有实现都取得全词表 logits；采样 token 和截断分布也是不同实现路径。

## 核验资料

### DeepSeek-AI：DeepSeek-V4 技术报告

- 类型：paper
- URL：https://arxiv.org/html/2606.19348v1
- 核验范围：5.1、5.1.2、5.2.2
- 结构化摘要：领域专家先由 SFT 与 GRPO 培养，再以多个教师向统一学生做 OPD；学生轨迹上使用 reverse KL。报告采用完整词表监督改善采样估计的方差与稳定性；缓存教师最后一层 hidden states，训练时通过对应输出头重算 logits，并按教师调度及使用专用 KL kernel 降低成本。

### Kevin Lu / Thinking Machines Lab：On-Policy Distillation

- 类型：article
- URL：https://thinkingmachines.ai/blog/on-policy-distillation/
- 日期：2025-10-27
- 核验范围：Implementation / Loss function / Pseudocode
- 结构化摘要：学生生成轨迹，教师计算已采样 token 的 log probability。教师与学生的 logprob 差经 stop-gradient 后作为逐 token 优势，配合策略梯度更新。教师评分可在已知轨迹上前向计算，无需逐 token 重新生成教师轨迹。

### verl：On-Policy Distillation 文档

- 类型：article（官方技术文档）
- URL：https://verl.readthedocs.io/en/latest/algo/opd.html
- 核验范围：定义、Loss Variants、Multi-Teacher OPD、teacher scoring
- 结构化摘要：区分直接分布散度反传与采样 token 的策略梯度蒸馏；更新时 rollout 视为固定数据。多教师可按样本领域路由，不要求每个教师评价每个样本。

### GLM-5 Team：GLM-5 技术报告

- 类型：paper
- URL：https://arxiv.org/html/2602.15763
- 核验范围：3.5
- 结构化摘要：前序 SFT/RL checkpoint 作为教师，在最终跨阶段蒸馏中恢复能力。公式 (2) 用停止梯度的教师/学生 logprob 比替换 advantage；此阶段 group size 可为 1，因为不依赖组内奖励统计。不能由“取得 logits”推断其与 DeepSeek 的完整词表 KL 实现相同。

## 独立数学推导说明

固定状态下，反向 KL 为 sum_v p_S(v) log[p_S(v)/p_T(v)]；
对学生采样 a，其 log 概率比是该 KL 的单样本值估计，但不能直接对抽样值求导冒充正确的 KL 梯度。
采样策略梯度需要 score-function 项；完整求和则可直接对学生分布反传。
正向 KL 的交叉熵梯度对学生 logits 为 p_S - p_T，用来说明“所有候选一起调整”，不应标成反向 KL 的梯度。
