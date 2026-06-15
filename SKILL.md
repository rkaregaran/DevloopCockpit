---
name: agentic-devloop
description: Set up, run, or harden an autonomous/headless agent development pipeline — a long-lived cockpit that spawns fresh plan/execute/review stage sessions, each under its own least-privilege permission fence with a machine-checked exit contract gated on tool-result evidence (never prose), guarded by a multi-lens adversarial review gate, fed by tracer-bullet vertical-slice backlog decomposition. Use when you want reliable AI-built software without runaway agents, asked to build/operate an AFK or unattended dev loop on Linear+GitHub+Rails, set up per-stage allowlists, write exit gates, orchestrate parallel agent stages, or decompose a plan into independently-mergeable units.
---

# agentic-devloop

A complete autonomous development loop you drop into a green-field SaaS repo. It ships concrete for **Linear + GitHub + Rails on the Claude Code harness**; the only project-specific surface lives in `config.template.sh`.

## Philosophy

**1 unit = 1 branch = 1 loop = 1 PR = 1 merge.** The fixed pipeline runs in full regardless of unit size — **the ceremony is the point**: it makes every step auditable and the loop self-correcting. The **audit trail IS the enforcement** (committed artifacts + the tracker comment trail + a durable chain log, not trust in the agent). Stages **gate on tool-result evidence, never on assistant prose** — a stage may stop only on files-written / a test stamp newer than HEAD / clean lint+security / a real PR / a `DONE` report, or a structured `ESCALATION`. Run units **in parallel between independent ones, strictly sequential within a coupled one.** A long-lived orchestrator *never implements*; it spawns each stage as a fresh detached session inheriting nothing but committed artifacts and a pointer-only handoff.

## The loop

| Stage | Capability it invokes | Produces (evidence) |
|-------|----------------------|---------------------|
| pull | grab next ready unit; validate id against `$ISSUE_ID_PATTERN`; cut branch + worktree | branch, worktree |
| design-grill | interrogate human one question at a time; sharpen glossary; capture decisions | design artifact in `$ARTIFACT_ROOT` |
| stress-test | adversarial pre-mortem of the design | go / loop-back |
| plan | write the step-by-step build plan | plan artifact (atomic write) |
| build | test-driven implementation, one step at a time | code + green test stamp at `$TEST_STAMP_PATH` |
| self-verify | run full suite + lint + security; confirm against plan | clean stamp, no partial completion |
| review trio | security ‖ acceptance-QA ‖ usability finders, in parallel | severity-triaged findings |
| summary | write the unit summary | summary artifact |
| PR (**last**) | open PR with `$CLOSE_KEYWORD $ID`; re-poll CI on PR-head | real PR url |
| merge | human merge gate; verify tracker moved to Done | merged + closed |

## The 8 pillars

Each is one self-contained reference file (one hop, no other skill required):

1. **Staged unit-of-work loop** — the fixed pull→…→PR→merge pipeline; grain = a demoable workflow, never a leaf task. See [reference/01-staged-loop.md](reference/01-staged-loop.md).
2. **Grill-before-build** — one-question interrogation with a recommended answer; single-canonical-term glossary + gated ADRs, written lazily. See [reference/02-design-grill.md](reference/02-design-grill.md).
3. **Cockpit / headless-stage orchestration** — one orchestrator that never implements; reads bounded reports; auto-chains; three notifications; crash-recovers from the chain log. See [reference/03-cockpit-orchestration.md](reference/03-cockpit-orchestration.md).
4. **Exit contracts + least-privilege fences** — Stop-hook judges only tool-result blocks; rejects stale/partial evidence; each stage runs under a tight allowlist with an un-overridable circuit-breaker. See [reference/04-exit-contracts-fences.md](reference/04-exit-contracts-fences.md).
5. **Multi-lens adversarial review trio** — parallel block-by-default finders; every high finding gets a refuter; severity-triage gate, not zero-findings. See [reference/05-review-trio.md](reference/05-review-trio.md).
6. **Backlog decomposition** — three-tier grain (slice → workflow unit → step); every issue a tracer-bullet vertical slice; durable path-free agent briefs. See [reference/06-backlog-decomposition.md](reference/06-backlog-decomposition.md).
7. **Spawn & workspace machinery** — detached worktree sessions; laundered identity env; worktree-local non-interactive signing; atomic `.partial`+`mv` writes; the JSON test stamp. See [reference/07-spawn-machinery.md](reference/07-spawn-machinery.md).
8. **Governance constitution** — an always-loaded constitution that hard-routes task classes to mandatory workflows; the expensive architectural bet adopted day one, fail-closed; durable memory notes. See [reference/08-governance.md](reference/08-governance.md).

## Setup (one-time)

Copy `config.template.sh` to `config.sh`, fill in the values for your project — issue-id regex, tracker/host, path roots, the verification profile, the circuit-breaker fence, and `notify()`. Every script and stage-settings file reads from there, so the rest of the bundle stays project-agnostic. Then run `scripts/onboard` (idempotent; mutates, then exec's `scripts/doctor` with copy-pasteable remedies). Drop-in starters live in `templates/` (constitution snippet, glossary skeleton, ADR / agent-brief / handoff templates).

## Failure modes you must know

Read [reference/failure-modes.md](reference/failure-modes.md) before operating the loop: false-completion on a green-but-partial suite, prose-fooled exit checks, fence workarounds, TOCTOU partial reads, stale CI proof, alarm fatigue from over-fencing, and tracker↔VCS auto-close not firing.
