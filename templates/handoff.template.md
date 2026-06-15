<!--
HANDOFF TEMPLATE — the pointer-only doc that boots the next stage session.

A handoff launches a FRESH headless stage that inherits NOTHING from any prior
conversation. It boots from exactly two things: (1) the committed artifacts under
$ARTIFACT_ROOT already pushed to the branch, plus the worktree under
$WORKTREE_ROOT, and (2) THIS doc under $HANDOFF_ROOT.

╔══════════════════════════════════════════════════════════════════════════╗
║  POINTERS, NOT CONTENT.                                                     ║
║  This doc carries LINKS — repo-relative paths and permalinks — never the    ║
║  TEXT of an artifact. If you are pasting a design, a plan, code, or a diff  ║
║  in here, STOP: you are duplicating an artifact that will drift out of sync ║
║  while this handoff sits on disk. Point at it instead; let the stage read   ║
║  the live file. The ONE allowed inlining is the acceptance spec for the     ║
║  review stage (a spawned session may lack tracker access) — see §2.         ║
╚══════════════════════════════════════════════════════════════════════════╝

How to use:
- Copy this file; replace every {placeholder}. Delete every guidance comment.
- Keep it short. Over ~80 non-blank lines means you are inlining content —
  cut it back to pointers.
- Save to: $HANDOFF_ROOT/{issue-id}-{stage}.md  (stage = plan | execute | review)
- {issue-id} MUST match $ISSUE_ID_PATTERN and is validated before it is ever
  interpolated into a path or branch name.
- Redact secrets/PII. Use absolute dates (YYYY-MM-DD), never relative ones.
- Durable knowledge belongs in artifacts, the tracker, or memory — NEVER only
  in a handoff. A handoff is disposable; what it points at is not.
-->

# Handoff — {issue-id} · {stage} stage

## 1. Stage contract

You are the **{stage}** session for **{issue-id}**. Do only this stage's work,
then stop on a valid exit contract (§3). **Do not begin the next stage** — the
orchestrator chains it once your report comes back. You inherit nothing from any
prior conversation; everything you need is pointed at below.

<!-- One sentence on what THIS stage produces. Examples, pick the matching one:
  plan    — turn the design into an ordered, test-first implementation plan.
  execute — build the plan test-first; commit + push each step; suite green.
  review  — run the adversarial review trio, then open the PR (PR is LAST). -->
This stage: {one-line statement of this stage's single deliverable}

## 2. Pointers (links only — never the content itself)

<!-- Repo-relative paths and permalinks. Do NOT duplicate what a file already
says. Omit rows that don't apply to this stage. -->

- **Design doc:** `$ARTIFACT_ROOT/{issue-id}-design.md` — read it; do not restate it here.
- **Plan doc** (execute + review): `$ARTIFACT_ROOT/{issue-id}-plan.md`
- **Branch:** `{branch-name}`  (the tracker is the source of truth for this name)
- **Worktree:** `$WORKTREE_ROOT/{issue-slug}` — stay inside it; never touch the main checkout.
- **Tracker issue:** {permalink to the issue on $TRACKER}
- **Prior stage report** (execute + review): `$HANDOFF_ROOT/{issue-id}-{prev-stage}-report.md`

<!-- REVIEW STAGE ONLY — the single allowed inlining.
A spawned review session may lack $TRACKER access, so the acceptance spec is
pasted here VERBATIM (this is the lone exception to pointers-not-content). Also
compute and state uiChanged, which decides whether the usability/a11y lens runs:

  uiChanged: {true|false}
  # derived from: git diff --name-only <base>...HEAD intersected with the
  # project's UI paths (views / client assets / templates). true if any match.

  Acceptance spec ($ACCEPTANCE_FORMAT), verbatim:
  ```
  {paste the issue's acceptance scenarios + test plan here, unedited}
  ```
-->

## 3. Exit contract

Stop on exactly ONE of two arms; anything else is a rejected stop — keep working.
The Stop-hook evaluator judges **tool-result evidence only** — assistant prose is
never evidence. Restate this stage's arms from its stage-settings file; do not
invent criteria.

- **Arm A — proof of success.** ALL items this stage owns, each shown by a
  tool-result block:
  <!-- List only what THIS stage owns. Full set, by stage:
    1. deliverable artifact(s) written under $ARTIFACT_ROOT / $HANDOFF_ROOT
    2. fresh suite stamp — $TEST_CMD ran clean AND $TEST_STAMP_PATH shows
       exit_code:0, failures:0, finished_at NEWER than HEAD's commit time
       (git log -1 --format=%cI). Stale stamp = reject.
    3. lint clean ($LINT_CMD) and security clean ($SECURITY_CMD)
    4. push succeeded — a git push tool-result
    5. a real PR (review/final only) — URL + body contains "$CLOSE_KEYWORD {issue-id}"
    6. report first line is exactly DONE, then the structured summary this stage owes
    Typical ownership: plan → 1,4,6 · execute → 1,2,3,4,6 · review → 1–6 -->
  - {item this stage owns}
- **Arm B — structured ESCALATION.** Report whose **first line is exactly
  `ESCALATION`**, naming a recognized cause (design-defect bounce to a named
  earlier stage / blocked-on-dependency / same-stage-failed-3x hard stop) and the
  loop-back point. Escalation is a first-class, valid exit — not a failure.

- **Report path:** `$HANDOFF_ROOT/{issue-id}-{stage}-report.md`
  Its **first line MUST be `DONE` or `ESCALATION`**. The orchestrator reads only
  this report — never your transcript — so put the summary + permalinks here.

## 4. Rules

- **A permission denial on a fenced or off-role path = STOP + arm-B escalation.**
  Never work around a fence to fabricate a deliverable. ($CIRCUIT_BREAKER_PATHS is
  enforced by the harness; you cannot disable it.) A denial that blocks real proof
  of real work is the valid escalation trigger; cosmetic/diagnostic denials are not.
- **Commits:** `{issue-id}: <what>` plus this repo's Co-Authored-By trailer.
  Push ONLY via `git push origin HEAD` (or `-u origin HEAD` for the first push) —
  the sole allowlisted forms; a bare `git push` is denied.
- **Signing is preconfigured worktree-locally** ($AUTOMATION_SIGNING_KEY). Do not
  re-enable any interactive/credential-manager signing inside the worktree.
- **Stay inside the worktree** ($WORKTREE_ROOT); never touch the main checkout.
- Verification profile for this stage's checks: `$TEST_CMD`, `$LINT_CMD`,
  `$SECURITY_CMD`, `$MIGRATE_CMD` (run the runner that emits `$TEST_STAMP_PATH`).
- **Suggested methodology** (bundled in this skill's reference/, no external skill
  required): plan → writing-plans · execute → test-driven, subagent-driven build ·
  review → the review-trio with full args (it fail-fasts on missing args by design).

## 5. Gotchas

<!-- Session-learned, repo- and stage-specific warnings only. Keep each to a line.
Examples of the SHAPE (replace with real ones, or delete the section):
  - Shared test database — never run a second build stage concurrently.
  - Flaky UI-test pattern X and its known fix.
  - A fenced path this unit needs already exists (written by the supervised
    session) — skip it; do not try to write it.
Do NOT put durable knowledge here — that goes in artifacts, the tracker, or memory. -->

- {gotcha, one line each — or delete this section if none}
