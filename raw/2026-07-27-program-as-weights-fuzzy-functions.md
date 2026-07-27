---
source: https://arxiv.org/abs/2607.02512
captured: 2026-07-27
type: paper
---

# Program-as-Weights: A Programming Paradigm for Fuzzy Functions

Source archive note: 本文件保存论文元数据、官方链接和事实性摘录摘要，不复制论文全文。

## Bibliographic Metadata

- Authors: Wentao Zhang, Liliana Hotsko, Woojeong Kim, Pengyu Nie, Stuart Shieber, Yuntian Deng
- Institutions: University of Waterloo、Cornell University、Harvard University
- Published: arXiv v1, 2026-07-02
- arXiv: 2607.02512
- Project: https://programasweights.com
- Code: https://github.com/programasweights

## Extracted Claims

- 论文提出 fuzzy-function programming：开发者用自然语言 specification 定义难以写成精确规则的函数，神经编译器将其编译成可保存、分发和本地执行的 neural artifact。
- PAW 将 foundation model 从“每次输入都解决问题的在线答题者”改造成“在 compile time 一次性制造工具的编译器”。
- 一个 PAW program 是混合 artifact：离散部分是清洗后的 pseudo-program，连续部分是注入冻结 interpreter 的 PEFT module。
- 当前最强实现为 Text-to-LoRA。off-the-shelf Qwen3-4B pseudo compiler 先把 specification 改写成任务描述和少量 input-output examples；另一个经过训练的 Qwen3-4B LoRA compiler 读取 specification 与 pseudo-program，再由 LoRA mapper 将 hidden states 映射成 interpreter 的 task-specific LoRA。
- runtime 使用冻结的 Qwen3-0.6B interpreter：加载 task-specific LoRA，把 pseudo-program prepend 到实际输入，并 autoregressively 生成输出。一个常驻 base interpreter 可以 hot-swap 多个 PAW programs。
- 论文还实现了 prefix-tuning 版本；在受控文本任务比较中，prefix-tuning 达到 50.4% exact match，Text-to-LoRA 在默认设置达到 65.7%，因此主实验采用 LoRA。
- 只有 PEFT compiler 与 mapper 被训练；pseudo compiler 和 interpreter 均冻结。训练目标是让 compiler 生成的 adapter 在注入 interpreter 后最大化目标输出的 token likelihood。
- FuzzyBench 包含约 10M 个 `(specification, input, target output)` 样本和 800 多个 fuzzy-task 子类别，主要由 gpt-5.2 合成。数据按 specification 做 80/10/10 train/validation/test 切分，测试 specification 在训练中不可见；verified test set 只保留 gpt-5.2 与 gpt-5-mini 输出一致的样本。
- FuzzyBench 上，PAW Qwen3-0.6B 达到 73.78% exact match；直接 prompting Qwen3-32B 为 68.70%，直接 prompting Qwen3-0.6B 为 9.84%，full fine-tuning 同一 0.6B base 为 58.40%，最强 fixed LoRA baseline 为 52.10%。
- PAW 并未超过所有大模型：同表中 gpt-oss-20B 为 85.45%，gpt-5-mini 为 91.87%，gpt-5.2 为 96.09%。
- bf16 推理内存比较为约 1.2 GB（Qwen3-0.6B PAW）对约 60 GB（Qwen3-32B）。量化后，共享 base 约 430–623 MB，每个 Q4_0 LoRA adapter 约 23 MB。
- MacBook M3 Metal 环境中，Q5_K_M base + Q4_0 adapter 报告 31.6 tokens/s 和 0.48 s cold load。
- pseudo-program 具有 specification denoising 作用。论文的噪声实验中，combined heavy noise 相对 clean 下降 3.7 percentage points；heavy typo 下，使用 pseudo-program 比直接把 raw spec 送入 interpreter 高 4.5 points。
- 论文展示 event-driven log monitoring、intent-based site navigation、semantic search reranking、tool-calling pipeline 和 multilingual word-guessing game 五个 case studies。
- ToolCall-15 案例将任务拆成 10 个 PAW functions，由确定性 Python 管理 multi-turn state、regex date/time parsing 和 tool_calls JSON 构造，整体得分为 93%。
- 多模态实验只替换 compiler 为 Qwen3-VL-4B，仍使用文本 Qwen3-0.6B interpreter；image information 被编码进生成的 PEFT module，interpreter 不直接读取 pixels。

## Paper-Stated Limitations

- compiler 与 interpreter family 耦合；从 Qwen3-0.6B 换到 Qwen3.5-0.8B 需要重新训练 compiler。
- 人类可读的只有 pseudo-program；continuous LoRA / KV-cache component 不透明，缺少成熟的 neural-binary debugging 与 inspection 工具。
- 论文只验证 single-step、one-input-one-output fuzzy functions，没有验证 long-horizon reasoning 或 compiler 自动生成 compositional programs。
- FuzzyBench 主要由 gpt-5.2 合成；尽管 test specification held out 且由独立模型验证，仍需要更广泛的真实外部分布验证。
- 最佳 PEFT 依赖任务：LoRA 在文本和 diagram classification 上更强，prefix-tuning 在部分 long-form structured image-to-markup generation 上更强，目前没有无需实验即可选择 PEFT 的可靠原则。

## Reusable Takeaways

- PAW 的核心经济学是 amortization：高成本 compilation 只发生一次，低成本 inference 被大量重复调用；调用频率低或 specification 高频变化时未必划算。
- “program”不是完整模型权重，而是可热切换的 task-specific adapter 加一段 pseudo-program；base interpreter 是共享 runtime。
- 它特别适合定义稳定、高频、短输入输出、允许统计误差、可用 held-out cases 验证的 fuzzy functions，如 triage、routing、reranking、extraction 和 lightweight agent preprocessing。
- 它不应替代权限、计费、精确数学、合规 gate 等要求确定性和可审计性的 symbolic logic。
- 生产系统更合理的组合是：PAW 负责 fuzzy perception / classification，普通代码负责 state machine、schema validation、权限、安全边界和 deterministic serialization。
- 论文证据支持将 PAW 视为 generalized-candidate；要达到 production-ready，仍需在真实业务分布上补充 changed-case、negative/adversarial、out-of-contract、calibration、tail-risk、latency 和 total-cost evaluation。
