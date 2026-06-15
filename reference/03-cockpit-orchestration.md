# Pillar 3 — Cockpit / headless-stage orchestration

One long-lived **orchestrator** drives a unit through its loop by spawning each
implementation stage as a fresh, detached headless session. The orchestrator
**never implements** — it owns the tracker trail, the chaining, the notifications,
and the crash-recovery state. The stages own artifacts, commits, and the PR. This
split is what keeps the orchestrator's context small enough to run a whole unit
end-to-end without drowning in stage detail.

## The orchestrator/stage split

| | Orchestrator | Stage (plan / execute / review) |
|---|---|---|
| Lifespan | Long-lived; spans the whole unit | Fresh per stage; dies at its exit contract |
| Writes code/artifacts | **Never** | Yes — the only thing it does |
| Reads | Bounded **reports** only | The committed artifacts + its handoff |
| Owns | Tracker trail, chaining, notifications, chain log | Its own commit(s), suite stamp, and (review) the PR |
| Posts to tracker | **All** comments (single writer) | Nothing — it relays via its report |

The interactive design session that produced and hardened the design *becomes* the
orchestrator. From that point it stops typing code forever and only conducts.

## Each stage is spawned FRESH

A stage inherits **nothing** from any prior conversation. It boots from exactly
two things:

1. **Committed artifacts** — the design and plan files under `$ARTIFACT_ROOT`,
   already pushed to the branch, plus the worktree under `$WORKTREE_ROOT`.
2. **A pointer-only handoff doc** under `$HANDOFF_ROOT` (see Pillar 7 for the
   spawn mechanics and the handoff template).

The handoff is **pointers, not content**: repo-relative paths and permalinks, the
exit contract restated, and stage-specific gotchas. It **NEVER inlines artifact
text** — if you are pasting a design or a plan into the handoff, you are
duplicating an artifact that will drift; point at it instead. (The single allowed
inlining is the acceptance spec for the review stage, because a spawned session may
lack tracker access — see Pillar 5.)

Every fresh cut doubles as a clean-room audit: a stage that *cannot* proceed from
the artifacts alone has found an **upstream defect** (loop it back — Pillar 1
rework routing), not a license to improvise.

## The chain (automatic)

The stages run in a fixed order, each chaining to the next with **no blocking gate
between them**:

| Stage | Handoff adds | Envelope (tune per stack) |
|---|---|---|
| plan | design pointer, branch, worktree | ~30 min |
| execute | += plan pointer | ~2–4 h |
| review | += acceptance spec inline, `uiChanged` flag | ~45 min |

`plan → execute → review` chains automatically: when a stage's report says it
succeeded, the orchestrator posts its trail comment(s) and immediately spawns the
next stage. There is no human approval step *between* stages — the human's control
surface is intentionally narrow (below).

## The orchestrator reads bounded REPORTS, never transcripts

Each stage writes a single report to `$HANDOFF_ROOT` whose **first line is `DONE`
or `ESCALATION`**. The orchestrator reads only that report. It must **NEVER read a
stage's full session transcript** — doing so re-bloats the very context this
topology exists to keep small. The report carries a short summary plus permalinks;
that is the entire interface back to the orchestrator.

Per stage, the orchestrator waits for the report (a bounded background poll —
never a foreground sleep; on hosts lacking GNU `timeout`, use a counting loop with
`envelope ÷ poll-interval` iterations), then branches:

- **First line `DONE`** → read the report (bounded), run the **denial-intent
  check** below, post the stage's tracker comment(s), append the provenance
  footer, and chain the next stage.
- **First line `ESCALATION`** → post it to the trail, fire the escalation
  notification, and **STOP the chain**. A design-defect bounce names its loop-back
  stage; on the human's go-ahead, respawn from there with an amended handoff.
- **Timeout, no report** → diagnose from the stage's stderr log and session JSON;
  treat as an escalation (post + notify + stop). Three respawns of the same stage
  is a hard stop (Pillar 1).

**Denial-intent check (judge intent, not a raw count).** Read the stage session's
`permission_denials`. **Ignore** cosmetic/diagnostic denials (preview/Quick-Look
calls, read-only diagnostics like `cat`/`head`/`grep`/`find`/git reads, dynamic
tool gates). For any *remaining* denial, **independently verify the gated
deliverable is genuinely real** — commit pushed *and* signed; the test stamp at
`$TEST_STAMP_PATH` fresh (mtime newer than HEAD); the PR actually exists. Escalate
**only if you cannot confirm it** — i.e. the stage circumvented a fence to
*fabricate* its deliverable. A clean, verified deliverable with only cosmetic
denials is **not** escalated. (See Pillar 4 for the fence itself.)

## Human control surface = async veto + the merge gate

There are **exactly two** points of human control, both deliberately out of the
hot path:

1. **Async veto** — the human may stop the chain at any stage boundary. The
   orchestrator stops chaining (does not spawn the next stage); the in-flight
   stage finishes idle — its work stays on the branch, harmless. Post the veto +
   correction to the trail; respawn from the corrected boundary with an amended
   handoff.
2. **The merge gate** — the final, absolute gate. The orchestrator opens the PR;
   the human merges. Nothing auto-merges.

## Exactly three notifications

The orchestrator interrupts the human on **exactly three events** and no others
(routed via `notify <event> <message>` from `config.sh`):

1. **plan-ready** — the plan report came back `DONE`; the veto window is open and
   the chain continues.
2. **escalation** — any `ESCALATION`, timeout, or unverifiable fenced deliverable;
   the chain has stopped and needs the human.
3. **pr-open** — the review stage opened the PR; the merge gate is live.

Over-notifying re-creates the alarm fatigue this topology exists to kill. Three.

## Single-writer append-only tracker trail — the trail IS the enforcement

The orchestrator is the **sole writer** to the tracker. Stage sessions may have
tracker access but **must not post** — single-writer keeps the trail coherent and
ordered. Each stage's comment(s) are **append-only**: a failed or vetoed comment is
**never deleted**, only superseded by a new one. The accumulated, timestamped trail
*is* the audit history **and** the enforcement mechanism — a unit cannot reach Done
without the full marker set present (Pillar 1's Done contract).

**Provenance footer (append to every stage comment).** Parse the stage's session
JSON (`session_id`, `duration_ms`, `total_cost_usd`, `usage.output_tokens`) and
append a one-line provenance footer so every comment is traceable back to the
exact session that produced it:

    —
    session `<id>` · <m:ss> · $<cost> · <output_tokens> out-tok

This footer is what makes the trail an audit record rather than a status log: each
claim is tied to a verifiable session id, duration, and cost.

## Durable chain log + idempotent adopt/resume (crash recovery)

The orchestrator is a process; processes die. Two mechanisms make a dead
orchestrator recoverable with **no lost work and no double-spawns**:

1. **Durable on-disk chain log.** `bin/devloop-spawn` appends every spawn (stage,
   session id, session-JSON path, timestamp) to a per-unit log under
   `$CHAIN_LOG_ROOT` — durable, outside the repo, and **not** `$TMPDIR`. Combined
   with the append-only tracker trail, this is enough to reconstruct exactly how
   far the chain got.
2. **Idempotent adopt/resume.** A fresh orchestrator can **adopt** a unit: read
   the unit's chain log + tracker trail, determine the last completed stage, re-
   attach the monitor to any still-in-flight session, and continue the chain from
   there. Adoption is idempotent — re-adopting a unit that is already complete, or
   whose in-flight stage has since finished, simply picks up the report and
   chains; it never re-runs a stage that already produced a verified deliverable.
   (Resuming a stale stage session for inspection is a separate, interactive act.)

Because both the chain log and the trail are append-only and the deliverables are
independently verifiable (stamp/commit/PR), recovery is deterministic: trust the
durable records, re-derive state, never replay completed work.

*This file is a process contract. If reality diverges from it, fix one or the
other — don't let them drift.*
