# Pillar 5 — The multi-lens adversarial review trio

The review stage runs **N independent single-purpose finders in parallel**, each
one a fresh agent with exactly one lens and no other job. No single agent is
trusted to "review everything" — breadth comes from running several narrow,
adversarial passes, not one shallow one. Every finding that could block a PR is
then handed to a **second** agent whose only job is to *disprove* it. The PR
opens only after this gauntlet, and only on a **severity-triage** verdict — not
on a zero-findings verdict.

The shipped trio is implemented in `scripts/review-trio.js`. This file is the
spec it implements; read both.

## The three lenses

| Lens | Runs when | What it does | Pass condition |
|---|---|---|---|
| **Security** | **always** | Reviews the branch diff and touched code for injection, broken authorization / tenant isolation (cross-tenant leakage is critical), secret leakage, immutability bypasses, unsafe deserialization; confirms any security-suppression entries still hold. | nothing high/critical |
| **QA-vs-acceptance** | **always** | Reads the unit's acceptance spec (`$ACCEPTANCE_FORMAT`) and proves a passing test exists for **every** scenario; reads the **implementation**, not just test names; runs the suite via the stamped runner and reports exact counts. | every scenario covered **and** suite green |
| **Usability/a11y** | **only if UI changed** | Reviews only the changed UI surface for accessibility blockers (contrast in every theme, keyboard nav, focus visibility, tap-target size, semantics). | no a11y blockers — *or an explicit N/A-pass* |

Each finder **defaults to BLOCK.** It returns `pass=true` only if it found
nothing at high or critical severity. Silence is never a pass — see fail-closed
below.

### QA reads the implementation, not the test names

The single most important rule of the QA lens: a green suite is **not** proof the
acceptance criteria are met. A test named `test_widget_is_archived` proves
nothing if its body asserts the wrong thing. The QA finder must:

1. For **each** acceptance scenario, name the test file:line that covers it.
2. Read those test bodies and confirm they actually assert the scenario's outcome.
3. Read the **production** code paths and confirm the implementation satisfies the
   scenario — not merely that a test is green.
4. Run the suite via the stamped runner and report the exact pass/fail counts.

A scenario with no test, or a test that asserts past the behaviour, is a blocking
QA finding even if every test is green.

### The usability lens is synthesised explicitly — never skipped silently

When no UI changed, the usability lens does not vanish — it is **synthesised as
an explicit N/A-pass** carrying a stated reason (e.g. "no UI surface in the
branch diff"). A missing usability verdict is a **failure** (fail-closed), not an
implicit pass. The distinction matters: "N/A because no UI changed, here is the
diff that proves it" is a verdict; a blank where the verdict should be is a hole.

## The refuter layer — adversarial verification of every blocker

A finder flags; it does not get the last word. For **every** finding at **high or
critical** severity, a second agent — the **refuter** — is spawned with one
instruction: *try to disprove this finding by reading the real code.*

- The refuter reads the **actual** code the finding cites — not the finder's prose.
- A finding is **refuted only if** it is *wrong*, *already mitigated*, or
  *unreachable* — and the refuter must cite the concrete evidence.
- If the finding genuinely holds, `refuted=false`.
- **Only un-refuted high/critical findings block the PR.** Refuted ones are
  recorded with the refutation reason and do not block.
- Low/medium findings are not refuted — they are recorded for the summary but
  never block on their own.

This two-layer shape (find → refute) is what makes the gate trustworthy: it
suppresses false positives without letting a finder's single opinion sink a PR,
and it forces every real blocker to survive a hostile second read of the code.

```
finder (lens) ──► high/critical findings ──► refuter (per finding)
                                              │
                          refuted? ───────────┴──► drop (record reason)
                          holds?   ──────────────► CONFIRMED BLOCKING
```

## Fail-FAST on inputs, fail-CLOSED on verdicts

Two distinct integrity rules, both load-bearing:

- **Fail-FAST on missing inputs.** Before any finder runs, validate every
  required input is present (unit id, branch, the acceptance spec, the
  UI-changed boolean — note `false` is valid, only *absent* is fatal). A missing
  or `undefined` input **throws immediately**. The classic failure this prevents:
  an acceptance spec arrives as `undefined`, the QA finder dutifully "reviews
  undefined", finds nothing, and reports a hollow green — a review that looked
  done while no agent ever read the real criteria.
- **Fail-CLOSED on missing verdicts.** If a finder crashes, times out, or returns
  nothing, treat it as **BLOCK**, not pass. If a refuter is unavailable, treat the
  finding as **confirmed** (`refuted=false`, reason "verifier unavailable —
  treated as confirmed"). Absence of a verdict is never absence of a problem.

## The gate is severity-triage, not zero-findings

The PR-blocking decision is: **are there any *un-refuted* high/critical
findings?** — not "are there zero findings?". Low/medium findings are surfaced in
the consolidated summary and may be filed as follow-ups, but they do not block.
Demanding zero findings trains finders to under-report; triaging by severity
keeps them honest while keeping the bar at "nothing dangerous ships."

## Rework routing (by failure type)

A blocking verdict means the PR does not open. Route the rework by *what* failed:

- **Code bug** → fix the code, then **re-run that pass and every pass after it**
  in order; post the re-run as a *new* verdict (the failed one stays in the trail).
- **Design defect** (wrong approach / missing entity / mis-modeled rule, not a
  code bug) → loop all the way back to the design stage → re-plan → re-build. The
  reviewer's comment must name the loop-back point.
- **Same pass fails 3×** → hard stop, escalate to a human; the unit is probably
  mis-scoped and silent churn is worse than a flag.

## Determinism — ordering preserved on re-runs

The trio is **order-stable**: lenses are evaluated and reported in the same fixed
order (security, QA, usability) on every run, and findings within a lens preserve
their emitted order. Re-runs after a fix produce a diffable verdict, not a
reshuffled one — so a reviewer can see exactly what changed between attempts. The
final result names the unit and branch, the per-lens passes, and the flat list of
confirmed-blocking findings after adversarial verification.

---

## Appendix — deepening a finding into a real fix

When a confirmed finding points at *shallow architecture* (an interface nearly as
complex as its implementation; a pass-through that just moves complexity around)
rather than a localized bug, two sub-methods sharpen the fix beyond a patch:

- **Deletion test.** Imagine deleting the module the finding sits in. If
  complexity *vanishes*, it was a pass-through — delete it instead of patching it.
  If complexity *reappears* across multiple callers, the module earns its keep —
  fix it in place. This tells you whether to repair or remove.
- **Design-it-twice.** Your first fix is rarely the best. For a non-trivial
  redesign, spawn 3+ parallel agents, each producing a **radically different**
  interface under a different constraint (minimize the interface for max leverage;
  maximize flexibility; optimize the common caller). Compare them by **depth**
  (leverage behind a small interface), **locality** (where change concentrates),
  and seam placement — then pick or hybridize. One adapter is a hypothetical seam;
  two adapters (typically production + test) make it real.

Use these only when a finding is architectural; for a localized bug, the
straight fix-and-re-run routing above is correct.
