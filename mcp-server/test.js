import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";

const SERVER_PATH = path.join(import.meta.dirname, "server.js");

async function runTests() {
  console.log("=== ZYM Knowledge Base — End-to-End Test ===\n");

  // Connect to MCP server
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
  console.log("✓ Connected to MCP server\n");

  // List available tools
  const tools = await client.listTools();
  console.log(`✓ Available tools: ${tools.tools.map((t) => t.name).join(", ")}\n`);

  // Test 1: wiki_list (should be empty)
  console.log("--- Test 1: List empty wiki ---");
  const listResult = await client.callTool({ name: "wiki_list", arguments: {} });
  console.log(listResult.content[0].text);
  console.log();

  // Test 2: wiki_ingest
  console.log("--- Test 2: Ingest a raw source ---");
  const ingestResult = await client.callTool({
    name: "wiki_ingest",
    arguments: {
      filename: "2026-05-19-karpathy-llm-wiki.md",
      content: `# Karpathy's LLM Wiki Concept

Published: April 2, 2026

The core idea: instead of using RAG (retrieving from raw documents each query), 
have an LLM incrementally build and maintain a persistent Wiki — a set of structured,
interlinked Markdown files.

Three-layer architecture:
- Raw Sources (immutable)
- Wiki (LLM-generated Markdown pages)
- Schema (CLAUDE.md rules)

Three operations:
- Ingest: new source → LLM reads → writes summary → updates related pages → maintains index
- Query: question → LLM searches wiki → synthesizes answer
- Lint: find contradictions, outdated info, orphan pages, broken links`,
      summary: `Karpathy's LLM Wiki is a knowledge management approach where an LLM incrementally maintains a structured Markdown wiki instead of using RAG. It uses a three-layer architecture (Raw Sources → Wiki → Schema) and supports three operations: Ingest (add new knowledge), Query (search and synthesize), and Lint (health checks).

The key insight is that maintaining a knowledge base is mostly "bookkeeping drudgery" (updating cross-references, keeping summaries consistent) — work that LLMs excel at without getting tired.`,
      wiki_page_name: "karpathy-llm-wiki",
      tags: ["knowledge-management", "llm", "wiki", "architecture"],
    },
  });
  console.log(ingestResult.content[0].text);
  console.log();

  // Test 3: wiki_list (should have one page)
  console.log("--- Test 3: List wiki after ingest ---");
  const listResult2 = await client.callTool({ name: "wiki_list", arguments: {} });
  console.log(listResult2.content[0].text);
  console.log();

  // Test 4: wiki_query
  console.log("--- Test 4: Query the wiki ---");
  const queryResult = await client.callTool({
    name: "wiki_query",
    arguments: { query: "three-layer architecture" },
  });
  console.log(queryResult.content[0].text.substring(0, 300) + "...");
  console.log();

  // Test 5: wiki_read
  console.log("--- Test 5: Read specific page ---");
  const readResult = await client.callTool({
    name: "wiki_read",
    arguments: { page: "karpathy-llm-wiki" },
  });
  console.log(readResult.content[0].text.substring(0, 300) + "...");
  console.log();

  // Test 6: wiki_lint
  console.log("--- Test 6: Lint the wiki ---");
  const lintResult = await client.callTool({ name: "wiki_lint", arguments: {} });
  console.log(lintResult.content[0].text);
  console.log();

  // Test 7: Ingest a second source and verify cross-referencing
  console.log("--- Test 7: Ingest second source ---");
  const ingest2Result = await client.callTool({
    name: "wiki_ingest",
    arguments: {
      filename: "2026-05-19-l1-l2-cache.md",
      content: `# L1/L2 Cache Architecture for LLM Wiki

Based on Karpathy's LLM Wiki concept, the L1/L2 cache pattern separates knowledge into:
- L1 (CLAUDE.md): session-critical rules, always loaded
- L2 (wiki pages): queryable knowledge, loaded on demand

This addresses the context window limitation by ensuring only essential rules consume tokens.`,
      summary: `The L1/L2 cache architecture extends [[karpathy-llm-wiki]] by separating knowledge into two tiers: L1 cache (always-loaded session rules in CLAUDE.md) and L2 cache (queryable wiki pages loaded on demand). This optimizes context window usage.`,
      wiki_page_name: "l1-l2-cache-architecture",
      tags: ["knowledge-management", "architecture", "caching"],
    },
  });
  console.log(ingest2Result.content[0].text);
  console.log();

  // Test 8: Final list
  console.log("--- Test 8: Final wiki state ---");
  const listResult3 = await client.callTool({ name: "wiki_list", arguments: {} });
  console.log(listResult3.content[0].text);
  console.log();

  // Test 9: Lint again (should detect cross-reference issues)
  console.log("--- Test 9: Lint after second ingest ---");
  const lintResult2 = await client.callTool({ name: "wiki_lint", arguments: {} });
  console.log(lintResult2.content[0].text);
  console.log();

  console.log("=== All tests completed! ===");

  await client.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
