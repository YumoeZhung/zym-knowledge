---
title: 工业级LLM预训练数据工程的关键实践
source_url: https://mp.weixin.qq.com/s/zk7d4ZdWJpWHkBS5AMHl3A
original_url: https://zhuanlan.zhihu.com/p/2032080549381190858
pdf: https://github.com/ydli-ai/ydli-ai.github.io/blob/main/assets/papers/LLM_pretrain_data_survey_zh.pdf
author: 李煜东
fetched: 2026-05-20
---

# 工业级LLM预训练数据工程的关键实践

## 写在前面

LLM研究的关注重心正在转移，从post train到强化学习再到agentic/harness工作流。但预训练仍然值得研究，它是模型能力形成的基础，关键问题尚未回答：数据如何驱动智能，知识如何从大规模语料中涌现。

本综述从有限披露的信息和可交叉验证的证据中整理线索，复原工业级LLM预训练数据工程的关键实践。

## 1. 引言

预训练语料规模在数年内增长近四个数量级：
- GPT-3 (2020): ~300B tokens
- DeepSeek V3 (2024): 14.8T tokens
- LLaMA 3 (2024): 15.6T tokens
- Qwen 3 / GLM-5 / DeepSeek V4 (2025-2026): 30-40T tokens

数据供给瓶颈：Villalobos (2024) 预测高质量文本将在2026-2032年间耗尽。

RefinedWeb证明经过去重和过滤的纯网页数据可超越多源精选语料。FineWeb-Edu和DCLM进一步验证更优过滤策略可在相同计算预算下带来数倍等效数据量的性能提升。

## 2. 技术趋势

### 2.1 数据规模持续增长
数据效率正从辅助指标上升为预训练的核心优化目标。规模和效率共同决定模型能力。

### 2.2 合成数据已被多数前沿模型采纳
用天然数据控制分布，合成数据提升质量或补强特定领域。DeepSeek V3是唯一明确排除合成预训练数据的主流模型。

### 2.3 预训练已细分为多阶段训练
由单阶段固定配比演变为包含mid-training、退火等多个阶段的课程结构。

### 2.4 数据工程的披露正在减少
数据工程已成为核心竞争环节。OLMo系列和Nemotron-CC仍坚持完全开放。

## 3. 语料库构建

### 3.1 数据源
- CommonCrawl：唯一提供T token量级的公开数据源
- 领域来源：代码(GitHub)、科学文献(arXiv/PubMed)、书籍、百科(Wikipedia)
- PDF/扫描件：olmOCR (7B VLM page-level转写)、MinerU、Nougat

### 3.2 去重
精确匹配 + 模糊匹配叠加使用：
- 精确：SHA-256 / URL / Bloom filter
- 模糊：MinHash + LSH（主流）
- LLaMA 3：三层级（URL级、文档级MinHash、行级）
- DeepSeek V2/V3/V4：跨快照去重
- InternLM 2参考配置：128 hash functions, 5-gram, Jaccard threshold 0.7
- 风险：过度去重抹去知识频率信号

### 3.3 质量过滤
启发式规则 + 分类器叠加：
- Gopher规则：文档长度、词数比例、符号密度阈值（基线）
- 核心模式："强LLM标注 → 轻量分类器部署"
  - FineWeb-Edu: Llama-3-70B标注50万样本 → BERT分类器
  - Nemotron-CC: 多分类器集成(Mixtral + Nemotron-340B + fastText)
  - Qwen 3: 多维标注(教育价值、领域等30T+ tokens) → 实例级优化
- 局限：质量定义依赖风格；过严过滤降低知识密集型任务性能(DeepSeek V1教训)

### 3.4 合成数据
- Phi-4: 合成占40%，50+类合成数据集
- Qwen 3: 每一代为下一代生成，数十领域，数T tokens
- Kimi K2: 多风格多视角改写，每文档最多2次
- Nemotron-CC: 1.9T tokens从CommonCrawl改写(低质→Wikipedia风格，高质→QA/摘要)
- 最佳混合比(Kang 2025): 1/3合成 + 2/3自然 → 效率提升5-10x
- 关键原则：LLM仅作风格转换，不作知识来源
- 风险：模型坍缩（分布多样性不可逆损失）

## 4. 数据利用

### 4.1 数据配比
- 人工固定(LLaMA 1: CommonCrawl 67%, C4 15%, GitHub 4.5%等)
- Scaling law引导搜索(LLaMA 3, Qwen 2.5/3, DeepSeek V3)
- 学术方法：DoReMi(Group DRO), RegMix(回归,仅需DoReMi 10%计算), Data Mixing Laws(解析函数,节省48%步数), BiMix(双变量), UtiliMax(投资组合类比)
- 小→大迁移可靠性：~80% (DataDecide)；AutoScale发现可能失效

### 4.2 多阶段训练
- Qwen 3：S1(30T通用) → S2(5T推理/代码/合成) → S3(数百M长上下文)
- Mid-training：恒定/周期LR，数百B-1T tokens，目标是补充能力
- 退火(Annealing)：降低LR + 高质量子集。LLaMA 3 8B: GSM8K +24pp, MATH +6.4pp
- WSD调度(MiniCPM): Warmup-Stable-Decay
- GLM-4.5发现WSD可能导致性能衰减

### 4.3 长上下文训练
- 分阶段扩展：4K→32K→128K (DeepSeek V3用YaRN)；LLaMA 3: 8K起经6阶段至128K
- 数据策略：长文档源上采样 + 语义相关文档拼接(In-Context Pretraining) + 合成长上下文任务
- Best-fit Packing：长度感知组合减少截断和padding

### 4.4 训练信号
- RHO-1选择性语言建模：只对超额loss较大的token反向传播
- FIM (Fill-in-the-Middle)：从代码扩展到通用模型(DeepSeek V3/V4)
- Gemma 2：大模型logits蒸馏替代one-hot目标
- MeCo：URL/域名作为前缀条件，~33%更少数据达同等效果
- KoCo知识坐标：元信息→可组合语境表示
- Physics of LLM 3.1：知识吸收不仅取决于命题本身，也取决于出现时的上下文

## 5. 预训练评估

- 训练loss：纵向监控(滑动窗口z-score/绝对阈值)，spike检测后回滚+跳过batch
- BPB (bits-per-byte)：除以UTF-8字节数而非token数，消除分词器差异
- NLL→准确率映射：1.4B过度训练模型预测大模型benchmark(1/300计算量)，LLaMA 3采用
- Few-shot评估 + cloze格式（从训练初期即产生区分信号）
- 核心挑战：
  - Benchmark与实际能力脱钩(Yi-Lightning证据)
  - 能力混淆（MMLU同时依赖记忆+理解+格式遵循）
  - 跨实验不可比（设置差异导致结论翻转）
  - 仅~39%任务表现单调scaling行为
- Physics of Language Models系列：原子能力隔离测量

## 6. 总结

预训练正从静态语料库演变为贯穿训练全过程的可调变量。核心仍是"大道至简"：去重复低质、保留自然分布、关键阶段提高高质量数据比例。

未来核心问题：知识如何从数据中涌现？数据以什么方式驱动智能？标准语言建模忽略了知识产生的条件——知识总是附着在具体场景中被理解、比较和迁移。知识语境系列研究尝试把被丢弃的语境重新纳入预训练数据工程。
