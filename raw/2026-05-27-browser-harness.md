---
source: http://xhslink.com/o/3IrXjmxsK8n
captured: 2026-05-27
type: article
alt_sources:
  - https://cloud.tencent.com/developer/article/2658841
  - https://cloud.tencent.com/developer/article/2663247
  - https://github.com/browser-use/browser-use
---

# Browser Harness：592行Python代码的极简自愈式浏览器自动化框架

小红书爆文，2026年5月末刷屏。

## 核心信息

Browser Harness 是 Browser Use 团队（主项目 88k+ GitHub Stars）推出的极简浏览器自动化框架：
- 仅 592 行 Python 代码，4个文件
- 通过 WebSocket 直连 Chrome DevTools Protocol (CDP)，完全绕过 Playwright/Selenium
- AI 自愈机制：遇到未知操作时，AI 动态编写缺失函数并注入执行
- Domain Skills 系统：AI 学到的操作技能可跨会话复用
- 开源即获 3.2K Stars

## 架构

4个文件分工：
1. `harness.py` — 核心控制器，WebSocket 连接管理 + CDP 命令收发
2. `skills.py` — Domain Skills 存储与检索，学习过的操作持久化
3. `agent.py` — AI Agent 编排层，任务分解 + 自愈逻辑
4. `utils.py` — 工具函数

## 关键创新

### 1. 去框架化
传统路径：Python → Playwright/Selenium → WebDriver → 浏览器
Browser Harness：Python → WebSocket → Chrome CDP

砍掉中间层，减少抽象泄漏、依赖冲突、版本兼容问题。

### 2. 自愈式执行
当 Agent 需要执行一个不存在的操作（如"滚动到页面底部"）：
1. Agent 发现没有现成函数
2. AI 根据上下文 + CDP 文档动态生成函数代码
3. 代码注入运行时并执行
4. 成功后保存为 Domain Skill 供未来复用

### 3. Domain Skills 飞轮
- 第一次执行某操作：AI 即时编写 → 慢
- 第二次执行同类操作：命中已有 Skill → 快
- 随着使用积累，系统越来越"聪明"

## 为什么刷屏

1. 极简主义的冲击力：592行代码 vs Playwright 数万行
2. "AI写AI工具"的范式演示：Agent 运行时自我进化
3. Browser Use 品牌效应：88k star 主项目的衍生品自带关注度
4. 实用性：真正解决了浏览器自动化的痛点（脆弱性、维护成本）

## 社区讨论焦点

- 是否能替代 Playwright？多数认为适合 AI Agent 场景，不适合传统 E2E 测试
- 安全性问题：AI 动态生成并执行代码存在风险
- 与 Browser Use 主项目的关系：Harness 是更底层的基座，Browser Use 是上层应用
