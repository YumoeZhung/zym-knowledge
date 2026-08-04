---
source: "Codex 对话：Task Platform 文档续读设计"
captured: 2026-08-04
type: note
---

# 版本绑定且带 HMAC 签名的文档续读 Cursor

## 原始问题

Agent 通过受控文档阅读工具分段读取一份长文档：第一次请求返回当前内容和 `next_cursor`，下一次带着该 cursor 继续读取。如果两次请求之间文档被重新解析，旧 cursor 不能继续指向新版文档，否则同一条回答可能混用两个版本的证据。

例子：Agent 已读取 2025 版文档的前半部分，在继续读取前，文档被重新解析成 2026 版。此时旧 cursor 应失效，续读请求返回明确错误；Agent 或上层编排器再显式重新获取 2026 版的目录、搜索结果或起始位置，并丢弃尚未形成最终结论的旧版证据。

## 设计要点

- Cursor 不是简单页码，而是服务端签发的、不透明的“版本化书签”。
- Cursor 绑定 tenant、knowledge base、document、读取模式、selector、读取位置和内容代际。
- 内容代际可由 parsing attempt、revision、全文路径以及 chunk 的 id、内容和 metadata 等共同生成 fingerprint。
- Cursor 使用 HMAC 签名，服务端能发现客户端是否修改了 document id、读取位置或 fingerprint。
- 当代际 fingerprint 改变时，旧 cursor 必须 fail closed，不能静默映射到新版本的“相同下一页”。
- Cursor 失效不会自动完成重新读取。Agent 或 orchestrator 必须显式重新定位新版内容，避免把新旧证据拼接在一起。

## 需要保留的边界

- HMAC 提供完整性和真实性校验，不提供加密；不要把 secret 或敏感正文放进可解码的 cursor payload。
- Cursor 不能替代 RBAC。每次续读仍应重新校验当前调用者的租户、资源范围和 read 权限。
- 重新读取不等于机械地从头读取全文；可先重新列目录、检索锚点，再从新版相关位置开始。
- 应返回可分类的 stale cursor 错误，和签名错误、权限错误、参数错误区分开，防止 Agent 无条件重试。
- 生产设计还应考虑 TTL、HMAC key rotation、并发更新和旧版本是否允许被显式读取。

## 核心洞察

这个设计解决的不是普通分页，而是跨请求的 snapshot consistency：一次逻辑阅读必须引用同一个不可变内容代际。Cursor 同时承担 continuation token、版本书签和受限 capability 的角色。
