---
title: "SkillOpt：把 SKILL.md 当作可训练参数"
created: 2026-07-14
last_updated: 2026-07-14
source: https://arxiv.org/abs/2605.23904
tags: [agent, agent-skill, evaluation, harness, microsoft-research, prompt-optimization, self-improving, text-optimization]
sources: [raw/2026-07-14-skillopt-self-evolving-agent-skills.md]
---

# SkillOpt：把 SKILL.md 当作可训练参数

## 一句话理解

SkillOpt 的核心不是“让 Agent 多反思几次”，而是：**冻结做任务的模型，把自然语言 `SKILL.md` 当作可训练的外部参数，再用批量执行证据、受限文本 edit、独立 validation gate 和负反馈记忆，像训练模型一样训练这份 procedure。**

论文与代码来自 Microsoft 等机构的联合团队：[arXiv v2](https://arxiv.org/abs/2605.23904)、[Microsoft Research](https://www.microsoft.com/en-us/research/publication/skillopt-executive-strategy-for-self-evolving-agent-skills/)、[Project Page](https://microsoft.github.io/SkillOpt/)、[GitHub](https://github.com/microsoft/SkillOpt)。

## 先用一个例子讲明白

假设我们有一个“修改 Excel 文件”的 Agent。它已经会调用 Python 和 `openpyxl`，但在一批任务里反复犯错：

- 只看 preview，没检查真实 workbook 的 sheets、headers 和公式；
- 只填了几行，漏掉 target range 中原本为空的行；
- 写入 Excel formula，但 grader 不会重算 workbook，因此读取到空值；
- 改完没重新打开文件验证边界行和残留空白。

传统做法可能是：看到第一个失败，就让 LLM 重写整份 prompt。这样很容易把“修这个 case”写成固定 sheet 名、固定列名或某个业务值，也可能删掉原先有效的格式保护规则。

SkillOpt 的做法更像训练：

1. 先让目标 Agent 跑一批不同 workbook，保存 messages、tool calls、文件操作、最终答案和 verifier score。
2. 把失败与成功分开，再按 minibatch 分组。只有多个 workbook 都出现的共性，才有资格进入候选规则。
3. optimizer model 提出局部 edits，例如：
   - “先检查真实 workbook 结构，再确定 target range”；
   - “如果 scorer 读取 cached values，就写入已计算的静态值”；
   - “保存后重新打开，检查首尾行和未填空白”。
4. textual learning rate 假设为 2，则这一轮最多选两个高价值 edits，而不是整篇重写。
5. 在一组 optimizer 没见过的 selection workbooks 上测试新 skill：旧版本成功 6/10，新版本 8/10，才接受。
6. 下一项 edit 如果让成绩从 8/10 降到 7/10，就拒绝，并记录“这项修改在什么错误模式上造成了退化”，供后续 optimizer 避免重犯。
7. 多个 epoch 后，再比较相同任务在旧、新 skill 下的变化，把长期稳定的规律写进 slow update。

最终上线的不是整套训练日志，而只是一份小型 `best_skill.md`。论文中的真实 SpreadsheetBench 案例学到的规则与上述例子相近：从通用表格操作，逐步变为先做 workbook forensics、填完整目标范围、按 scorer 行为写入 evaluated values、保存后复查的明确 procedure。

## 完整方法：八步闭环

### 0. 先把数据分成三份

| Split | 用途 | 禁止事项 |
|---|---|---|
| train | 产生 trajectories，供 optimizer 找规律 | 不能据此直接宣称泛化 |
| selection | 每次 candidate skill 的 acceptance gate | 不能把它混进 train |
| test | 训练完成后只做最终报告 | 不能参与 edit 决策 |

这是方法可信度的地基。没有独立 selection gate，“反思”只是模型对自己提议的自我认可；没有 untouched test，selection score 也不能代表最终泛化。

### 1. Forward pass：批量执行，收集真实轨迹

冻结的 target model 使用当前 skill 执行 train tasks。Harness 需要记录的不只是 final answer，还包括 task metadata、messages、tool calls、observations、command outputs、verifier feedback，以及表格预览、文档引用等 domain context。

这里的关键是 **runtime evidence**。只看最终答案无法判断 Agent 是检索错、工具调用错、状态管理错，还是格式错。

### 2. Backward pass：失败和成功分开反思

- failure minibatches：找跨多个失败反复出现的 procedure gap；
- success minibatches：找应该保留的有效行为，防止修复时造成回归。

单条 trajectory 容易诱发 case fitting；minibatch 要求 optimizer 提取“共同失败模式”，并明确禁止 hardcode task-specific values。

### 3. 只产生结构化局部 edits

optimizer 输出可解析的 `append`、`insert_after`、`replace`、`delete` 操作。不同 minibatches 的建议会先分别聚合，再去重、消除冲突，并以 failure correction 为优先级做最终 merge。

局部 edit 的价值不只是节省 token，更重要的是维持相邻 skill versions 的可比性：我们能知道到底改了什么、为什么升降分，以及回退哪一项。

### 4. Textual learning rate：限制一次能改多少

SkillOpt 把每一步允许应用的最大 edit 数量记作 textual learning rate。它支持 constant、linear、cosine 和 autonomous schedule；论文默认使用前期较大、后期逐渐收敛的 cosine schedule。

这只是与 gradient descent 的功能类比，并不存在可微 gradient。它控制的是**文本参数每一步移动的半径**：

- 太大：一次重写过多，容易覆盖有效规则，因果归因也变差；
- 太小：稳定但收敛慢，可能无法一次表达完整 procedure；
- 逐步衰减：前期探索，后期整理和固化。

### 5. Validation gate：只接受实测更好的版本

candidate skill 必须在 selection split 上严格优于 current skill 才能被接受，平分也拒绝。若同时超过历史最佳，就更新 `best_skill.md`。

这一步把“听起来合理的建议”变成“propose-and-test optimization”。optimizer model 只负责提案，没有权力自行宣布成功。

### 6. Rejected-edit buffer：把失败尝试变成负反馈

被拒绝的 edit 不会部署，但会记录其对应 failure pattern 和 selection score drop。在同一 epoch 的后续 reflection 中，optimizer 会看到这份 buffer，知道哪些方向已经实测有害。

它类似优化过程中的负梯度信号，但仍是自然语言经验，不是数学 gradient。训练记忆与部署记忆分离，避免把所有试错历史塞进最终 skill。

### 7. Slow update 与 meta skill：跨 epoch 看长期规律

fast edits 看当前 batch；slow update 在 epoch 结束时，用相同 tasks 比较前后两个 skill，将轨迹分为：

- improvements；
- regressions；
- persistent failures；
- stable successes。

optimizer 据此生成受保护的 longitudinal guidance，而且该更新仍需通过 validation gate。meta skill 则只保存在 optimizer 侧，归纳“哪类 edit 有效、哪类被拒、哪些问题一直存在”，用于未来的 reflection、merge 和 ranking。

可以把二者理解为：slow update 保存写给 target agent 的稳定长期 procedure；meta skill 保存写给 optimizer 自己的“如何更好地改 skill”的经验。

### 8. Export：部署只带最佳 skill

上线时 target model、backend 和 harness 保持不变，只加载最终 `best_skill.md`。optimizer model、rejected buffer、meta skill 和训练轨迹都不进入 inference path，因此论文所称的“zero inference-time model calls”是指**不会因 SkillOpt 再增加 optimizer 调用**，并不意味着 target agent 本身没有推理成本。

## 与深度学习的对应关系

| 深度学习概念 | SkillOpt 中的对应物 | 边界 |
|---|---|---|
| weights | `SKILL.md` 文本 | 是离散自然语言，不可微 |
| forward pass | target agent rollouts | 受 model、harness、task 共同影响 |
| loss / reward | verifier score | 质量上限受 evaluator 决定 |
| gradient signal | trajectory reflection | 是 optimizer model 的语言诊断，不是真 gradient |
| batch size | rollout batch / reflection minibatch | 用多样本降低 anecdotal noise |
| learning rate | 每步最多应用的 edit 数 | 约束文本变化幅度 |
| momentum / optimizer state | slow update、meta skill、rejected buffer | 保存跨 step/epoch 的方向信息 |
| validation | held-out selection gate | 反复使用仍可能产生 adaptive overfitting |
| checkpoint | `best_skill.md` | 只导出验证过的最佳版本 |

## 真正关键的创新是什么

### 1. 优化 procedure，而不是模型权重

对于 closed frontier models，权重不可访问；即使是 open models，fine-tuning 也更重。SkillOpt 选择训练一份可读、可审计、可复制的外部 procedure，在 domain adaptation 成本与可控性之间取得实用平衡。

### 2. 把 self-reflection 约束成优化算法

普通 self-refine 常是“看一次失败 → 重写 → 默认采用”。SkillOpt 补上了 batch evidence、step-size control、external gate、negative feedback 和 checkpoint selection，因而更接近真正的 optimization loop。

### 3. 把训练期复杂度和部署期复杂度分开

训练时可以有强 optimizer model、完整 trajectories 和长期 meta memory；部署时只带一份 compact skill。这符合 [[harness-as-moat]] 中“反馈飞轮比静态脚手架更有价值”的观点，也把 [[building-self-improving-agents]] 所说的执行—验证—修正闭环具体化了。

### 4. 把 Harness 纳入优化对象的真实环境

同一份 skill 在 direct chat、Codex、Claude Code 中的作用方式不同。SkillOpt 通过 adapter 注入 skill、执行 native harness、收集 scored trajectory，而不是假设 final answer 能代表过程。这与 [[claw-swe-bench-harness-evaluation]] 的结论一致：真实实验单元应是 `model × harness × task distribution × budget`。

## 实验结果应该怎样解读

论文在六个 benchmarks、七个 target models、三种 execution modes 上报告 52 个 `(model, benchmark, harness)` cells，SkillOpt 在全部 cells 达到 best 或 tied-best。GPT-5.5 相对 no-skill 的平均绝对提升为：

- direct chat：`+23.5` percentage points；
- Codex：`+24.8` percentage points；
- Claude Code：`+19.1` percentage points。

论文还做了 component ablation，以及 cross-model、cross-harness、nearby cross-benchmark transfer。其价值在于：证据不只停留在原始 repro case，且最终 test split 与 selection split 分离。

但这仍是 2026-05 的 arXiv preprint。`52/52` 的准确含义是“在作者选择的模型、数据集、harness、baseline 和预算协议内 best/tied-best”，不是对所有 Agent 任务的普遍定理。特别要注意：

- verifier 决定 optimizer 会学到什么；错误或狭窄的 scorer 会稳定地产生 reward hacking；
- 同一 selection split 被多轮自适应查询，仍可能发生 validation overfitting；
- 强 optimizer model 的离线 token 与 rollout 成本需要计入总拥有成本；
- 单个 skill 适合相对统一的 domain，异质任务还需要 routing、skill composition 和 lifecycle governance；
- transfer 到更远分布前，必须重新建立 held-out evidence。

因此，当前最合理的证据状态是 **generalized-candidate**，还不能仅凭论文结果称为 production-ready。

## 如果用于真实 Agent Harness，最低验证合同

不要用“原 case 过了”作为完成条件。至少建立四层评测：

1. **Original repro**：确认已知失败模式改善，状态只能叫 repro-fixed。
2. **Changed-case**：换实体、文件结构、表达方式、工具返回顺序，验证规则没有记住表面模式。
3. **Negative/adversarial**：加入与已学 heuristic 相反的正确任务、误导性 tool output、冲突指令和 scorer 边界，检查是否 reward hack 或过度应用。
4. **Out-of-contract**：换 domain、harness 或 model；skill 应明确不适用、被 router 排除，或经过新的 validation gate，而不是静默迁移。

只有同时满足可复用 contract、独立 test、回归保护、成本与安全边界，才可从 generalized-candidate 升为 production-ready。

## 适用与不适用

适合：

- 有重复任务，优化成本可以被多次部署摊薄；
- 有可靠 executable verifier、exact match 或明确业务指标；
- procedure 可以被一份紧凑 skill 表达；
- 需要 audit、diff、rollback 和跨模型迁移。

不适合直接套用：

- 一次性任务；
- success 高度主观且没有可靠 judge；
- 一个 skill 混合大量互相冲突的 domain；
- 高风险业务只有单一平均分、没有 worst-case 和 safety gates。

## Related

- [[building-self-improving-agents]] — Agent 的执行、验证、修正闭环
- [[harness-as-moat]] — Harness 作为反馈与纠错系统
- [[claw-swe-bench-harness-evaluation]] — 把 model、harness、task set、budget 作为完整实验单元
- [[agent-system-architecture]] — skill、runtime、verifier 和 adapter 的系统边界
