---
title: LLM Pretrain Data Engineering
created: 2026-05-20
last_updated: 2026-05-20
tags: [llm, pretraining, data-engineering, scaling, deep-learning]
sources: [raw/2026-05-20-llm-pretrain-data-engineering.md]
---

# LLM 预训练数据工程

工业级大模型预训练的数据工程实践总结。数据工程已成为区分前沿模型的核心变量——在架构与算力相近的前提下，数据处理质量决定模型差异。

## 数据规模演进

| 时间 | 模型 | 训练 Tokens |
|------|------|-------------|
| 2020 | GPT-3 | 300B |
| 2024 | DeepSeek V3 | 14.8T |
| 2024 | LLaMA 3 | 15.6T |
| 2025-26 | Qwen 3 / GLM-5 / DeepSeek V4 | 30-40T |

高质量文本预计 2026-2032 年耗尽（Villalobos 2024）。数据效率已从辅助指标上升为核心优化目标。

## 四大技术趋势

1. **数据效率成为核心指标** — 更优过滤可带来数倍等效数据量的性能提升（RefinedWeb, FineWeb-Edu, DCLM）
2. **合成数据普遍采纳** — 天然数据控制分布，合成数据补强领域（DeepSeek V3 是唯一例外）
3. **多阶段训练** — 单阶段 → mid-training + annealing 的课程结构
4. **数据工程披露减少** — 已成核心竞争力；OLMo / Nemotron-CC 仍开放

## 去重 (Deduplication)

两类方法叠加使用：

**精确匹配**: SHA-256 / URL去重 / Bloom filter  
**模糊匹配**: MinHash + LSH（主流，亚线性内存增长）

实践细节：
- **LLaMA 3**: 三层级 — URL级 + 文档级MinHash + 行级
- **DeepSeek V2/V3/V4**: 跨快照去重（消除时序冗余）
- **InternLM 2 参考配置**: 128 hash functions, 5-gram, Jaccard threshold 0.7

风险：过度去重会抹去知识频率信号（高频内容往往是基础性事实）。实践中不可避免地重复使用高质量数据。

## 质量过滤 (Quality Filtering)

**两层叠加**: 启发式规则（粗粒度）+ 分类器（精细选择）

核心模式 — **强 LLM 标注 → 轻量分类器部署**:

| 方案 | 标注 | 部署 |
|------|------|------|
| FineWeb-Edu | Llama-3-70B 标注 50 万样本 | BERT 分类器 |
| Nemotron-CC | 多模型标注 | Mixtral + Nemotron-340B + fastText 集成 |
| Qwen 3 | 多维标注（教育价值、领域等）30T+ tokens | 实例级配比优化 |

局限：质量定义依赖风格偏好。DeepSeek V1 教训——过严过滤降低知识密集型任务性能，V2 放宽阈值。

## 合成数据 (Synthetic Data)

| 模型 | 策略 | 规模 |
|------|------|------|
| Phi-4 | 50+ 类合成数据集 | 占预训练 40% |
| Qwen 3 | 每一代为下一代生成（教科书/QA/代码） | 数 T tokens |
| Kimi K2 | 多风格多视角改写，每文档最多 2 次 | — |
| Nemotron-CC | 低质→Wiki 风格，高质→QA/摘要/知识列表 | 1.9T tokens |

**最佳混合比** (Kang 2025): 1/3 合成 + 2/3 自然 → 训练效率 5-10x  
**关键原则**: LLM 仅作风格转换，不作知识来源（避免分布偏差）  
**风险**: 模型坍缩——迭代训练导致分布多样性不可逆损失

## 数据配比 (Data Mixing)

演进路线：
- **人工固定** (LLaMA 1): CommonCrawl 67%, C4 15%, GitHub 4.5%
- **Scaling law 搜索** (LLaMA 3+): 小模型系统尝试 → 拟合关系 → 外推

学术方法：DoReMi (Group DRO), RegMix (仅需 10% 计算), Data Mixing Laws (解析函数, 省 48% 步数), BiMix, UtiliMax (投资组合类比)

小→大迁移可靠性 ~80% (DataDecide)。但 AutoScale/BETR 发现可能失效。

## 多阶段训练

典型结构（以 Qwen 3 为例）：
1. **S1 通用** (~30T tokens): 119 种语言，世界知识
2. **S2 推理强化 / Mid-training** (~5T tokens): 科学、代码、推理、合成数据
3. **S3 长上下文**: 数百 M tokens 高质量长文本
4. **退火 (Annealing)**: 降低 LR + 切换高质量子集

关键发现：
- 退火使 LLaMA 3 8B 在 GSM8K +24pp（单阶段最大跳跃之一）
- WSD 调度 (MiniCPM): Warmup-Stable-Decay，可复用范式
- 高质量数据在低 LR 时对参数影响更持久 → 解释退火阶段的有效性
- 预训练与后训练边界正在模糊化

## 长上下文训练

扩展方式：分阶段递增（4K → 32K → 128K）
- DeepSeek V3: 14.8T@4K → YaRN 扩展至 32K/128K
- LLaMA 3: 8K 起经 6 阶段至 128K

数据策略（三类叠加）：
1. 长文档源上采样（代码、书籍）
2. 语义相关短文档拼接（In-Context Pretraining, ICL +8%）
3. 合成长上下文任务

## 训练信号优化

| 方法 | 思路 | 效果 |
|------|------|------|
| RHO-1 | 只对"应学未学"的 token 反向传播 | 集中训练信号 |
| FIM | 中间片段移至末尾，双向条件生成 | DeepSeek V3/V4 通用采用 |
| Gemma 2 蒸馏 | 大模型 logits 替代 one-hot | 知识迁移 |
| MeCo | URL/域名作为前缀条件 | ~33% 更少数据达同等效果 |
| KoCo | 元信息→知识坐标→可组合语境 | 提高数据利用效率 |

核心洞察：知识吸收不仅取决于命题本身，也取决于出现时的上下文（Physics of LLM 3.1）

## 预训练评估

**监控信号**:
- 训练 loss: spike 检测（滑动窗口 z-score），回滚 + 跳过 batch
- BPB (bits-per-byte): 除以 UTF-8 字节数，消除分词器差异（DeepSeek V3, OLMo 3 采用）

**预测大模型表现**:
- NLL → 准确率映射: 1.4B 模型预测大模型 benchmark（仅 1/300 计算量），LLaMA 3 采用

**核心挑战**:
- Benchmark 与实际能力脱钩（Yi-Lightning: Arena 第 6 vs benchmark 落差）
- 能力混淆（MMLU 同时测记忆+理解+格式遵循）
- 跨实验不可比（不同验证集可翻转结论）
- 仅 ~39% 任务表现单调 scaling 行为
- Physics of LLM 系列: 原子能力隔离测量提供补充路径

## 关键开放问题

- 知识如何从数据中涌现？模型如何建立概念、关系和推理路径？
- 知识频率信号 vs 冗余如何区分？（无 ground truth）
- 小规模配比结论何时可迁移到大规模？
- 合成数据在 >14B 参数上的有效性验证不足
- 标准语言建模忽略知识产生条件——知识语境研究尝试补回

## Related

- [[agent-system-architecture]]
