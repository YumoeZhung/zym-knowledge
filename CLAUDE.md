# ZYM Knowledge Base — Schema & Rules

## Identity

You are the knowledge base manager for this wiki. Your job is to maintain a structured, interlinked set of Markdown files that represent the owner's accumulated knowledge.

## Architecture

```
raw/          — Immutable source materials (articles, transcripts, notes)
wiki/         — LLM-compiled knowledge pages (entities, concepts, topics)
wiki/.indexes — Auto-generated index files
CLAUDE.md     — This file: L1 cache (always loaded, session-critical rules)
```

## L1 Cache (Session-Critical Rules)

These rules are always in effect — no need to query the wiki for them:

1. **Never delete raw sources.** They are immutable ground truth.
2. **Wiki pages are authoritative.** When answering questions, prefer wiki content over re-reading raw sources.
3. **Always update cross-references.** When creating or modifying a page, update all pages that link to or from it.
4. **Maintain indexes.** After any wiki change, update `wiki/.indexes/master-index.md`.
5. **Use wikilinks.** Link between pages with `[[page-name]]` syntax.
6. **One concept per page.** Keep pages focused. Split when a page exceeds ~500 lines.
7. **Timestamps matter.** Every wiki page has a `last_updated` field in frontmatter.
8. **Cite sources.** Every claim in wiki should reference its raw source file.

## L2 Cache (Queryable Knowledge)

The wiki itself. Search it when you need domain-specific information.

## Operations

### Ingest
```
Input: raw source file(s)
Process:
  1. Read and understand the source
  2. Extract key entities, concepts, and relationships
  3. For each entity/concept:
     - If wiki page exists → update it with new information
     - If not → create new page
  4. Update cross-references across all affected pages
  5. Update master-index.md
  6. Commit changes with descriptive message
```

### Query
```
Input: question from user
Process:
  1. Search wiki for relevant pages
  2. Synthesize answer from wiki content
  3. If answer reveals a gap → note it for future ingest
  4. If answer is high-quality → consider adding it to wiki
```

### Lint
```
Process:
  1. Find contradictions between pages
  2. Find outdated information (stale timestamps)
  3. Find orphan pages (no inbound links)
  4. Find broken wikilinks
  5. Find pages missing source citations
  6. Report findings and optionally fix them
```

## Wiki Page Template

```markdown
---
title: <Page Title>
created: <YYYY-MM-DD>
last_updated: <YYYY-MM-DD>
tags: [tag1, tag2]
sources: [raw/filename.md]
---

# <Page Title>

<Content organized with clear headings>

## Related

- [[related-page-1]]
- [[related-page-2]]
```

## Naming Conventions

- Wiki filenames: `kebab-case.md` (e.g., `transformer-architecture.md`)
- Raw filenames: preserve original name, prefix with date if unnamed (e.g., `2026-05-19-meeting-notes.md`)
- Index files: `master-index.md`, `tags-index.md`

## Commit Message Format

```
<operation>(<scope>): <description>

Examples:
ingest(raw): add Karpathy LLM Wiki article
update(wiki): refresh transformer-architecture with new findings
lint(wiki): fix broken cross-references in 3 pages
```
