---
source: https://github.com/Fission-AI/OpenSpec
captured: 2026-06-05
type: article
---

# OpenSpec: Spec-Driven Development for AI Coding Assistants

Source: GitHub repo README + docs/concepts.md

## README Summary

OpenSpec is a spec-driven development (SDD) framework for AI coding assistants. Philosophy:
- fluid not rigid
- iterative not waterfall
- easy not complex
- built for brownfield not just greenfield
- scalable from personal projects to enterprises

Workflow: `/opsx:propose` → create change folder → `/opsx:apply` → implement → `/opsx:archive`

Quick Start: `npm install -g @fission-ai/openspec@latest` → `openspec init` → use slash commands

Supports 25+ AI tools. Works with pnpm, yarn, bun, nix.

Comparison:
- vs Spec Kit (GitHub): heavyweight, rigid phase gates. OpenSpec is lighter.
- vs Kiro (AWS): locked to their IDE and Claude models. OpenSpec is tool-agnostic.
- vs nothing: AI coding without specs = vague prompts + unpredictable results.

## Concepts Doc Summary

### Core Structure
```
openspec/
├── specs/        # Source of truth (current system behavior)
└── changes/      # Proposed modifications (each = one folder)
```

### Artifact Flow
proposal (why) → specs (what) → design (how) → tasks (steps) → implement

### Delta Specs
Key innovation: describe WHAT'S CHANGING, not rewrite entire spec.
- ADDED Requirements
- MODIFIED Requirements
- REMOVED Requirements

Benefits: clarity, conflict avoidance, review efficiency, brownfield fit.

### Spec Format
- Requirements use RFC 2119 keywords (MUST/SHALL/SHOULD/MAY)
- Scenarios use Given/When/Then structured format
- Behavior contracts, NOT implementation plans

### Archive Process
1. Merge deltas into main specs
2. Move change folder to archive/ with date prefix
3. All context preserved for audit trail

### Schemas
Define artifact types and dependency graphs. Dependencies are enablers, not gates.

### Coordination Workspaces (beta)
For multi-repo or multi-folder coordination. Machine-local views over linked repos.
