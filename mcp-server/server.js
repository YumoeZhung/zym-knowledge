import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const WIKI_ROOT = path.resolve(import.meta.dirname, "..");
const WIKI_DIR = path.join(WIKI_ROOT, "wiki");
const RAW_DIR = path.join(WIKI_ROOT, "raw");
const INDEX_DIR = path.join(WIKI_DIR, ".indexes");

const server = new McpServer({
  name: "zym-knowledge",
  version: "1.0.0",
});

// --- Helper Functions ---

async function listWikiPages() {
  const files = await fs.readdir(WIKI_DIR);
  return files.filter((f) => f.endsWith(".md") && !f.startsWith("."));
}

async function searchWiki(query) {
  const pages = await listWikiPages();
  const results = [];
  const queryLower = query.toLowerCase();

  for (const page of pages) {
    const content = await fs.readFile(path.join(WIKI_DIR, page), "utf-8");
    if (content.toLowerCase().includes(queryLower)) {
      results.push({ page, content });
    }
  }
  return results;
}

async function updateMasterIndex() {
  const pages = await listWikiPages();
  const rawFiles = await fs.readdir(RAW_DIR).catch(() => []);
  const rawCount = rawFiles.filter((f) => !f.startsWith(".")).length;

  let pageList = "";
  for (const page of pages) {
    const content = await fs.readFile(path.join(WIKI_DIR, page), "utf-8");
    const titleMatch = content.match(/^title:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : page.replace(".md", "");
    pageList += `- [[${page.replace(".md", "")}]] — ${title}\n`;
  }

  const now = new Date().toISOString().split("T")[0];
  const index = `---
title: Master Index
created: 2026-05-19
last_updated: ${now}
---

# Master Index

Central index of all wiki pages in the knowledge base.

## Pages

${pageList || "_No pages yet._"}

## Statistics

- Total pages: ${pages.length}
- Total raw sources: ${rawCount}
- Last ingest: ${now}
`;

  await fs.writeFile(path.join(INDEX_DIR, "master-index.md"), index);
}

// --- MCP Tools ---

server.tool(
  "wiki_ingest",
  "Ingest a raw source into the knowledge base. Provide the filename and content.",
  {
    filename: z.string().describe("Filename for the raw source (e.g., '2026-05-19-article.md')"),
    content: z.string().describe("The raw source content to ingest"),
    summary: z.string().describe("A brief summary to create as a wiki page"),
    wiki_page_name: z.string().describe("The wiki page filename (kebab-case, without .md)"),
    tags: z.array(z.string()).optional().describe("Tags for the wiki page"),
  },
  async ({ filename, content, summary, wiki_page_name, tags }) => {
    // Save raw source
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.writeFile(path.join(RAW_DIR, filename), content);

    // Create/update wiki page
    const now = new Date().toISOString().split("T")[0];
    const tagStr = tags ? `[${tags.join(", ")}]` : "[]";
    const wikiContent = `---
title: ${wiki_page_name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
created: ${now}
last_updated: ${now}
tags: ${tagStr}
sources: [raw/${filename}]
---

# ${wiki_page_name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}

${summary}

## Related

_No related pages yet._
`;

    await fs.writeFile(path.join(WIKI_DIR, `${wiki_page_name}.md`), wikiContent);
    await updateMasterIndex();

    return {
      content: [
        {
          type: "text",
          text: `Ingested "${filename}" → wiki page "${wiki_page_name}.md" created. Master index updated.`,
        },
      ],
    };
  }
);

server.tool(
  "wiki_query",
  "Search the knowledge base wiki for information matching a query.",
  {
    query: z.string().describe("Search query to find in wiki pages"),
  },
  async ({ query }) => {
    const results = await searchWiki(query);

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `No wiki pages found matching "${query}".` }],
      };
    }

    const output = results
      .map((r) => `## ${r.page}\n\n${r.content}`)
      .join("\n\n---\n\n");

    return {
      content: [{ type: "text", text: output }],
    };
  }
);

server.tool(
  "wiki_list",
  "List all pages in the knowledge base wiki.",
  {},
  async () => {
    const pages = await listWikiPages();
    if (pages.length === 0) {
      return { content: [{ type: "text", text: "Wiki is empty. No pages found." }] };
    }
    return {
      content: [{ type: "text", text: `Wiki pages (${pages.length}):\n${pages.map((p) => `- ${p}`).join("\n")}` }],
    };
  }
);

server.tool(
  "wiki_read",
  "Read the full content of a specific wiki page.",
  {
    page: z.string().describe("Wiki page filename (with or without .md)"),
  },
  async ({ page }) => {
    const filename = page.endsWith(".md") ? page : `${page}.md`;
    try {
      const content = await fs.readFile(path.join(WIKI_DIR, filename), "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch {
      return { content: [{ type: "text", text: `Page "${filename}" not found.` }] };
    }
  }
);

server.tool(
  "wiki_lint",
  "Run a health check on the wiki: find orphan pages, broken links, missing sources.",
  {},
  async () => {
    const pages = await listWikiPages();
    const issues = [];

    for (const page of pages) {
      const content = await fs.readFile(path.join(WIKI_DIR, page), "utf-8");

      // Check for broken wikilinks
      const links = content.match(/\[\[([^\]]+)\]\]/g) || [];
      for (const link of links) {
        const target = link.slice(2, -2) + ".md";
        try {
          await fs.access(path.join(WIKI_DIR, target));
        } catch {
          issues.push(`Broken link in ${page}: ${link}`);
        }
      }

      // Check for missing source citations
      if (!content.includes("sources:") || content.includes("sources: []")) {
        issues.push(`Missing sources in ${page}`);
      }

      // Check for missing related section
      if (!content.includes("## Related")) {
        issues.push(`Missing Related section in ${page}`);
      }
    }

    // Check for orphan pages (no inbound links)
    for (const page of pages) {
      const pageName = page.replace(".md", "");
      let hasInbound = false;
      for (const other of pages) {
        if (other === page) continue;
        const content = await fs.readFile(path.join(WIKI_DIR, other), "utf-8");
        if (content.includes(`[[${pageName}]]`)) {
          hasInbound = true;
          break;
        }
      }
      if (!hasInbound && pages.length > 1) {
        issues.push(`Orphan page (no inbound links): ${page}`);
      }
    }

    if (issues.length === 0) {
      return { content: [{ type: "text", text: "Wiki is healthy! No issues found." }] };
    }

    return {
      content: [{ type: "text", text: `Found ${issues.length} issue(s):\n${issues.map((i) => `- ${i}`).join("\n")}` }],
    };
  }
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
