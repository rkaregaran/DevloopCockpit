# Pillar 1 — The staged unit-of-work loop

The mandatory, repeatable cycle every unit of work runs through. One unit = one
branch = one loop = one PR = one merge. Every stage is run **in full regardless
of unit size** — there are no size-based shortcuts. The ceremony *is* the point:
nothing reaches a PR un-designed, un-tested, or un-reviewed, and the tracker
issue holds the complete, timestamped audit trail.

## The pipeline

```
pull → design-grill → stress-test → plan → TDD build → self-verify
     → security ‖ QA ‖ usability  → summary → PR (LAST) → merge
```

Run it sequentially **within** one coupled unit; the review trio's three passes
run in **parallel** with each other. The PR opens **last** — only after every
applicable pass is green.

| # | Stage | Who | Method | Gate to advance | Tracker marker (example) |
|---|---|---|---|---|---|
| 0 | **Pull** | orchestrator | — | unit unblocked; status → In Progress; worktree + branch created | `started` |
| 1 | **Design** | orchestrator (interactive) | design-grill | design artifact exists in `$ARTIFACT_ROOT`; glossary/ADRs updated if needed | `design — <permalink> · <summary>` |
| 2 | **Stress-test design** | orchestrator (interactive) | adversarial grill | design survived grilling | `grilled — <key changes / "no change">` |
| 3 | **Plan** | plan stage (spawned) | writing-plans | plan committed + pushed; exit contract met | `plan — <permalink>` |
| 4 | **Build** | execute stage (spawned) | subagent-driven TDD | every step built on the one branch; red-green-refactor | `implementation — <commit range>` |
| 5 | **Self-verify** | execute stage | verification-before-completion | suite green via the stamped test runner | `verified — suite green (<n> tests)` |
| 6 | **Security pass** | review stage (spawned) | review trio | triage gate (see Pillar 5) | `security — pass \| <findings or "none">` |
| 7 | **QA pass** | review stage | review trio (fed the unit's acceptance spec, `$ACCEPTANCE_FORMAT`) | every acceptance scenario covered + passing | `qa — pass \| acceptance N/N` |
| 8 | **Usability/a11y pass** | review stage | review trio (UI-conditional) | no a11y blockers | `usability — pass` *or* `usability — N/A (no UI)` |
| 9 | **Summary** | review stage | — | all applicable passes green **+ CI green re-polled on the PR-head event** | `review summary — all passes green; ready for PR` |
| 10 | **PR** | review stage | open PR via `$VCS_HOST` | summary done; PR opened **last** | `pr — <url>` |
| 11 | **Merge** | human | — | review + CI green on the PR | status → Done (verify it moved; auto-close may not fire) |

> The marker taxonomy above is an **editable example set**. Keep the *shape* —
> one distinct, greppable structured marker posted per stage on completion — but
> rename/re-emoji to taste. The marker trail *is* the audit history **and** the
> enforcement mechanism: a unit cannot reach Done without the full trail present.

**Artifacts** (stages 1 and 3) are committed files under `$ARTIFACT_ROOT`,
version-controlled and merged with the code. The tracker comment carries the
permalink + a short summary — the repo holds the source of truth. Never mirror
full artifact text into the tracker; it just drifts.

## Build grain — the middle tier, never the leaf

Work decomposes into three tiers (see Pillar 6). **The unit of work is the
middle tier**: a *demoable workflow* — a parent grouping its ordered steps,
buildable and demonstrable on its own (e.g. a complete feature flow, not one
endpoint). The leaf **task step** is a build checklist item — it gets **no own
branch, no own loop, no own PR**. Steps are checked off as they land on the
single workflow branch. The slice (the top tier) ships when all its workflows'
PRs are merged.

One workflow → one branch → one loop → one PR → one merge. Sub-steps are built
**in order on that one branch** (per step, model → service → controller → view →
tests is a coupled change; parallelizing inside one coupled change just causes
merge-thrash).

## Parallelism vs. sequencing

- **Between independent units:** parallel. An orchestrator reads the unit-grain
  blocked-by graph in the tracker and fans out every *currently-unblocked* unit
  to its own agent, branch, and loop, concurrently. Parallelism lives **here**.
- **Within a coupled unit:** sequential. The per-unit loop runs its stages in
  order; use parallel subagents inside a loop only for genuinely independent
  steps. (Hard constraint: at most one execute stage at a time if they share a
  test database — give each worktree its own DB name before overlapping.)

```
slice (milestone)
 ├─ unblocked unit ──► [LOOP] ──► PR ──► merge ┐
 ├─ unblocked unit ──► [LOOP] ──► PR ──► merge ┤  parallel; gated by the
 └─ blocked unit ····· waits ····► [LOOP] …    ┘  unit-grain blocked-by graph
```

## CI-green is re-polled on the PR-head event

The "CI green" gate at stage 9 checks the status of the **`pull_request` head
event** — the run CI triggers *after the PR opens* (`gh pr checks` once the PR
exists). It is **not** satisfied by a pre-PR push run on the branch. A push run
can pass while the PR-head run fails (different event context, merge-commit
checks, required-check config). Always re-poll the PR-head event before merge.

## Rework routing — re-entry depends on *what* failed

A failed pass means the PR does not open. The failed marker stays in the trail —
**never deleted**. The re-entry point:

- **Code bug (default):** fix the code → **re-run that pass and every pass after
  it**, preserving security → QA → usability order → post the re-run as a *new*
  marker.
- **Design defect:** if a reviewer judges the failure is a *design* miss (wrong
  approach, missing entity, mis-modeled rule) — not a code bug — the unit loops
  **all the way back to stage 1 (design)** → re-plan → re-build. The reviewer's
  comment must name the loop-back point.
- **Same pass fails 3×:** **hard stop, escalate to a human.** The unit is
  probably mis-scoped, and silent churn is worse than a flag. (For spawned
  stages: 3 respawns of the same stage = hard stop.)

A stage exiting via a structured escalation, or timing out, halts the chain at
that boundary — post the escalation, notify, and wait. A design-defect bounce
respawns from the named loop-back stage with an amended handoff. The human may
veto the chain at any boundary; vetoed/failed markers stay.

## Done contract — a marker-gated audit checklist

A unit is **Done** only when **all** of these are true and visible in the
tracker trail (this is the enforceable definition — adapt the marker labels to
your set, keep the gate):

- [ ] Design artifact committed + linked
- [ ] Design grilled
- [ ] Plan committed + linked
- [ ] Built TDD-first
- [ ] Full suite green (stamped evidence)
- [ ] Security pass green / triaged
- [ ] QA pass — every acceptance scenario covered + passing
- [ ] Usability pass green or N/A
- [ ] Consolidated summary posted
- [ ] All steps Done
- [ ] PR opened with `$CLOSE_KEYWORD <issue-id>` (matching `$ISSUE_ID_PATTERN`),
      then merged

**Enforcement:** a unit may not move to Done without the PR marker **and** all
three review-pass markers (security, QA, usability-or-N/A) present in the trail
**and** all its steps Done. Verify the status actually moved after merge —
tracker↔VCS auto-close is not guaranteed to fire.

## The loop in one breath

> Pull an unblocked unit → make a worktree → grill the design → grill it again
> to harden it → become the orchestrator: spawn the plan stage (writing-plans),
> a veto window opens on its report → chain to the execute stage (subagent-driven
> TDD, exit only on stamped evidence) → then the review stage (security ‖ QA ‖
> usability, adversarially verified), CI green re-polled on the PR head, then the
> PR — opened **last** with `$CLOSE_KEYWORD`. The orchestrator posts every trail
> marker and notifies you exactly three times: plan-ready, escalation, PR-open.
> Merge is yours.

*This file is a process contract. If reality diverges from it, fix one or the
other — don't let them drift.*
