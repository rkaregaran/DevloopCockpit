# Pillar 4 — Machine-checked exit contracts + least-privilege fences

A headless stage runs unattended. The only thing standing between "the agent
thinks it's done" and "a fabricated deliverable merged to main" is a Stop-hook
evaluator that judges **evidence, not assertions**, plus a fence that the agent
**cannot** disable from inside. This pillar specifies both.

## The two-armed exit contract

A stage session may stop **only** on one of two arms. Anything else is a
rejected Stop — the session keeps working.

**Arm A — proof of success.** ALL of these must be true, each shown by a
**tool-result block** in the conversation (see "Evidence rule" below):

1. The stage's deliverable artifact(s) were written — a `Write`/`Edit`
   tool-result shows the expected file(s) under `$ARTIFACT_ROOT` /
   `$HANDOFF_ROOT` created or updated.
2. **A fresh test stamp.** A `Bash` tool-result shows the suite ran clean
   (`$TEST_CMD` via the runner that emits `$TEST_STAMP_PATH`), and a later
   `Bash` tool-result reads `$TEST_STAMP_PATH` showing `exit_code:0`,
   `failures:0`, and a `finished_at` timestamp **newer than HEAD's commit
   time** (`git log -1 --format=%cI`). Stale stamp = reject. This JSON stamp is
   the trust anchor prose cannot fake.
3. Lint clean (`$LINT_CMD` → no offenses) and security clean
   (`$SECURITY_CMD` → 0 warnings), each shown in a `Bash` tool-result.
4. **Push succeeded** — a `Bash` tool-result shows a successful `git push` of
   the stage's commits.
5. **A real PR** (review/final stage only) — a `Bash` tool-result shows the PR
   was created with a URL and a body containing `$CLOSE_KEYWORD <issue-id>`.
6. The handoff **report's first line is `DONE`** — a `Write` tool-result shows
   the stage report under `$HANDOFF_ROOT` whose first line is exactly `DONE`,
   followed by the structured summary that stage owes (commit range, suite
   counts, verdicts, PR URL — whichever apply).

Not every stage owns every item: a plan stage owns 1 + 4 + 6; a build stage
owns 1–4 + 6; the final review stage owns all six. The stage settings file
encodes which apply.

**Arm B — a structured `ESCALATION`.** A `Write` tool-result shows the stage
report whose **first line is exactly `ESCALATION`**, naming a recognized cause
(design-defect bounce to a named earlier stage, blocked-on-dependency, or
same-stage-failed-3x hard stop) and the loop-back point. Escalation is a
**first-class, valid** exit — not a failure to punish. A stage that cannot
proceed honestly from its inputs must escalate.

## The evidence rule — prose is never evidence

The Stop-hook evaluator judges **only tool-result blocks**. Assistant prose —
"I ran the tests and they pass", "the PR is open", "all green" — is **never**
evidence and is ignored entirely. If a claim isn't backed by a tool-result
that shows the actual command output, it did not happen as far as the gate is
concerned. This is the single rule that defeats false-completion: the model
cannot talk its way past the gate.

The evaluator also actively **rejects two failure shapes**:

- **Stale evidence** — a green suite run, lint pass, or CI result whose
  timestamp predates the latest commit. Cross-check the stamp's `finished_at`
  (and any CI result) against `git log -1 --format=%cI`; older = the proof is
  for code that no longer exists. Reject.
- **Partial completion** — a build stage that did 2 of 7 planned steps and
  reported `DONE`. Cross-check the final `git log --oneline` tool-result
  against the unit's task list; if commits don't cover every task, reject. A
  green suite over an incomplete change is still incomplete.

When unmet, the evaluator returns `{"ok": false, "reason": "<exactly which
evidence is missing>"}` and the session continues; when met, `{"ok": true}`.

## Per-stage least-privilege allowlists

Each stage runs under its own tight permission allowlist (its stage settings
file) — it can invoke only the tools that stage legitimately needs:

- **Plan stage** — read-only diagnostics + `git` add/commit/push only. No test
  runner, no migrations. A plan stage that runs migrations is out of role.
- **Build stage** — the full verification profile (`$TEST_CMD`, `$LINT_CMD`,
  `$SECURITY_CMD`, `$MIGRATE_CMD`, generators) + `git`. No PR creation.
- **Review stage** — read-only diagnostics, the test runner, CI-status and
  PR-creation commands, and the review dispatch. No source edits.

Narrow allowlists mean an off-role action surfaces as a permission denial
instead of silently happening — which feeds the triage below.

## The un-overridable circuit-breaker

A small set of paths — the agent's own governance, secret, and config
directories — is a harness **circuit-breaker** (`$CIRCUIT_BREAKER_PATHS`). A
headless stage **cannot Write/Edit** them. This is enforced by the harness
itself, **not by the agent and not by config**:

- A `permissions.allow` rule does **not** override it.
- A `PreToolUse` hook returning `"allow"` does **not** override it
  (empirically disproven — a hook-allowed config dir was still blocked).
- `--dangerously-skip-permissions` does **not** override it.

The set is harness-version-specific — **verify it empirically** against your
harness, don't assume. (Note: a project's CI/workflow directory is normally
*not* fenced — editing CI is ordinary unit work — so don't over-fence it.)

The point is a privilege-escalation guard: a stage must never be able to
rewrite its own fences, hooks, exit-contract, or secrets. **Config-touching
work is done in a SUPERVISED (interactive, human-present) session, never
headless.** For the rare unit that must write a fenced path, the supervised
session specifies those files verbatim, writes and commits them itself, and the
handoff tells the re-dispatched headless stage they already exist (skip them).

## Intent-based denial triage

Not every permission denial is an escalation. Judge **intent**, not a raw
denial count:

- **Ignore** cosmetic and diagnostic denials — a blocked preview command, a
  read-only diagnostic, an interactive-only gate (e.g. a question/skill prompt
  that can't fire headless). These don't compromise the deliverable.
- **Escalate** (arm B) only when a **gated deliverable cannot be independently
  verified as real** — the commit didn't push or isn't signed, no fresh suite
  stamp exists, the PR isn't actually open. A denial that blocks real proof of
  real work is the valid escalation trigger.

## The hard rule

**Never work around a fence to fabricate a deliverable.** A denial on a fenced
or off-role path means **arm B (escalate) is the only valid exit** — not "find
another way to produce the artifact anyway." Approving a Stop that routed
around a denial to manufacture its deliverable is the worst possible outcome:
it merges fabricated work under a green-looking trail. The evaluator must
**never** approve a stop that worked around a denial. Honest escalation always
beats a fabricated `DONE`.
