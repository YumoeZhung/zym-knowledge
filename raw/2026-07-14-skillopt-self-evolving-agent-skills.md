---
source: https://arxiv.org/abs/2605.23904
captured: 2026-07-14
type: paper
---

# SkillOpt: Executive Strategy for Self-Evolving Agent Skills

Source archive note: 本文件保存论文元数据、官方链接和事实性摘录摘要，不复制论文全文。

## Bibliographic Metadata

- Authors: Yifan Yang, Ziyang Gong, Weiquan Huang, Qihao Yang, Ziwei Zhou, Zisu Huang, Yan Li, Xuemei Gao, Qi Dai, Bei Liu, Kai Qiu, Yuqing Yang, Dongdong Chen, Xue Yang, Chong Luo
- Institutions: Microsoft、Shanghai Jiao Tong University、Tongji University、Fudan University
- Published: arXiv, 2026-05；当前核对版本为 v2（2026-05-25）
- arXiv: 2605.23904
- Microsoft Research: https://www.microsoft.com/en-us/research/publication/skillopt-executive-strategy-for-self-evolving-agent-skills/
- Project: https://microsoft.github.io/SkillOpt/
- Code: https://github.com/microsoft/SkillOpt

## Extracted Claims

- SkillOpt 不更新目标模型权重，而把一份自然语言 skill 文档视作 frozen agent 的可训练外部状态。
- 目标模型负责执行任务并产生带分数的 trajectories；独立 optimizer model 负责从成败轨迹中提出结构化 `add`、`delete`、`replace` edits。
- 训练数据被分为 train、selection 和 test。train 产生优化证据，selection 严格决定是否接受候选 skill，test 只用于最终报告。
- 失败轨迹和成功轨迹被分开组成 reflection minibatches：失败样本用于寻找待修正的共性，成功样本用于保护已有有效行为。
- 多个局部建议先去重、消除矛盾并聚合，再按预期效用排序；每一步最多应用若干项 edit。这个 edit budget 被称为 textual learning rate。
- 候选 skill 只有在 held-out selection score 严格高于当前 skill 时才会被接受；平分也拒绝。
- 被拒绝的 edits 及其造成的分数下降会进入 epoch-local rejected-edit buffer，供后续 optimizer prompts 使用，防止重复走已验证有害的方向。
- epoch 结束时，slow update 会在相同任务上比较前后两个 epoch 的 skill，将结果分为改善、退化、持续失败和稳定成功，再生成受保护的长期指导块；该候选同样必须通过 selection gate。
- meta skill 只存在于 optimizer 侧，用于记录哪些 edit 模式有效、哪些被拒绝、哪些失败持续存在；部署时只交付 compact `best_skill.md`，不携带 optimizer memory，也不增加 optimizer model 调用。
- 默认实验协议使用 4 epochs、rollout batch size 40、reflection minibatch size 8、textual learning rate 4、cosine decay（floor 2）、slow update 20 samples，并启用 meta skill；不同 benchmark 会按可用训练池调整 batch size。
- 论文覆盖 SearchQA、SpreadsheetBench、OfficeQA、DocVQA、LiveMathematicianBench、ALFWorld 六个 benchmarks，七个 target models，以及 direct chat、Codex、Claude Code 三类 execution harnesses。
- 作者报告 SkillOpt 在 52 个已评测的 `(model, benchmark, harness)` cells 中全部达到 best 或 tied-best；GPT-5.5 相比 no-skill 的平均绝对提升为 direct chat `+23.5`、Codex `+24.8`、Claude Code `+19.1` percentage points。
- 论文还报告了 cross-model、cross-harness 和 nearby cross-benchmark transfer；所有列出的 transfer rows 都高于目标环境的 no-skill baseline。
- 论文中的 SpreadsheetBench 质性案例显示，skill 从通用的“用 Python 操作表格”演化为更明确的 workbook-forensics procedure：检查真实 workbook 结构、定位完整 target range、规范化 keys/types、写入 grader 可读取的 evaluated values，并重新打开结果检查边界行和空白单元格。

## Paper-Stated Limitations

- 方法依赖 scored trajectories 和可靠的 held-out feedback；开放式、主观、多目标任务可能需要人工或 model-based judge。
- 部署只增加一份小型文本 artifact，但离线训练需要额外 rollouts 和 optimizer-model calls；一次性任务未必划算。
- 当前方法优化单个 domain 的单个 skill，不负责大型 skill library 的 routing、composition 和 lifecycle management。
- skill 会吸收训练分布中的 domain heuristics；迁移到明显不同的模型、harness 或任务前仍需要独立 held-out evaluation。

## Reusable Takeaways

- 把 skill optimization 看成受控的 search-and-validate loop，而不是无条件 self-rewrite。
- “做任务的模型”“提出修改的模型”“判定是否进步的验证面”应保持职责分离。
- 一次失败只是一条 anecdote；只有跨 minibatch 重复出现的模式才足以成为可复用规则。
- 文本优化也需要 step size。限制每次 edit 数量可以保留局部连续性，让 accepted/rejected history 仍然可解释。
- rejected proposal 不是废料，而是负反馈数据；但它只服务训练，不应无限膨胀部署 prompt。
- 论文证据支持把 SkillOpt 视为 generalized candidate；具体生产环境仍需 changed-case、negative/adversarial 和 out-of-contract evaluation。
