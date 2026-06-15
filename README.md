# DevloopCockpit

**A complete, opinionated, autonomous development loop you drop into a green-field software project — as a single [Claude Code](https://claude.com/claude-code) skill.**

DevloopCockpit packages the `agentic-devloop` skill: a long-lived **cockpit** session that spawns fresh `plan` → `execute` → `review` stage sessions, each under its own least-privilege permission fence with a **machine-checked exit contract gated on tool-result evidence (never model prose)**, guarded by a multi-lens adversarial review gate, and fed by tracer-bullet vertical-slice backlog decomposition. The point is reliable AI-built software **without runaway agents**.

It is the portable distillation of a production dev loop that builds itself — including the failure modes it learned the hard way.

## Philosophy

**1 unit of work = 1 branch = 1 loop = 1 PR = 1 merge.** The fixed pipeline runs in full regardless of unit size — *the ceremony is the point*: it makes every step auditable and the loop self-correcting.

- The **audit trail IS the enforcement** — committed artifacts + the tracker comment trail + a durable chain log, not trust in the agent.
- Stages **gate on tool-result evidence, never on assistant prose** — a stage may stop only on files-written / a test stamp newer than `HEAD` / clean lint+security / a real PR / a `DONE` report, or a structured `ESCALATION`.
- Run units **in parallel between independent ones, strictly sequential within a coupled one.**
- A long-lived orchestrator **never implements**; it spawns each stage as a fresh detached session inheriting nothing but committed artifacts and a pointer-only handoff.

## The 8 pillars

Each is one self-contained file under [`reference/`](reference/) — readable on its own, no plugin required:

1. **Staged unit-of-work loop** — the fixed `pull → … → PR(last) → merge` pipeline; grain = a demoable workflow, never a leaf task. → [`reference/01-staged-loop.md`](reference/01-staged-loop.md)
2. **Grill-before-build** — one-question-at-a-time interrogation (agent always offers its recommended answer); a single-canonical-term glossary + gated ADRs, written lazily. → [`reference/02-design-grill.md`](reference/02-design-grill.md)
3. **Cockpit / headless-stage orchestration** — one orchestrator that never implements; reads bounded reports, never transcripts; auto-chains; three notifications; crash-recovers from the chain log. → [`reference/03-cockpit-orchestration.md`](reference/03-cockpit-orchestration.md)
4. **Exit contracts + least-privilege fences** — a Stop-hook that judges only tool-result blocks; rejects stale/partial evidence; each stage under a tight allowlist with an un-overridable circuit-breaker. → [`reference/04-exit-contracts-fences.md`](reference/04-exit-contracts-fences.md)
5. **Multi-lens adversarial review trio** — parallel block-by-default security/QA/usability finders; every high finding gets a refuter; a severity-triage gate, not zero-findings. → [`reference/05-review-trio.md`](reference/05-review-trio.md)
6. **Backlog decomposition** — three-tier grain (slice → workflow unit → step); every issue a tracer-bullet vertical slice; durable, path-free agent briefs. → [`reference/06-backlog-decomposition.md`](reference/06-backlog-decomposition.md)
7. **Spawn & workspace machinery** — detached worktree sessions; laundered identity env; worktree-local non-interactive signing; atomic `.partial`+`mv` writes; the JSON test stamp. → [`reference/07-spawn-machinery.md`](reference/07-spawn-machinery.md)
8. **Governance constitution** — an always-loaded constitution that hard-routes task classes to mandatory workflows; the expensive architectural bet adopted day one, fail-closed; durable cross-session memory. → [`reference/08-governance.md`](reference/08-governance.md)

And the most valuable file of all — [`reference/failure-modes.md`](reference/failure-modes.md): the scar tissue. False-completion on a green-but-partial suite, prose-fooled exit checks, fence workarounds, TOCTOU partial reads, stale CI proof, alarm fatigue from over-fencing, the tracker↔VCS auto-close gap, and async-UI test flakes — each as a stack-neutral rule with symptom / rule / why.

## Layout

```
SKILL.md                  # the always-loaded entry point (<100 lines): philosophy, loop, pillar index
config.template.sh        # THE seam — the one file you fill in per project
reference/                # the 8 pillars + failure-modes (progressive-disclosure depth)
scripts/                  # the runnable machinery (genericized from a production loop)
  devloop-spawn           #   launch a headless stage session
  devloop-worktree        #   create an isolated per-unit worktree + non-interactive signing
  devloop-test            #   run the suite, emit the deterministic JSON trust-stamp
  review-trio.js          #   parallel security/QA/usability finders + adversarial refuter
  onboard / doctor        #   idempotent env bootstrap + read-only readiness check
  stage-settings/         #   per-stage permission allowlists + Stop-hook exit evaluators
templates/                # drop-in starters: constitution, glossary, ADR, agent brief, handoff
```

## Install

It is a Claude Code skill, so clone it straight into a skills directory under the canonical skill name `agentic-devloop`:

```bash
# user-level (available in every project)
git clone git@github.com:rkaregaran/DevloopCockpit.git ~/.claude/skills/agentic-devloop

# or project-level
git clone git@github.com:rkaregaran/DevloopCockpit.git .claude/skills/agentic-devloop
```

Then invoke the **agentic-devloop** skill in Claude Code.

## Setup (one-time per project)

```bash
cd <skill-dir>
cp config.template.sh config.sh     # config.sh is gitignored — it's yours
$EDITOR config.sh                    # issue-id regex, tracker/host, path roots, verification profile, fence, notify()
scripts/onboard                      # idempotent: mutates, then exec's read-only scripts/doctor
```

`config.sh` is the **only** project-specific surface — every script and stage-settings file reads from it, so the rest of the bundle stays project-agnostic.

## Stack assumptions

Ships **concrete for Linear + GitHub + Rails on the Claude Code harness (macOS/Linux)** — those are real, working defaults, not placeholders. Porting to another tracker / VCS host / language stack is an edit to `config.template.sh`, not a rewrite: the verification profile (`TEST_CMD` / `LINT_CMD` / `SECURITY_CMD` / `MIGRATE_CMD` / …), the issue-id pattern, path roots, the circuit-breaker fence, and the `notify()` adapter are all variables there.

The full headless-cockpit tier binds to the Claude Code CLI (`claude -p`, per-stage `--settings`, Stop hooks). Harness-specific lines in the scripts are marked `# HARNESS-SPECIFIC:` so they are easy to re-derive for another runner.

## Status

Distilled from a production dev loop and verified end-to-end by a dry-run (worktree creation + a stubbed spawn + atomic chain-log write, with every guardrail firing). It is **opinionated by design** — the loop shape, gates, and exit contracts are rigid; the stack is swappable. Adopt the opinions or fork them.

## License

MIT — see [LICENSE](LICENSE).
