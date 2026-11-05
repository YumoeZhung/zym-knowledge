---
title: DSH personaSuffix：主 Skill 的代码加载与系统提示词注入
created: 2026-11-05
last_updated: 2026-11-05
tags: [agent-harness, deepseek, agent-skill, prompt-engineering]
sources: [raw/2026-11-05-dsh-persona-suffix.md]
---

# DSH personaSuffix：主 Skill 的代码加载与系统提示词注入

**personaSuffix 是 DSH 系统提示词的自定义补充配置项。在本次核查的生涯项目中，主 SKILL.md 由业务代码读取，再作为 personaSuffix 注入，不由 Agent 自主决定是否读取。**[来源](../raw/2026-11-05-dsh-persona-suffix.md#业务代码的主-skill-注入)

## 配置项的含义

persona 表示角色设定或行为规则；suffix 表示放在系统提示词章节序列的后部。它可以容纳整段业务规则，不限于一句角色描述，也不是 user/assistant 之外的新消息角色。[来源](../raw/2026-11-05-dsh-persona-suffix.md#dsh-配置机制)

在核查的 DSH `0.2.1-rc.2` 中，system-prompt 插件把字符串配置注册为 `deployment:persona-suffix` 章节，再参与最终提示词组装。默认章节顺序为 10200；这不保证它永远是最后一段，也不赋予它高于其他系统规则的独立权限。[来源](../raw/2026-11-05-dsh-persona-suffix.md#dsh-配置机制)

## 从 SKILL.md 到模型的实际路径

以下是业务项目的接入方式，**不是 DSH 自动扫描所有 SKILL.md 的通用规则**：[来源与代码位置](../raw/2026-11-05-dsh-persona-suffix.md#业务代码的主-skill-注入)

```text
业务代码定位主 Skill 目录并读取 SKILL.md
    ↓ 去除 YAML frontmatter，缓存正文与摘要
创建/重建 DSH 池时生成 persona patch
    ↓ config.personaSuffix = Skill 正文
DeepSeekHarnessConfig(patches=...) 启动 Harness
    ↓ system-prompt 插件注册并组装章节
系统提示词经模型适配器发送给模型
```

示意配置：

```yaml
- id: system-prompt
  config:
    personaSuffix: |
      你是生涯规划助手。
      按业务规则回答用户问题。
```

主 Skill 内容在模型开始处理该请求前已由代码提供，不需要模型先调用 read 工具。这保证的是提供规则的路径，不是模型一定遵守规则的效果。Skill 引用的其他文件是否被展开或按需读取，要另查加载器和实际工具调用。[来源](../raw/2026-11-05-dsh-persona-suffix.md#业务代码的主-skill-注入)

## “启动时加载”与刷新边界

更准确的说法是：当前业务实现会在初始化/首次创建池的路径中加载并缓存，后续复用配置，不在每次模型请求前重新读取主 Skill。[来源](../raw/2026-11-05-dsh-persona-suffix.md#缓存与时间)

- `_static_skill()` 使用进程级 `_STATIC_SKILL_CACHE`。
- 池 key 包含 Skill 摘要，但摘要来自缓存，不等于持续检测文件变化。
- persona patch 按 digest 命名，已存在时复用。
- 修改挂载文件后，需要使缓存重新加载并使新配置生效；重启应用进程是正常场景下的一种方式，不能把仅修改文件当成热更新已经完成。

## 与动态时间注入的区别

如果启动时读到的正文是“当前时间：14:05”，继续复用时它仍是这段文字。**静态文本不会自动更新时间。**[来源](../raw/2026-11-05-dsh-persona-suffix.md#缓存与时间)

DSH 底层另有动态 section/变量 provider；字符串章节也能引用已注册的变量。它们需要显式接入，不能由 personaSuffix 的名字推断已经启用。动态生成、最终请求中的替换以及持久历史中的保留是不同问题，详见 [[model-adapter]]。[来源](../raw/2026-11-05-dsh-persona-suffix.md#dsh-配置机制)

## 适用范围

本页针对生涯仓库 `d418ded3b3046e59b62521a4014c4925b5b4fa89` 和 SDK `0.2.1rc2` 的本地源码核查。未在本次操作中部署、修改业务代码或执行实际模型请求；不泛化为所有 Harness 的 Skill 加载方式。[核验记录](../raw/2026-11-05-dsh-persona-suffix.md)

## Related

- [[model-adapter]] — 提示词组装之后的协议映射与更新能力
- [[agent-system-architecture]] — Harness 配置、Runtime 与 Agent Loop 的边界
