## Agent Brief

<!--
  The DURABLE async-worker specification.

  Posted as a comment (or the body) on a unit-of-work issue the moment it is
  ready for an unattended agent to pick up. The original issue text and any
  discussion are *context*; THIS brief is the contract the agent builds against.

  Why it has to be durable: the issue may sit ready-for-agent for days or
  weeks, and the codebase keeps moving underneath it — files get renamed,
  moved, split, merged. Write the brief so it is still correct when an agent
  finally grabs it.

  ⚠️ **NO file paths and NO line numbers anywhere in this brief.** They go
  stale while the issue waits and will point the agent at the wrong place (or
  nowhere). Describe behaviour, interfaces, types, and contracts instead — the
  agent explores the tree fresh and finds the right place itself. This is the
  single most common way an async brief rots; treat it as a hard rule, not a
  style preference.

  Two more durability rules that follow from the same principle:
  - Behavioural, not procedural — say WHAT the system must do, never HOW /
    which switch statement to edit. The agent owns the implementation shape.
  - Don't assume today's structure survives — name the contract, not the
    current call graph.

  Fill in every section below; delete these comments before posting.
-->

**Category:** bug | enhancement | chore
**Mode:** AFK | HITL
<!--
  AFK  = mergeable unattended; the agent runs the full loop and opens the PR
         with no human in the path until the merge gate. Prefer this.
  HITL = a human checkpoint is required mid-loop (a decision the brief can't
         settle, an irreversible action, a judgement call). Say WHERE the
         checkpoint is and WHAT the human decides.
-->

**Summary:** one line — what changes and why it matters.

### Behaviour

**Current behaviour**
What happens today. For a bug, this is the broken behaviour and how to see it
(conditions/inputs that trigger it — described behaviourally, no paths). For an
enhancement, this is the status quo the change builds on.

**Desired behaviour**
What should happen once the work lands. Be specific about edge cases, error
conditions, and the empty/zero/duplicate/concurrent paths — these are where an
unattended agent guesses wrong. Describe observable outcomes, not internals.

### Key interfaces / contracts

Name the shapes the agent should look for or introduce — by name and contract,
never by location:

- `TypeOrModelName` — the field/attribute/relationship that must change, and why.
- `methodOrCommandName(...)` — what it accepts and returns now vs. what it
  should accept and return after.
- Config / message / event shape — any new option, key, or payload field, with
  its type and default.

### Acceptance criteria

Concrete and independently verifiable — the agent's definition of done, and what
the review pass will check against. Each line a reviewer can confirm true or
false on its own. Prefer observable, runnable checks over adjectives.

- [ ] Specific, testable criterion (an exact input → exact outcome).
- [ ] Specific, testable criterion (an edge / error path, with its outcome).
- [ ] Specific, testable criterion (the cross-tenant / unauthorized / duplicate
      guard holds — name the observable result, e.g. denied, deduped, 404).
- [ ] A passing automated test exists for each scenario above.

### Out of scope

State explicitly what NOT to touch — this is what stops an unattended agent from
gold-plating or dragging in adjacent work.

- The thing that looks related but is a separate unit of work.
- The refactor / rename the agent might be tempted to do in passing.
- Any capability that belongs to a later slice (don't let this unit claim it).

<!--
  Smell test before posting:
  - Zero file paths, zero line numbers? (re-read; this is the usual failure)
  - Could the agent verify "done" purely from the acceptance criteria?
  - Is every criterion independently checkable?
  - Is out-of-scope non-empty?
  - Behavioural, not a how-to? Durable against a rename/move?
  If any answer is no, the brief will rot before it's picked up. Fix it.
-->
