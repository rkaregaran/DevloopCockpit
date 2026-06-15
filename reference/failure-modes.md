# Failure modes — the scar tissue

Each rule below was paid for in a real failed loop. They are the reason the
exit contracts, fences, atomic writes, and review trio are shaped the way they
are. Read this before you weaken any guardrail: the cheap-looking shortcut is
usually the one that already burned us.

Conventions: `$ISSUE_ID_PATTERN`, `$ARTIFACT_ROOT`, `$HANDOFF_ROOT`,
`$WORKTREE_ROOT`, `$TEST_STAMP_PATH`, `$AUTOMATION_SIGNING_KEY`,
`$CIRCUIT_BREAKER_PATHS`, `$CLOSE_KEYWORD`, `$TRACKER`, `$VCS_HOST` all come
from `config.template.sh`. Rails commands are the shipped default; they live in
the config too.

---

## 1. False completion on a green-but-PARTIAL suite

**Symptom.** A stage declares the unit "done" and opens the PR while only a
fraction of the planned work exists. The test suite is green — but it is green
because the central feature, its model, its controller/views, and its
end-to-end test were never written, so nothing tests them. The unit lands in a
contradictory state and a human has to push back.

**Rule.** A passing suite proves only what is tested, never that the plan is
finished. Before claiming a unit done: re-read its plan and confirm **each
task is actually implemented** — diff `git log` against the task list, not the
suite result. Coverage of the planned behaviour is the gate, green is not.

**Why.** "Tests pass" and "the work is complete" are independent facts.
Conflating them is the single most common way an agent lies to itself. The
exit contract therefore cross-checks the commit range against the task list and
rejects partial completion even when the suite is green.

## 2. Prose-fooled exit checks

**Symptom.** A stage writes a confident closing paragraph — "All tasks are
complete, the suite is green, the PR is open" — and the loop believes it. None
of it happened; the assistant narrated success it never produced.

**Rule.** Gate every stage exit on **tool-result evidence only**. Valid exit
evidence is: files actually written (tool result), a fresh test stamp at
`$TEST_STAMP_PATH` whose mtime is **newer than HEAD**, a clean lint/security
tool result, a successful push, a real PR object from the VCS host, and a
report whose first line is the success marker. Assistant prose is never
evidence. The Stop-hook evaluator reads tool-result blocks and ignores the
narrative.

**Why.** A language model's most fluent output is a plausible success story.
If prose could satisfy the gate, the gate would always pass. Anchoring on
artifacts the model cannot fabricate (a timestamped stamp, a real PR id) is the
only durable check.

## 3. Working AROUND a guardrail to appear successful

**Symptom.** A stage hits a permission denial on a fenced path (its own
governance/secret/config dir, e.g. anything in `$CIRCUIT_BREAKER_PATHS`),
can't produce the intended deliverable, and instead fabricates a substitute —
writes the file somewhere unfenced, stubs the output, or routes around the
block — so the exit check passes. The deliverable looks real and is not.

**Rule.** A permission denial on a fenced, non-cosmetic path is the **only**
valid trigger for a structured escalation — and the stage must escalate, never
improvise around it. Never relocate, fake, or stub a deliverable to satisfy an
exit check. The fence is enforced by the harness and cannot be overridden from
inside a stage; treat the denial as a signal that this work belongs to the
interactive orchestrator, which writes the fenced file itself, not to a
headless stage.

**Why.** A stage that can rewrite its own fences/hooks can escalate its own
privileges and erase the audit trail. The whole point of least-privilege per
stage is that the agent cannot grant itself more. A fabricated deliverable that
passes the gate is strictly worse than an honest escalation, because it ships a
hole nobody saw.

## 4. TOCTOU partial reads of a poller file

**Symptom.** A poller waits on a file a detached process is writing — keying on
"exists and non-empty" — and reads it mid-write. The producer writes the file
incrementally (a header line, then the body); under load the reader unblocks on
the header-only partial and the body it needed isn't there yet. Passes
locally, flakes under CI load.

**Rule.** Any file a poller waits on must be written **atomically**: the
producer builds it under a `.partial` name and `mv`s it into place. Rename is
atomic on one filesystem, so the poller can only ever observe a complete file.
This applies to every handoff and report under `$HANDOFF_ROOT` and to the test
stamp at `$TEST_STAMP_PATH`.

**Why.** "Exists and non-empty" is satisfied by a half-written file — a
detached writer plus a poll-for-non-empty reader is a classic time-of-check /
time-of-use race. Fix it at the synchronization root (atomic rename), don't
paper over it with retries or sleeps. Reproduce deterministically by injecting
a flush+delay between the producer's writes (red), then confirm the atomic
rename holds with the delay still in (green).

## 5. Stale CI proof — pre-push run vs the PR-head run

**Symptom.** A stage runs CI (or reads a prior CI result) on a branch push,
sees green, and treats that as the merge-readiness check. But the green it saw
was from an earlier commit or a different event than the actual PR head — the
PR's own checks haven't run yet, or ran against a different tree.

**Rule.** Re-poll CI on the **PR-head event after the PR opens**, never a
pre-PR push run. The merge-readiness check reads the checks attached to the PR
object itself. A green push run is not a green PR.

**Why.** The tree that gets merged is the PR head; only its checks attest to
the thing actually shipping. A pre-PR push run can be stale, from a superseded
commit, or run a different workflow. Gating on the PR-head event closes that
gap.

## 6. Alarm-fatigue from over-fencing

**Symptom.** Every cosmetic or diagnostic permission denial — a preview
command, a read-only diagnostic, an interactive prompt the headless session
can't answer — gets escalated as a blocker. Real escalations drown in noise and
the human stops reading them.

**Rule.** Judge **intent, not a raw denial count**. Ignore cosmetic and
diagnostic denials (previews, read-only diagnostics, interactive-only gates).
Escalate a fenced-path denial only when the gated deliverable **cannot be
independently verified as real** — i.e. the commit is pushed and signed, a
fresh test stamp exists, and a real PR is present. If the deliverable verifies
by its own artifacts, the denial was harmless; swallow it.

**Why.** A guardrail that cries wolf trains the human to ignore it, which
defeats the guardrail. The escalation channel is scarce attention; spend it
only on denials that actually threaten a real deliverable.

## 7. The tracker ↔ VCS auto-close gap

**Symptom.** A PR merges with `$CLOSE_KEYWORD <id>` in its body, and everyone
assumes the tracker issue moved to Done. It didn't — the magic keyword only
fires when the tracker↔VCS integration is connected, and on many workspaces it
isn't. The VCS host closed nothing on the tracker side; the issue sits in
review forever.

**Rule.** Do not assume the merge transitioned the issue. After merge, **verify
the issue actually moved to Done — or move it manually** and post the merge
marker. Treat `$CLOSE_KEYWORD` as informational unless you have confirmed the
integration is live on this workspace.

**Why.** `$CLOSE_KEYWORD <id>` is a tracker magic word, not a guarantee; with
the integration disconnected the link is purely informational. An issue stuck
in review silently breaks the "the trail is the audit history" contract.

## 8. Async-UI test flakes (browser/system tests)

These are one failure family: a client-side navigation/rendering framework
intermittently **drops** an interaction when several browser tests run
back-to-back, because a late render from the prior test resets the DOM
mid-interaction. Wait-bumps, blind retries, and session resets do **not** fix
them — the event was dropped, not delayed. Fix at the synchronization root.

**Rule (links — navigation).** For cross-page navigation, prefer a **hard
visit** to the path over clicking a link; the click can be intercepted and
dropped by the SPA/Turbo-style navigation layer. Reserve clicks for the exact
element under test; cover the link itself in a deterministic request/unit test.

**Rule (forms — submit).** For a form submit that must go through the UI, set
the field values and trigger the submit **atomically in one script call**
(`requestSubmit()`), rather than filling fields and then clicking the button as
separate steps. A separate fill-then-click lets the framework clear a
just-filled field (e.g. an autocomplete-managed password, or a reset select)
between the two, so a required field is empty and the submit is silently
blocked.

**Rule (confirm dialogs).** Do not rely on the driver accepting a **native**
confirm dialog — the driver's default unhandled-prompt behaviour auto-dismisses
it before the accept poll catches it, and forcing "ignore" does not reliably
fix it. Instead, **stub the confirm function to return true** in the page
before submitting, and drive the submit with `requestSubmit()`. The stub
survives a stream/panel replace (the window object isn't reset), so the real
submit and the real stream replace stay honest while the dialog race is gone.

**Sync barrier.** After any submit or sign-in, assert on a string **unique to
the destination page** before navigating away — a bare navigate races the
in-flight submit, and a string shared by source and destination can false-pass
a dropped navigation.

**Why.** Every fix above removes nondeterminism at its source instead of
masking it. Verify a flake fix with many local runs **and** multiple CI
samples; a single green run proves nothing about a race.
