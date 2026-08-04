---
title: "版本绑定且带 HMAC 签名的 Cursor：保证 Agent 文档续读一致性"
created: 2026-08-04
last_updated: 2026-08-04
source: "Codex 对话：Task Platform 文档续读设计"
tags: [agent, agent-harness, cursor, hmac, pagination, rag, reliability, security, snapshot-consistency, system-design]
sources: [raw/2026-08-04-version-bound-signed-cursor.md]
---

# 版本绑定且带 HMAC 签名的 Cursor：保证 Agent 文档续读一致性

## 一句话结论

Agent 分段读取可变文档时，cursor 应是一个**绑定内容代际、读取位置和授权范围，并由服务端签名的不透明书签**。文档代际变化后，旧 cursor 必须拒绝续读；上层再显式重新定位新版内容，从而避免一条回答混用不同版本的证据。

## 它解决的不是普通分页问题

普通分页通常假设数据变化的后果只是“少一条、重复一条”。Agent 文档阅读的风险更大：前半段来自旧版，后半段来自新版，模型却会把两者当成同一份事实来源，形成难以察觉的证据污染。

例如：

```text
读取 2025 版前半段
        ↓ 获得 cursor C1
文档重新解析为 2026 版
        ↓
使用 C1 续读 → 必须返回 stale cursor
        ↓
重新检索或读取 2026 版 → 建立新的阅读链
```

因此，真正要保证的是一次逻辑阅读的 **snapshot consistency**：同一条阅读链只能引用同一个不可变内容代际。

## Cursor 应绑定什么

Cursor 不应只是 `page=2` 或 `offset=1000`，而应至少表达以下状态：

```yaml
tenant_id: 当前租户
kb_id: 当前知识库
doc_id: 当前文档
mode: outline | page | chunk
selector: 当前读取范围
generation: 内容代际 fingerprint
position: chunk_position + char_offset
expires_at: 可选的过期时间
```

其中 `generation` 是核心。它可以覆盖：

- 当前 parsing attempt；
- parsing revision；
- 全文产物路径；
- 参与读取的 chunk id、顺序和内容；
- 会影响语义或结构的 metadata。

这些字段发生变化，就意味着旧 cursor 所指向的“下一段”已经不再属于原来的快照。

## HMAC 到底保证什么

服务端可序列化 cursor payload，并计算：

```text
signature = HMAC(secret_key, encoded_payload)
cursor = encoded_payload.signature
```

续读时，服务端重新计算签名并用 constant-time comparison 校验。客户端只要修改了 `doc_id`、`kb_id`、读取位置或 `generation`，签名就不匹配。

HMAC 提供两项能力：

- **完整性**：cursor 内容没有被修改；
- **真实性**：cursor 是持有 secret key 的服务端签发的。

但 HMAC **不提供保密性**。如果 payload 只是 Base64 编码，客户端仍可读取其内容，所以不能把 secret、正文或不应暴露的内部信息放进去。确有保密需要时，应改用服务端存储的 opaque token，或使用带认证的加密方案。

## 文档更新后的正确行为

假设 Agent 正在读取 2025 版，下一次请求前文档变成 2026 版：

1. 服务端验证旧 cursor 的签名、资源绑定和权限。
2. 服务端重新计算当前文档的 `generation`。
3. 当前代际与 cursor 中的代际不一致，返回明确的 `stale_cursor` 类错误。
4. Agent 或 orchestrator 丢弃旧阅读链中尚未提交的推理状态。
5. 上层重新列目录、检索锚点或从新版起点读取，获得新的 cursor。

关键点是：**cursor 服务只负责拒绝跨版本续读，不应静默替 Agent 自动重读。** 是否重读、从哪里重新定位、旧证据能否保留，属于 Agent workflow 的显式恢复策略。

也不一定要机械地“从第一页开始”。如果新版仍可搜索，可以重新检索相同主题或结构锚点，再从相关位置建立一条新的、版本一致的阅读链。

## 为什么不能映射到新版的相同页码

页码、chunk index 和 offset 都不是稳定语义标识。一次重新解析可能改变：

- OCR 或 Markdown 结构；
- 表格展开方式；
- chunk 边界和数量；
- 标题层级；
- metadata；
- 同一 offset 对应的实际文本。

所以“2025 版的下一页”并不等于“2026 版相同位置”。静默映射看似更顺滑，实质上把一致性错误隐藏起来。

## Cursor 不能替代权限校验

签名 cursor 可以被理解成一种受限 capability，但它不是永久通行证。每次续读仍应重新执行：

- 当前调用者身份解析；
- tenant 与 resource scope 校验；
- RBAC 的 `read` 权限判断；
- cursor 中 `tenant_id`、`kb_id`、`doc_id` 与请求上下文的一致性校验。

原因是 cursor 签发后，用户权限可能被撤销，文档也可能移动到其他范围。只验证签名会把“过去允许”错误地当成“现在仍允许”。这与 [[agent-system-architecture]] 中工具权限和运行时身份的分层原则一致。

## 错误分类决定 Agent 能否正确恢复

不要把所有失败都返回为笼统的 `invalid cursor`。至少应区分：

| 错误 | 含义 | Agent 策略 |
|---|---|---|
| `stale_cursor` | 文档代际已变化 | 重新定位新版内容 |
| `invalid_signature` | cursor 被篡改、损坏或 key 不兼容 | 停止使用该 cursor，不盲目重试 |
| `expired_cursor` | 超过 TTL | 重新发起读取 |
| `permission_denied` | 当前身份已无权读取 | 停止并按权限流程处理 |
| `resource_mismatch` | cursor 与当前 tenant、KB 或文档不匹配 | 视为调用错误或越权尝试 |

显式分类能防止 Agent 把权限失败当成瞬时错误无限重试，也能让 observability 准确区分内容更新与安全事件。这与 [[long-horizon-agent-drift-loop-control]] 中“按失败类别决定恢复策略”的原则相同。

## 生产实现检查表

- Cursor payload 是否绑定 tenant、KB、document、mode、selector、position 和 generation？
- Generation 是否覆盖所有会改变阅读语义的产物，而不是只看文件名或更新时间？
- HMAC 是否使用足够强的 secret、SHA-256 等安全算法和 constant-time comparison？
- 是否支持 key id 与平滑 key rotation？
- 是否有 TTL，错误码是否能区分 stale、expired、tampered 和 forbidden？
- 每次请求是否重新做 RBAC，而不是信任旧 cursor？
- 文档变化后是否 fail closed，而不是静默跳到新版相似位置？
- Agent 是否有有界的 re-anchor 策略，并避免自动重读死循环？
- 测试是否覆盖 chunk 内容、顺序、metadata、全文路径和 revision 分别变化的 changed cases？
- 是否覆盖 cursor 篡改、跨租户复用、权限撤销和未变化文档正常续读等 negative cases？

## 可迁移的设计启发

这个模式不限于 RAG 文档阅读。只要“下一步”依赖一个可能变化的服务端快照，就可以考虑版本绑定的签名 continuation token，例如：

- 审批流或工作流的分页历史；
- Agent 对长任务 artifact 的分段读取；
- 搜索结果的稳定翻页；
- 数据导出和批处理续跑；
- 会话压缩后对持久化历史的恢复。

它和 [[agent-harness-durable-compaction-runtime-boundary]] 有共同原则：**恢复凭证必须绑定产生它的状态代际，不能让旧边界静默解释新状态。**

## Related

- [[agent-harness-durable-compaction-runtime-boundary]]
- [[agent-system-architecture]]
- [[long-horizon-agent-drift-loop-control]]
- [[rag-retrieval-2026-lessons]]
