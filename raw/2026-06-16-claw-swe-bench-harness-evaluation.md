---
source: https://mp.weixin.qq.com/s/iCty7MvtQDZzJNhV9nCZIA
captured: 2026-06-16
type: article
---

# 打破SWE-bench唯分数论，首个独立测量harness的基准开源了

Source archive note: this file preserves metadata, source links, and extracted factual claims in original wording-neutral form rather than a full verbatim copy of the article.

- Publisher: 机器之心
- Published: 2026-06-15 14:10:39 Asia/Shanghai
- Description: 编程 Agent 评测迎来另一半真相。
- Original URL: https://mp.weixin.qq.com/s/iCty7MvtQDZzJNhV9nCZIA
- Paper: https://arxiv.org/pdf/2606.12344v1
- Code: https://github.com/opensquilla/claw-swe-bench
- Dataset: https://huggingface.co/datasets/TokenRhythm/Claw-SWE-Bench

## Extracted Claims

- SWE-bench-style reporting often hides three variables inside one number: base model, harness design, and task set.
- Claw-SWE-Bench introduces an adapter layer so general-purpose OpenClaw-style agents can be evaluated on SWE-bench-like software repair tasks through standardized patches.
- The benchmark contains 350 real GitHub issue repair tasks across 8 programming languages and 43 repositories.
- A Lite-80 subset contains 80 tasks, with 10 examples per language, designed for cheaper iteration.
- Full-350 and Lite-80 reportedly produce similar aggregate Pass@1 signals across calibration columns while Lite costs about 22.9% of the full benchmark.
- The benchmark fixes an answer-leakage issue found in SWE-bench-Multilingual containers where post-base-commit Git history remained reachable.
- In the adapter ablation cited by the article, a bare adapter that asked the model to output a diff directly performed far worse than a full adapter that let the agent edit files in `/testbed` and exported the patch from Git state.
- In model sweeps with a fixed OpenClaw harness, top models reached roughly high-70s Pass@1, but API cost differed by orders of magnitude.
- In harness sweeps with a fixed model, changing the harness produced double-digit Pass@1 swings, suggesting harness design can be as consequential as model selection.
- The article argues that coding-agent evaluations should report cost, token use, cache behavior, prompt, budget, task set, and harness details, not only Pass@1.

## Reusable Takeaways

- Treat `model x harness x task set x budget` as the actual experimental unit.
- Make adapters explicit: a bad evaluation interface can suppress an agent's real capability.
- Prefer Pareto-front reporting over leaderboard-only reporting when cost matters.
- Use small calibrated benchmark slices for iteration, but keep a larger suite for formal claims.
- Sanitize repository history and workspace state before scoring software-repair agents.
