# ZYM Knowledge Base

Personal knowledge base powered by the LLM Wiki pattern (inspired by Karpathy).

## Architecture

- **`CLAUDE.md`** — L1 cache: schema & rules for the AI knowledge manager
- **`raw/`** — Immutable source materials
- **`wiki/`** — LLM-compiled knowledge pages
- **`mcp-server/`** — MCP server exposing wiki operations to any AI tool

## MCP Server

The knowledge base is exposed as an MCP server with these tools:

| Tool | Description |
|------|-------------|
| `wiki_ingest` | Add a raw source and create/update wiki pages |
| `wiki_query` | Search the wiki for information |
| `wiki_list` | List all wiki pages |
| `wiki_read` | Read a specific wiki page |
| `wiki_lint` | Health check: find broken links, orphans, missing sources |

### Setup

```bash
cd mcp-server && npm install
```

### MCP Config

Add to your MCP client config:

```json
{
  "mcpServers": {
    "zym-knowledge": {
      "command": "node",
      "args": ["/path/to/zym-knowledge/mcp-server/server.js"]
    }
  }
}
```

## Usage

### Codex 用户级技能

`skills/zym-knowledge/SKILL.md` 提供个人知识库的查询、入库与维护流程，可通过 Codex 的 skill-installer 从本仓库路径 `skills/zym-knowledge` 安装到用户级 skills 目录。安装后可用 `$zym-knowledge` 调用，也可直接提出“把这个教训加入个人知识库”。

技能默认定位 `$HOME/Documents/Projects/zym-knowledge`，也接受用户指定的 checkout 或 `ZYM_KNOWLEDGE_DIR`。它通过本地文件和 Git 工作，不要求额外注册 MCP。

The AI knowledge manager (configured via CLAUDE.md) handles three operations:

1. **Ingest** — Feed raw sources → LLM creates/updates wiki pages
2. **Query** — Ask questions → LLM searches wiki → synthesizes answers
3. **Lint** — Health check → find contradictions, orphans, broken links
