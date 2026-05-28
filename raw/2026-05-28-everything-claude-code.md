---
source: https://mp.weixin.qq.com/s/EWfhQMrfHJXyZ-MjfxybNA
captured: 2026-05-28
type: article
---

# 一个 Claude Code 插件，狂揽 20 万 Star！

微信公众号文章，2026年5月。

## 核心信息

Everything Claude Code (ECC) 是一个 Claude Code 的开源配置框架/插件系统，由旧金山开发者 Affaan Mustafa 开发。目前近 20 万 GitHub Stars。

### 起源

2025年9月，Anthropic 和 Forum Ventures 联合举办黑客松比赛，主题是"用 AI Agent 从零到一构建一家公司"。Affaan 和队友使用 Claude Code 获得冠军（产品：zenith.chat，AI 客户调研平台）。赛后他将打磨了十个月的 Claude Code 工作流开源，即 ECC。

### 规模（截至文章发布时）

- 61 个 Agent
- 246 个 Skill
- 76 个 Command
- 支持 Claude Code、Codex、Cursor、OpenCode、Gemini、Zed、GitHub Copilot

### 核心功能

1. **专业化 Agent 分工**：架构设计、测试编写、代码审查、安全漏洞扫描各有专门 Agent
2. **跨会话记忆**：不同会话之间自动存取上下文
3. **按需加载技能**：TypeScript 项目加载 TS Agent，写 Python 测试时才启动 TDD Agent，避免撑爆上下文
4. **AgentShield 安全审计**：毫秒级扫描，拦截凭证泄露
5. **--opus 模式**：启动三个 Agent 分身（红队找漏洞、蓝队修复、审计师汇总）
6. **Plugin Marketplace**：两行命令安装

### 安装方式

方式一（推荐，插件安装）：
```
/plugin marketplace add https://github.com/affaan-m/ECC
/plugin install ecc@ecc
```

方式二（手动克隆，精确控制）：
克隆仓库后自行挑选需要的 Agent/Skill 复制到项目配置目录。rules 文件需手动复制。

### 使用注意

- 不要一次启用所有 MCP（200k 上下文可能缩水到 70k）
- 建议配置 20-30 个 MCP，单项目启用 ≤10 个，活跃工具 ≤80 个
- 作者自己也说：挑适合自己的、删用不上的、加自己的

### 争议

- 太多功能实际用不到
- 本质是作者个人工作流的产物，不一定适合所有人

### 文章结论

"AI编程工具从单纯的代码补全助手，迭代到如今，已变成可被人精心编排的多 Agent 系统。配置——技能、规则、记忆、安全——正变得和模型本身一样重要。真正拉开差距的，反而是我们怎么去'调教'它。"

### GitHub

https://github.com/affaan-m/ECC
