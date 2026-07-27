---
title: "Program-as-Weights：把模糊函数编译成可复用权重"
created: 2026-07-27
last_updated: 2026-07-27
source: https://arxiv.org/abs/2607.02512
tags: [agent, edge-ai, evaluation, fuzzy-functions, hypernetwork, llm, lora, model-compilation, on-device, peft, small-model]
sources: [raw/2026-07-27-program-as-weights-fuzzy-functions.md]
---

# Program-as-Weights：把模糊函数编译成可复用权重

## 一句话理解

Program-as-Weights（PAW）的核心是：**不要让昂贵的大模型在每个请求上重新理解并执行任务，而是让一个神经编译器先把稳定的自然语言 specification 编译成一份 task-specific LoRA，再由冻结的本地小模型反复执行。**

这是一种 `compile once, run many times` 的 fuzzy-function programming。论文发表于 arXiv v1（2026-07-02）：[Paper](https://arxiv.org/abs/2607.02512)、[Project](https://programasweights.com)、[GitHub](https://github.com/programasweights)。

## 先用“紧急邮件分类”讲明白

需求是：

> 涉及当天截止、系统故障、安全风险或必须立即批准的邮件输出 `immediate`，其他输出 `routine`。

手写规则很脆弱：

```python
if "urgent" in email or "ASAP" in email:
    return "immediate"
```

- `Need your signature before 5pm.` 没有关键词，但很紧急；
- `Not urgent, handle it next week.` 包含 `urgent`，但不紧急；
- typo、中文、格式变化和间接表达会继续制造 edge cases。

每封邮件都调用一次大模型可以处理语义，却把成本、网络、隐私和 provider drift 放进每个请求的关键路径。

PAW 更像“请大师傅制作模具”：

- 4B compiler：制作模具的大师傅；
- 自然语言 specification：模具需求；
- pseudo-program + LoRA：编译出的模具；
- 0.6B interpreter：本地生产机器；
- 每封新邮件：重复进入机器的原料。

大模型只在 compile time 被调用一次。以后本地 interpreter 装载 LoRA，对不同邮件输出 `immediate` 或 `routine`。

## PAW program 到底是什么

形式上：

\[
p = \operatorname{Compiler}(s), \qquad
\hat y = \operatorname{Interpreter}(p, x) \approx f(x)
\]

- \(s\)：自然语言 specification；
- \(p\)：编译出的 neural program；
- \(x\)：runtime input；
- \(\hat y\)：预测输出。

实际 artifact 是两部分：

### 1. Discrete pseudo-program

off-the-shelf Qwen3-4B 把原始 specification 整理成更干净的任务说明和少量 examples：

```text
Task:
Classify an email as immediate or routine.

Examples:
"Please review this next week." -> routine
"Production is down; approval needed now." -> immediate
```

它类似传统编译器的 frontend normalization，也负责给 noisy specification 去噪。

### 2. Continuous LoRA

另一个经过训练的 Qwen3-4B LoRA compiler 读取原始 specification 和 pseudo-program。LoRA mapper 将 compiler hidden states 转成冻结 interpreter 的 task-specific LoRA parameters，注入 attention 和 MLP modules。

可以把它理解为：

- pseudo-program：写在纸上的操作说明；
- LoRA：直接改变机器内部响应方式的“技能卡带”；
- frozen Qwen3-0.6B：共享的游戏机或 runtime；
- 不同 PAW function：可 hot-swap 的不同卡带。

它不是每个任务重新 fine-tune，也不是生成一整套 base-model weights。通用 compiler 训练完成后，新 specification 只需一次 forward compilation。

## 训练：学习的不是一个函数，而是“如何造函数”

训练样本是：

```text
(specification, input, target output)
```

例如：

```text
spec: 判断消息是否需要立即响应
input: 数据库连接数已经达到上限
target: immediate
```

训练期间：

1. 冻结 pseudo compiler；
2. 冻结 0.6B interpreter；
3. LoRA compiler 和 mapper 生成 task-specific adapter；
4. adapter 注入 interpreter；
5. 根据 target token likelihood 反向传播；
6. gradient 穿过冻结 interpreter，更新 compiler 与 mapper。

因此它属于 text-conditioned hypernetwork / meta-learning：参数学习的是“看到任务描述后，应该生成怎样的参数”。

FuzzyBench 包含约 10M 个合成 examples、800 多个 task sub-categories。数据按 specification 做 80/10/10 切分，因此 test specification 在训练中不可见；verified test set 只保留 gpt-5.2 与 gpt-5-mini 对 target 一致的样本。

## 为什么需要文字和权重两条通道

只靠 prompt，0.6B 小模型对复杂 specification 的理解能力有限；只靠 opaque weights，又丢失了可读的任务描述。

PAW 的组合是：

```text
原始 specification
        │
        ├── pseudo compiler ──> clean pseudo-program ──────┐
        │                                                   │
        └── LoRA compiler + mapper ──> task-specific LoRA ─┤
                                                            ↓
runtime input ───────────────────────────────> frozen interpreter ──> output
```

pseudo-program 还承担 specification denoising。论文中 combined heavy noise 相对 clean 下降 3.7 percentage points；在 heavy typo 下，pseudo-program 路径比把 raw spec 直接送给 interpreter 高 4.5 points。

## 结果应该怎样客观看

FuzzyBench exact match：

| 方法 | Accuracy |
|---|---:|
| Direct prompting Qwen3-0.6B | 9.84% |
| Fixed LoRA，最好结果 | 52.10% |
| Full fine-tuning Qwen3-0.6B | 58.40% |
| Direct prompting Qwen3-32B | 68.70% |
| **PAW Qwen3-0.6B** | **73.78%** |
| Direct prompting gpt-oss-20B | 85.45% |
| gpt-5-mini API | 91.87% |
| gpt-5.2 API | 96.09% |

真正成立的结论是：**在作者的 held-out fuzzy-function distribution 上，编译后的 0.6B specialist 超过了直接 prompting 的 Qwen3-32B，并显著超过同 base 的 fixed LoRA 和 full fine-tuning baseline。**

不能据此推出：

- 0.6B PAW 全面战胜大模型；
- 所有真实业务 fuzzy tasks 都有 73.78%；
- PAW 已经能够替代 general Agent；
- 合成数据上的 exact match 等于真实生产 tail-risk。

本地部署结果显示，量化 base 约 430–623 MB，每个 Q4_0 adapter 约 23 MB；MacBook M3 Metal 上报告 31.6 tokens/s、0.48 s cold load。它用存储和 compile-time cost 换取更低的 per-call compute、离线性与稳定版本。

## 与几种常见方案的区别

| 方案 | 每次请求做什么 | 优点 | 主要代价 |
|---|---|---|---|
| 手写规则 / regex | 执行确定性代码 | 快、可审计 | 难覆盖语义和噪声 |
| LLM API prompting | 大模型每次重新理解任务 | 灵活、能力上限高 | 成本、网络、隐私、版本漂移 |
| Per-task fine-tuning | 为每个任务迭代训练 | 可获得强 specialist | 慢、数据和 GPU 成本高 |
| 固定 prompt + 小模型 | 本地模型读取 prompt | 简单、artifact 小 | 小模型可能读不懂复杂 spec |
| **PAW** | compiler 一次生成 adapter，小模型重复执行 | 摊薄成本、本地、可版本化 | adapter 不透明、任务边界有限 |

与 [[skillopt-self-evolving-agent-skills]] 也有一个有用对照：

- SkillOpt 把可读的 `SKILL.md` 当作可训练外部参数，通过 rollout 和 validation gate 迭代文本；
- PAW 把 fuzzy function 编译成 pseudo-program + opaque LoRA，由小模型执行；
- 前者偏 procedure optimization 和审计，后者偏 inference amortization 和 on-device specialization。

## 放进 Agent Harness 的正确位置

PAW 更适合成为 Agent 的廉价 fuzzy perception / routing layer，而不是替代整个 Agent：

```text
user request
    ↓
PAW: needs tool?
    ↓
PAW: route to which tool?
    ↓
PAW: extract location / ticker / query
    ↓
deterministic code: permission + schema validation + state machine
    ↓
tool execution
```

论文的 ToolCall-15 案例使用 10 个 PAW functions，而 multi-turn state、date/time regex 和 `tool_calls` JSON 都由普通 Python 负责。这与 [[agent-system-architecture]] 的边界一致：让模型处理模糊语义，让 Harness 负责确定性控制、状态和安全。

## 最适合与最不适合的任务

适合：

- specification 稳定且调用频繁，compile cost 能被摊薄；
- short-input / short-output classification、triage、reranking、extraction；
- 需要 offline、locality 或固定 artifact version；
- 有可靠 held-out cases 和自动 verifier；
- 允许统计错误，并有 fallback 或人工复核。

不适合直接使用：

- 权限、计费、合规 gate、精确数学等必须 deterministic 的逻辑；
- specification 高频变化或每个函数只调用少数几次；
- long-horizon planning、复杂多轮 Agent reasoning；
- 长文生成和 context-budget 紧张的任务；
- 必须逐条解释决策原因的高风险场景。

## 论文局限与工程风险

1. **Compiler–interpreter coupling**  
   每个 interpreter family 需要对应训练的 compiler，不能把为 Qwen3-0.6B 生成的 LoRA 任意搬到另一模型。

2. **Opaque neural binary**  
   pseudo-program 可读，但 LoRA 不透明。传统 source diff、static analysis 和单步 debugger 不能直接解释权重行为。

3. **只验证 single-step functions**  
   one-input-one-output 不等于 long-horizon reasoning；case study 中的多步组合主要由外部 Python 编排。

4. **Synthetic-data dependence**  
   FuzzyBench 主要由 gpt-5.2 生成。held-out specification 和 model-agreement filtering 降低了泄漏与标签歧义，但不能代替真实业务分布验证。

5. **PEFT choice 仍需实验**  
   LoRA 在文本和 diagram classification 上更强；prefix-tuning 在部分 long-form structured generation 上更强，目前没有通用选择原则。

6. **Artifact lifecycle 成本**  
   每个 program 约 23 MB，需要 versioning、compatibility、cache eviction、rollback、security scanning 和 interpreter upgrade migration。

## 面向生产的最低验证合同

当前证据状态：**generalized-candidate**，不是 production-ready。

要在真实业务中升级状态，至少需要：

1. **Original repro**：已知 fuzzy cases 改善，只能证明 repro-fixed。
2. **Changed-case**：替换实体、语言、格式、表达方式和输入长度。
3. **Negative/adversarial**：否定句、诱导关键词、冲突信号、typo、prompt-like input、边界类别。
4. **Out-of-contract**：超长输入、新类别、需要确定性保证的请求必须拒绝、fallback 或转交大模型。
5. **Calibration 与 tail risk**：不能只看平均 exact match；还要看 false-positive/false-negative cost、confidence、worst slices。
6. **系统指标**：compile latency、cache hit rate、adapter load latency、并发 hot-swap、内存、磁盘和 end-to-end total cost。
7. **Lifecycle**：spec、pseudo-program、adapter、interpreter build 和 evaluation report 必须作为一个可回滚版本单元。

这与 [[claw-swe-bench-harness-evaluation]] 的原则一致：真实实验对象不是单独的 model，而是 `compiler × program artifact × interpreter × harness × task distribution × budget`。

## 核心判断

PAW 最值得关注的不是“LoRA 又多了一种生成方式”，而是把 foundation model 从在线请求路径中的 solver，移动到 compile-time 的 tool builder。

它的未来价值取决于一个经济学条件：

\[
\text{一次 compilation 成本} + N \times \text{小模型执行成本}
<
N \times \text{大模型在线调用成本}
\]

当 \(N\) 足够大、任务边界稳定、错误可验证和兜底时，PAW 很有吸引力；当任务低频、快速变化、高风险或需要开放式推理时，直接调用强模型或使用 symbolic logic 的未来总成本可能更低。此前是否已经投入 PAW 不应进入选择依据。

## Related

- [[agent-system-architecture]] — model、runtime、tool、state 与 verifier 的系统边界
- [[skillopt-self-evolving-agent-skills]] — 可读文本参数的优化与 validation gate
- [[claw-swe-bench-harness-evaluation]] — 把完整执行系统作为实验单元
- [[building-self-improving-agents]] — 执行、验证、修正闭环
