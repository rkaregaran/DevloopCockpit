# Pillar 6 — Workflow-grain backlog decomposition

How work is sliced *before* the loop ever runs. Get the grain wrong and the loop
(Pillar 1) runs on the wrong thing — too small and the ceremony is wasted on a
toy; too large and there is no demoable integration gate. The rule that holds it
together: **slice vertically, then build at workflow grain.** You can have a
perfectly vertical backlog and still fail by *executing horizontally within each
slice* — designing, branching, and merging layer-by-layer so the end-to-end
journey is never assembled, demoed, or verified as one deliverable.

## The three-tier grain

```
slice      ─── VALUE grain: a coherent capability a named user can test
  workflow ─── BUILD / VERIFY / COMMIT grain (THE unit): one branch, one loop,
    step   ───   one demo, one PR  ·  owns the end-to-end acceptance spec
               TASK grain: a build-checklist item — no branch, no loop, no PR
```

- **Slice** (top, value): the milestone in the tracker. Groups a *few*
  workflows. Ships only when all its workflows' PRs are merged.
- **Workflow** (middle, **the unit of work**): a parent issue with its own
  branch (`gitBranchName`-equivalent). It is the coherent end-to-end thing a
  named user can demo as one capability. **It owns the end-to-end acceptance
  spec** (`$ACCEPTANCE_FORMAT`) — *this is the integration gate the QA review
  pass (Pillar 5) runs against.* It carries the rough estimate (the capacity
  unit you reason about), the cross-workflow blocked-by edges (Pillar 1's
  fan-out reads the graph at this grain), and an automatic progress rollup from
  its steps.
- **Step** (leaf, task): a sub-issue under the workflow parent. It is a
  **checklist item only** — it gets **no own branch, no own loop, no own PR**.
  It keeps its detailed test plan verbatim and is checked off (Done) as its
  slice of the parent's build lands on the one branch.

Why the middle tier and not the leaf: the parent issue is the only native
tracker object that can have its *own branch* and group ordered sub-issues, so
it is the only place the workflow gets a buildable identity. Intra-workflow
dependencies between steps collapse into the parent's internal **build order**
(the plan's task sequence), not tracker links. Only **cross-workflow** edges
stay as tracker relations, lifted to parent grain.

## Every issue is a tracer-bullet vertical slice

A workflow (and every step inside it) is a **thin vertical slice that cuts
through ALL integration layers end-to-end** — schema, API/business-logic, UI,
tests — and is **demoable or verifiable on its own**. It is **never** a
horizontal layer split.

- **Right (vertical, tracer-bullet):** "Activate a record through its approval
  gate" — the whole transition: schema change, the service that enforces the
  gate, the screen that drives it, and the tests, all in one. Demoable alone.
- **Wrong (horizontal layer split):** "Add the model" / "Add the controller" /
  "Add the view" as three separate issues. None is demoable; the gate they're
  supposed to enforce is never exercised until all three merge.

Prefer **many thin vertical slices over few thick ones**. A single-step
workflow is correct, not under-decomposed, when it is one distinct external
system / content surface / capability — don't pad it with horizontal busywork.

## AFK vs HITL tagging

Tag every workflow at decomposition time:

- **AFK** (away-from-keyboard): can be implemented and merged **unattended** —
  the spec is complete enough that a headless chain runs end to end with only the
  async veto + merge gate from a human. **Prefer AFK.**
- **HITL** (human-in-the-loop): requires human interaction mid-loop — an
  architectural judgment call, a design review, external credentials/access, or
  manual validation a test can't cover. Tag it HITL and say *why* it can't be
  delegated.

Maximise AFK. Each HITL workflow is a serialization point in an otherwise
parallel fan-out, so reach for it only when a genuine human decision is
unavoidable.

## The durable Agent Brief contract

When a workflow moves to *ready-for-agent*, it carries an **Agent Brief** — a
structured spec comment that is the **authoritative contract** the AFK chain
builds from. The issue body and discussion are context; the brief is the spec.

The brief may sit ready for **days or weeks** while the codebase moves
underneath it. Write it to survive that wait:

- **Behavioural, not procedural** — describe **what** the system must do, never
  **how** to implement it. The agent explores fresh and makes its own
  implementation decisions. ("When a user runs the command with no arguments,
  they see a summary of what needs attention" — not "add a switch statement in
  the handler".)
- **Concrete, testable acceptance criteria** — each one independently
  verifiable, so the agent knows when it's done. ("Listing issues with the
  ready label returns ones past initial classification" — not "triage should
  work correctly.")
- **Explicit out-of-scope** — name what must *not* change, so the agent doesn't
  gold-plate or wander into an adjacent feature.
- **NEVER file paths or line numbers.** This is the load-bearing rule: paths and
  line numbers **go stale while the issue waits** — files get renamed, moved,
  refactored — and a brief that pins them rots into actively-wrong instructions.
  Name **interfaces, types, behavioural contracts, and config shapes** the agent
  should look for instead. (One narrow exception: a decision-encoding snippet a
  prototype produced — a state machine, schema, or type shape that prose can't
  express as precisely — may be inlined, trimmed to the decision-rich parts.)

Brief skeleton: `Category` (bug/enhancement) · `Summary` (one line) · `Current
behaviour` · `Desired behaviour` (with edge cases) · `Key interfaces` · concrete
`Acceptance criteria` checklist · `Out of scope`. See
`templates/agent-brief.template.md`.

## The triage state machine

Incoming issues move through a small state machine before they're ever picked up.
Each triaged issue carries **exactly one category role and one state role**;
conflicting state roles are flagged to the maintainer, not silently resolved.

- **Category:** `bug` (something broken) · `enhancement` (new feature/improvement).
- **State:** `needs-triage` → (`needs-info` ⇄ `needs-triage`) → one of
  `ready-for-agent` (fully specified, AFK), `ready-for-human` (needs human
  implementation), or `wontfix` (won't be actioned).

```
(unlabeled) ──► needs-triage ──┬─► ready-for-agent   (+ Agent Brief, AFK)
                  ▲            ├─► ready-for-human   (brief-shaped + why-not-delegable)
                  │            ├─► needs-info ──(reporter replies)──┘ back to needs-triage
                  └────────────┴─► wontfix          (bug: explain+close · enh: → out-of-scope KB)
```

Triage flow per issue: **gather context** (read body, comments, prior triage
notes so resolved questions aren't re-asked; scan the out-of-scope KB for a prior
rejection that matches) → **recommend** category + state with reasoning →
**reproduce** (bugs only, before any grilling — a confirmed repro makes a far
stronger brief) → **grill** if it needs fleshing out → **apply the outcome**
(post the Agent Brief, post triage notes, or record the rejection). A maintainer
can override the state at any time; flag unusual transitions and confirm before
acting. The names above are canonical roles — map them to your tracker's actual
label strings in one place.

## The out-of-scope knowledge base — one file per concept

Rejected **enhancements** (not bugs) get a durable record so the reasoning isn't
lost and the same request isn't re-litigated. Keep a `.out-of-scope/` directory,
**one Markdown file per concept** (not per issue): a short descriptive
kebab-case name, a `# Concept` heading, the decision, a substantive durable
**reason**, and a `Prior requests` list linking every issue that asked for it.

- A good reason cites project scope/philosophy, a technical constraint, or a
  strategic decision — and is **durable** (avoid "too busy right now"; that's a
  deferral, not a rejection).
- **On reject:** match against existing files first; append to the matching one
  or create a new one; comment the decision linking the file; then close.
- **On triage:** read the KB during gather-context and surface any prior
  rejection a new issue resembles — match by **concept similarity, not
  keywords**. The maintainer may *confirm* (append + close), *reconsider*
  (delete/update the file, let the issue proceed), or *disagree* (related but
  distinct, proceed normally).

---

*This file governs how the backlog is shaped before Pillar 1 runs. Decompose
vertically, build at workflow grain, keep briefs behavioural and path-free, and
let the triage machine + out-of-scope KB carry the institutional memory.*
