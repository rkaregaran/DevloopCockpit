# Pillar 8 — The governance constitution

Everything else in this bundle is mechanism; this pillar is the law that keeps
the mechanism honest. A green-field repo adopts a small set of constitutional
rules **on day one**, version-controls them in an always-loaded agent
instruction file, and keeps that file in lockstep with the scripts. The drop-in
starter is `templates/CLAUDE.md.snippet` — paste or merge it into the new repo's
top-level agent instruction file (`CLAUDE.md` / `AGENTS.md`). The rest of this
file is the rationale behind each clause.

The constitution has five parts: task-class routing, the day-one architectural
bet, decision-record hygiene, the known-ambiguities discipline, and the
cross-session memory + cleanup habits. Treat the file as a **living contract** —
when behaviour drifts from it, fix one or the other; never let them diverge.

## 1. Task-class → mandatory-skill routing

The constitution hard-routes every class of task to a mandatory workflow
**before any other action**. This is a rule, not a suggestion — the agent
invokes the matching workflow first, then works.

| Task class | Mandatory workflow (invoke first) |
|---|---|
| Any creative work — new feature, module, doc, framing | **design/brainstorm** (then grill) |
| Multi-step task with a spec or requirements | **write-a-plan → execute-the-plan** |
| Any bug, unexpected output, "why does this say X" | **systematic-debugging** |
| Any code OR config written (even one shell line) | **test-driven-development** |
| Before claiming work done / before a commit | **verification-before-completion** |
| Before opening a PR / reviewing a change | **code-review** (request + receive) |
| Isolating an experiment | **a worktree** |
| Wrapping up a branch | **finish-a-branch** |

Two clauses make the table robust:

- **When in doubt, invoke.** If no row obviously fits, the agent still invokes
  the meta "how do I pick a workflow" check rather than improvising. The default
  is *route*, never *wing it*.
- **Explicit user-override carve-out.** The user may tell the agent to skip a
  workflow for a *specific* request — and the agent does so, **for that request
  only**. An override never becomes the new standing behaviour. Absent an
  explicit override, the routing is binding.

Routing is what makes the whole loop self-enforcing: a "small config tweak"
that would otherwise be done ad hoc is forced through TDD; a "quick question
about a failing test" is forced through systematic-debugging. The ceremony is
the point — skipping it is how partial, untested, false-`DONE` work merges.

## 2. Adopt the one expensive-to-retrofit bet on day one

Most architectural choices are cheap to defer. **One usually is not** — the bet
whose cost to retrofit grows with every model, controller, and query you add.
For a multi-tenant SaaS that is almost always **tenant isolation**. Make that
bet on day one and make it **fail-closed by construction**, so a developer who
*forgets* to scope a query gets a crash, not a silent cross-tenant leak.

Fail-closed-by-construction has four moving parts, all shipped together:

1. **Raise on missing context.** The default query scope filters by the current
   tenant and **raises a named error when no tenant context is set**, instead of
   returning unscoped rows. The fail-closed read and the forgot-to-scope guard
   are the *same* mechanism — a path that never established context crashes
   loudly rather than going wide.
2. **Force-set the security-critical attribute over mass assignment.** On every
   save, a `before_validation`-style hook **overwrites** the tenant attribute
   with the current context, beating any mass-assigned value. The
   param-injection vector is dead by construction; writes also fail closed when
   there is no context.
3. **Uniform 404, no existence leak.** A cross-tenant lookup raises
   "not found" through the *same* code path as a genuinely-absent record — a 404,
   never a 403. "Exists in another tenant" and "doesn't exist" are
   indistinguishable to the caller.
4. **One greppable escape hatch.** A single, explicit, named wrapper
   (`unscoped_block { ... }` or equivalent) is the *only* sanctioned way to step
   outside the scope — for seeds, console, migrations. Its call sites are the
   entire audit surface; everything else inherits the fence for free.

Record the bet as a decision record with its **rejected alternatives** spelled
out (e.g. explicit association-traversal scoping was rejected as fail-*open*
until audited; a third-party tenancy gem was rejected as a dependency over the
~40 lines that *are* the security boundary). Residual gaps — raw-SQL / bulk
APIs that bypass the scope — get named as accepted risk plus a later CI cop.
Day-one runtime guard now; belt-and-suspenders suite later.

The shape generalises: whatever the one bet is for *your* domain, adopt it
first, enforce it by construction so the safe path is the default and the unsafe
path requires a deliberate, greppable opt-out.

## 3. Decision-record hygiene — with rejected alternatives

Decisions worth keeping are recorded in a sequential, numbered directory (one
file per decision; scan for the highest number and increment). The format is
intentionally lean — the value is the **what** and the **why**, not filled-in
sections. The gate for *whether* a decision earns a record lives in the
design-grill pillar (hard-to-reverse **and** surprising **and** a real
trade-off); the hygiene rule *here* is about **content**:

- **Always record the rejected alternatives** and *why* they lost. A decision
  record with no rejected options is a press release. The rejection is the part
  that stops someone re-proposing the same idea in six months.
- **Status is explicit** (Accepted / Superseded). When a new record supersedes
  an old one, say so in both, and recommend archiving the old.
- Records are version-controlled and reviewed **with the code** that embodies
  them, never as a detached wiki.

## 4. Known-ambiguities discipline — flag, don't silently resolve

Every real codebase carries unresolved tensions: a name not yet chosen, two
documents that disagree, duplicate copies with no changelog, two specs defining
the same concept. The constitution keeps an explicit **known-ambiguities list**
and a single rule for it:

> **Flag, don't silently resolve.** When a request touches a listed ambiguity,
> *surface it* and ask — never pick one option silently and proceed as if it
> were settled. Silently resolving an ambiguity launders a guess into apparent
> ground truth.

Paired with a **source-precedence rule** so the agent knows which document
wins when two conflict: name the canonical sources and their order (e.g. ratified
decision records and the current planning corpus override older point-in-time
source material; treat superseded material as *input*, not ground truth).
For undated duplicates, assume the newest mtime is freshest **but confirm before
citing** — and never quote a figure without naming its source file.

## 5. Cross-session memory + the pre-task sweep

Headless and human sessions are amnesiac; durable learning lives in
**memory notes** with a fixed three-part shape:

- **What happened** — the concrete incident, stripped of transient IDs.
- **Why** — the underlying cause, the generalisable lesson.
- **How to apply** — the rule to follow next time, as an imperative.

Carry a **staleness warning** on each note: it is a point-in-time observation,
not live state — verify any code/path claim against the current tree before
asserting it as fact. A note that says "the file is at X:42" can rot; the
*lesson* usually doesn't.

Two standing habits encoded as memory:

- **Pre-task cleanup sweep.** Before starting any new task, leave the
  environment clean and don't proceed until it is. Sweep **VCS**:
  `git fetch --prune`; fast-forward the default branch (`merge --ff-only`);
  delete merged / `gone` branches (local + remote); remove stray worktrees under
  `$WORKTREE_ROOT`; confirm a clean status. Sweep the **tracker**: for each
  recently-merged PR's issue, confirm it actually moved to Done. Report the
  state, then proceed once clean.
- **Tracker↔VCS auto-close may not fire.** The `$CLOSE_KEYWORD <issue-id>`
  line in a PR body only transitions the issue if the tracker↔VCS integration is
  actually wired up — on many workspaces it is not, and the keyword is
  informational only. **After every merge, verify the issue moved to Done; set
  it manually (and post the merge marker) if it did not.** Never assume the merge
  transitioned it — this pairs with the "before-done" routing: the PR is the
  *last* step, opened only after verification and the review trio are green.

---

*This file is a process contract. The drop-in is `templates/CLAUDE.md.snippet`.
If the constitution and the scripts drift apart, fix one or the other — never
let them diverge.*
