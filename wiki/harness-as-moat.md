---
title: "Harness 壁垒之争：控制论视角"
created: 2026-05-21
last_updated: 2026-05-21
source: http://xhslink.com/o/2H5Q3NjRoLk
tags: [agent, harness, cybernetics, competitive-moat, flywheel]
---

# Harness 壁垒之争：控制论视角

Harness 就是控制论（Cybernetics）在 AI Agent 工程中的应用——反馈回路、约束条件、纠错机制。别被 FOMO 吓到，这些都是软件工程的老本行。

来源：小红书文章《模型不是壁垒，Harness 也不是》，2026年5月。

## Harness 的本质

Harness = 马具，驾驭大模型的外围系统。核心能力四件套：

| 能力 | 做法 | 关键洞察 |
|------|------|----------|
| 约束 | 规则写进 CI，不写进提示词 | 程序化规则比一万句叮嘱有效 |
| 记忆 | 仓库中维护结构化文档 | 补偿上下文窗口遗忘 |
| 验证 | 做事的与评判的分开 | 选手和裁判不能是同一人 |
| 纠错 | Git 回滚 + 新 Agent 接手 + 交接单 | 不指望金鱼自我修复 |

这四项对应控制论的经典要素：**执行器约束、状态记忆、观测器反馈、纠偏回路**。

## 产业辩论

### "Harness 就是一切"派
- LangChain：Harness 优化使同模型得分从 52.8% → 66.5%（TerminalBench 2.0）
- Hashline：仅改编辑格式，得分 6.7% → 68.3%
- Cursor 靠 Harness 层估值 293 亿美元

### "模型就是一切"派
- Claude Code 创造者 Boris Cherny：产品几乎没有 Harness
- Noam Brown (OpenAI)：推理模型上搭脚手架往往添乱
- Scale AI：不同 Harness 框架差距在误差范围内

### 调和：薄产品 ≠ 薄实践
Boris Cherny 的 Claude Code 产品架构极薄，但他自己的工程实践很厚（10-15 并行会话、自动化钩子、规划模式、子 Agent 审查、浏览器自动化测试）。赛车底盘简单，但每次上赛道调3小时。

## 核心洞察：飞轮转速才是壁垒

模型不是壁垒，Harness 也不是。真正的壁垒是**迭代循环的速度**：

```
发现 Agent 失败模式
  → 编码进 Harness（环境约束）
    → 用执行数据反哺模型训练
      → 新模型内化旧规则，拆掉旧 Harness
        → 发现新的失败模式…（飞轮再转一圈）
```

这解释了为什么最好的团队一直在**拆** Harness：
- Manus 半年重写5次，每次砍功能
- Vercel v0 删掉 80% 工具反而更好
- Claude Code 每3-4周重写
- 新模型"吃掉"旧规则，旧 Harness 变成绊脚石

## 对我们的启示

1. **别被 FOMO 吓到**：Harness 就是约束+反馈+回滚，都是软件工程老技能
2. **设计时想着会被拆掉**：今天的 Harness 是临时性的，为下一代模型积累数据
3. **重点投入飞轮**：让 Agent 的失败数据能自动反馈回环境改进
4. **Keep it simple**：过度复杂的编排逻辑会被新模型淘汰

## Related

- [[agent-system-architecture]] — Agent Harness 作为架构层的定义
