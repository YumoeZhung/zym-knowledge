---
title: Palantir Ontology：从数据图谱到可执行的业务数字孪生
created: 2026-09-02
last_updated: 2026-09-02
tags: [agent, enterprise-ai, knowledge-graph, ontology, palantir, semantic-layer]
sources: [raw/2026-09-02-palantir-ontology-conversation.md]
---

# Palantir Ontology：从数据图谱到可执行的业务数字孪生

> Palantir Ontology 将企业的数据、逻辑、动作与安全策略整合为人和 AI Agent 都能理解并操作的实时业务数字孪生。

它并不只是给数据库增加一层业务名称，也不只是把数据连成知识图谱。它既描述“企业世界里有什么、彼此如何关联、现在处于什么状态”，也规定“可以进行什么操作、由谁操作、在什么条件下操作”。

## 核心构件

### 对象、属性和关系：描述业务世界

- **Object Type**：某类现实实体或事件的定义，如 JetEngine、Aircraft、Flight。
- **Object**：某个具体实例，如编号为 E-127 的发动机。
- **Property**：对象的特征，如型号、温度、健康状态。
- **Link Type**：两类对象之间关系的定义，如 Flight 与 Aircraft 之间的“分配飞机”关系。
- **Link**：两个具体对象之间的一次关系实例。

与关系型数据的近似对应为：

| 数据库概念 | Ontology 概念 |
|---|---|
| Dataset / 表 | Object Type |
| Row / 行 | Object |
| Column / 列 | Property |
| Field / 单元格 | Property Value |
| Join | Link Type |

这种对应只是入门类比。Ontology 中的对象和关系还包含业务语义、元数据、权限和治理，并直接供应用、函数和 Agent 使用。

### Function、Model 和 Action：让业务世界能够运行

只有对象和关系，系统仍然只能回答“现在是什么样”。要支持决策和执行，还需要：

- **Function**：读取对象、属性和关系并执行任意复杂度的业务计算。
- **Model**：预测故障、风险、需求等未来状态。
- **Action Type**：定义一次受治理的业务操作可以修改哪些对象、属性和关系，以及触发什么副作用。
- **Validation / Automation**：限制动作的前置条件，或在条件满足时自动触发流程。

Action 是理解 Palantir Ontology 的关键。例如发现发动机风险后，系统不只返回预警，还可以在权限和校验约束下标记待检、禁止航班分配、创建工单、通知负责人并写回业务系统。

### Security：把“能做什么”限制在可信边界内

权限和安全不是外围补丁，而是 Ontology 的组成部分。对象、关系、动作和函数均受到权限控制与审计，使人和 Agent 只能读取被授权的数据，并执行被允许的操作。

因此，Palantir 官方对 Ontology 的更准确概括是：

> **Data + Logic + Action + Security**

## 如何理解“五层数学图”

某张示意图把 Ontology 概括为“存在—关系—时间—逻辑—智能”五层。这是有用的认知框架，但不是 Palantir 官方标准分层。

| 示意图层级 | 可以如何理解 | 需要注意 |
|---|---|---|
| 存在层 Raw Data | 原始数据被映射为对象和属性 | “表变对象”不是简单改名，还要赋予业务语义 |
| 关系层 Network | 对象通过 Link 形成业务关系网 | Link 是正式业务模型，不只是一次数据库 Join |
| 时间层 Trajectory | 状态、事件和轨迹随时间变化 | 官方通常不把 Time 列为独立 Ontology 层 |
| 逻辑层 Constraints | Function、Model、校验规则 | 业务逻辑不限于形式逻辑公式 |
| 智能层 Vector Point Cloud | 语义检索、相似匹配和 AI 推理 | Embedding 是 AI 技术，不是 Ontology 的最高层或核心定义 |

该图最大的缺口是没有突出 **Action 与 Security**。如果只强调高维图谱和向量空间，就容易把 Palantir 误解成“知识图谱 + 向量数据库”。

## 航空维修示例

### 1. 从原始数据建立对象

企业数据可能分散在发动机表、航班表、维修记录表和传感器时序表中。Ontology 将它们映射为：

- JetEngine
- Aircraft
- Flight
- MaintenanceLog
- WorkOrder

### 2. 建立业务关系

- JetEngine → installedOn → Aircraft
- Aircraft → assignedTo → Flight
- JetEngine → hasMaintenanceLog → MaintenanceLog

系统因此能从一次发动机异常，沿关系找到受影响的飞机、航班、维修记录和负责人。

### 3. 引入时间和逻辑

系统跟踪发动机在不同时间的温度、振动、使用小时和维修状态。函数或模型可以执行规则：

> 如果温度连续超过阈值，且预测剩余寿命不足 50 小时，则该发动机不得被分配给长途航班。

### 4. 执行受治理的动作

经过授权的用户或 Agent 可以：

1. 将发动机标记为待检查；
2. 阻止新的航班分配；
3. 创建维修工单；
4. 通知维修主管；
5. 调整受影响的飞机和航班；
6. 把结果写回 ERP、MES 等系统。

于是形成：

> 读取现实状态 → 计算与判断 → 执行业务动作 → 写回现实系统

## 与知识图谱、语义层和 RAG 的区别

| 系统 | 主要解决的问题 | 典型输出 |
|---|---|---|
| 语义层 | 不同数据字段如何使用统一业务语言 | 可统一查询的指标和字段 |
| 知识图谱 | 实体之间有什么关系 | 可遍历和推理的关系网络 |
| RAG | 从资料中检索哪些证据回答问题 | 带上下文的自然语言答案 |
| Palantir Ontology | 企业当前是什么状态，以及下一步允许做什么 | 受权限治理的决策与业务动作 |

Palantir 官方明确强调 Ontology 不只是一个“薄语义层”。其差异不在于图结构本身，而在于把语义对象、业务逻辑、操作能力和安全治理组成同一个可运行系统。

## 对 Agent 系统的意义

LLM 本身只会生成 token，不天然知道：

- 企业里有哪些真实对象；
- 当前数据是否最新；
- 对象之间有哪些正式业务关系；
- 哪些操作合法；
- 当前用户拥有什么权限；
- 一个操作应如何写回真实系统。

Ontology 可以成为 Agent 的受治理业务环境：

- Object 和 Link 提供结构化世界状态；
- Function 和 Model 提供可靠计算能力；
- Action 提供有限、明确的可执行动作；
- Security 提供权限边界和审计；
- 实时数据更新让 Agent 的判断锚定企业现实。

因此可以把 Palantir Ontology 理解为：

> 不是单纯帮助 Agent“知道更多”，而是让 Agent 在真实业务世界中“按规则做事”。

## 适用边界

- 五层图适合用于解释数据如何从表结构逐渐获得关系、时间、逻辑和 AI 能力。
- 它不应被当作 Palantir 官方架构或实现顺序。
- Vector Embedding 可以增强搜索和 AI，但不能代替对象模型、业务约束、Action 与权限治理。
- Ontology 也不是自动从原始数据中自然长出来的；业务对象、关系、规则和动作需要结合组织语境持续建模和维护，这与 [[forward-deployed-engineer]] 的现场工作密切相关。

## Related

- [[agent-system-architecture]]
- [[forward-deployed-engineer]]
- [[rag-retrieval-2026-lessons]]
