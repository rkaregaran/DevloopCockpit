# Pillar 7 — Spawn & workspace machinery

The orchestrator never implements. It hands each stage a clean room and a
deterministic way to prove it left something real behind. This file is the WHY
behind `scripts/devloop-spawn`, `scripts/devloop-worktree`, `scripts/devloop-test`,
and `scripts/onboard` / `scripts/doctor` (each self-contained — the small pure
helpers they share are inlined into both so either script can be dropped into a
new repo and run as-is).
Everything is env-overridable so the machinery is testable without a live harness.

## Isolated worktree per unit

One unit of work = one git worktree under `$WORKTREE_ROOT/<issue-lc>` on its own
branch. Stages for the same unit share that worktree; different units never touch
each other's files. The worktree is the only thing a stage inherits beyond the
committed artifacts and its pointer-only handoff doc — there is no in-memory
state carried across the detached boundary. `scripts/devloop-worktree` creates it
(checking out the branch if it exists, branching from `$DEVLOOP_BASE_REF` if not)
and runs the project's prepare step (`$MIGRATE_CMD` / dependency install) so the
stage opens onto a ready tree.

## Identity laundering + a freshly minted session id

The parent harness exports identity env (the `CLAUDE*` family — session id,
entrypoint, child-session markers). If a detached child inherits those, the
harness treats it as a *nested* session and behaviour diverges from a normal
top-level run. `scripts/devloop-spawn` therefore `env -u`-strips that identity
set and mints a fresh session id (`uuidgen`, lowercased) passed via
`--session-id`, so the child boots as a clean top-level session that owns its own
id. This is harness/OS-specific (the exact var names track the CLI version) — the
one line a future port revisits. The launch is `nohup … &` inside a subshell that
`cd`s into the worktree, with stdout captured as JSON and stderr to a log under
`$HANDOFF_ROOT`; a tab-separated row (timestamp, issue, stage, session id) is
appended to the durable chain log so a crashed orchestrator can re-attach.

## Worktree-local non-interactive signing

Unattended commits must sign without a credential prompt — a passphrase dialog
would hang a detached session forever. `$AUTOMATION_SIGNING_KEY` is a dedicated,
passphrase-less automation identity. `scripts/devloop-worktree` sets the signing
config **`--worktree`-locally** (`gpg.format ssh`, `user.signingkey`,
`commit.gpgsign true`) so the human's main checkout is untouched.

The gotcha: a credential manager can hijack SSH signing *globally*. 1Password's
`op-ssh-sign` sets `gpg.ssh.program` for every repo, which would route the
worktree's commits through an interactive agent. The fix is to pin
`gpg.ssh.program ssh-keygen` in the **worktree-local** config — local overrides
global, so the automation key signs with plain `ssh-keygen` while the human keeps
their 1Password flow. Re-check this per credential manager when porting.

## Atomic-write producer discipline (.partial + mv)

Any file a poller waits on must be written atomically. A detached producer that
appends incrementally (line by line, under a redirect to the final name) and a
reader that unblocks on "exists and non-empty" is a classic TOCTOU race: the
reader can observe a half-written file that satisfies non-empty but is missing
later lines. This bit us for real — a poller read a partial record and asserted
against content that had not landed yet, green locally and on branch runs, red
only under CI load when the writes hadn't finished first.

The rule: **the producer builds the file under a `<name>.partial` and `mv`s it
into place.** Rename is atomic within one filesystem, so a poller can only ever
observe a complete file — never a partial. (Corollary for keeping the durable
roots reliable: `$HANDOFF_ROOT` lives outside the repo and is **not** `$TMPDIR`,
so a temp sweep can't delete a handoff mid-poll.) To reproduce such a race
deterministically, inject a flush + `sleep` between the producer's writes (red),
then confirm the atomic-rename fix holds with the delay still in (green). Fix
flakes at the synchronization root; don't just re-run CI.

## The deterministic test stamp — the trust anchor

`scripts/devloop-test` runs the full suite and writes a deterministic JSON stamp
to `$TEST_STAMP_PATH` — exit code, counts (examples / failures / errors), the
ISO-8601 `finished_at`, and the command. This is the one piece of evidence
**prose cannot fake**: a stage exit contract (Pillar 4) requires the stamp to
exist *and* its mtime to be newer than `HEAD`, which proves the committed tree was
actually exercised, not merely described. The runner does not `set -e` past the
suite — it captures the real exit code, stamps, then re-exits with it, so a
failing suite still produces a truthful stamp rather than aborting silently.
Swap the runner command via `$TEST_CMD` / `$SYSTEM_TEST_CMD`; the stamp schema is
fixed so the evaluator stays stack-agnostic.

## Validate the identifier BEFORE it becomes a path

The issue id flows straight into worktree paths, branch names, handoff filenames,
and the chain log. Untrusted-input-into-path discipline means it is validated
**first**: `scripts/devloop-spawn` and `scripts/devloop-worktree` both reject any
id that does not match `$ISSUE_ID_PATTERN` (exit 64) before interpolating it
anywhere. The stage selector is likewise an allowlist (plan | execute | review).
Validate, then build the path — never the reverse.

## The env-injectable onboard / doctor pair

`scripts/onboard` and `scripts/doctor` split mutate-vs-inspect. `onboard` is
idempotent: it creates the automation key, the durable roots, and any missing
config, then `exec`s `doctor`. `doctor` is read-only: it checks each precondition
(key present, key registered with the host, durable roots writable, container
context) and prints a per-line pass/fail with a copy-pasteable remedy on failure —
it deliberately continues past failures to report them all, so the inlined pure
helpers it shares with `onboard` set **no** shell options. Both honour env overrides
(`$AUTOMATION_SIGNING_KEY`, `$DOCKERENV`, `NO_COLOR`, and `$DEVLOOP_SKIP_SETUP` —
the skip-setup escape hatch) so the pure helpers can be unit-tested in isolation
and the whole flow runs hermetically in CI.
