# Pillar 2 — Grill before build

Nothing reaches a plan un-designed. Before any unit is decomposed into steps,
the orchestrator runs an **interactive grilling session** with the human: a
relentless, one-question-at-a-time interrogation of the proposed design that
hardens the idea, sharpens its language, and orders its decisions before a single
line of implementation is written. Decisions crystallise into two durable
artifacts — a **glossary** (what the words mean) and **ADRs** (why we chose) —
written *lazily*, only as each decision actually lands.

This is stage 1 (design) and stage 2 (stress-test design) of the loop. It is the
cheapest place to find a flaw: a wrong entity caught here costs a sentence; the
same flaw caught in review costs a re-plan and a re-build.

## The interrogation kernel

> Interview me relentlessly about every aspect of this design until we reach a
> shared understanding. Walk down each branch of the decision tree, resolving the
> dependencies between decisions one by one. **For each question, supply your
> recommended answer.** Ask the questions **one at a time**, waiting for my
> response before moving on. **If a question can be answered by reading the code,
> read the code instead of asking.**

Four non-negotiable properties make this work — drop any one and it degrades into
a survey or a guessing game:

1. **One question at a time.** Never batch. Ask, wait for the answer, let it
   reshape the tree, then ask the next. A wall of ten questions gets one
   skimmed reply; a single sharp question gets a real decision. The answer to
   question *n* frequently dissolves or reframes question *n+1* — batching
   throws that leverage away.

2. **Always recommend — never open-survey.** Every question carries the agent's
   own recommended answer **and its reasoning**, framed as a default to confirm
   or override: *"I'd model this as a separate entity rather than a status flag,
   because the two have independent lifecycles — agree?"* You are stress-testing
   a position, not running a poll. "What should we do about X?" with no proposal
   shifts the design burden back onto the human and wastes the turn.

3. **Read the code, don't ask.** If a question is answerable from the repository
   — "does an entity for this already exist?", "what does the current schema
   call this column?", "how is cancellation handled today?" — go read it. Only
   ask the human what the code genuinely cannot answer: intent, trade-offs,
   priorities, things not yet built. Asking a human a question the codebase
   already answers burns trust and a round-trip.

4. **Resolve dependencies in order.** Decisions form a tree. Settle the
   foundational choice before the choices that hang off it — pick the aggregate
   boundary before debating which fields live on it. Surface and respect the
   ordering rather than hopping around; a later answer should never silently
   invalidate an earlier "settled" one.

## The grilling moves

The grill is adversarial *toward the design*, collaborative *toward the human*.
The recurring moves:

- **Edge-case invention.** Manufacture concrete scenarios that probe the
  boundaries between concepts and force precision. *"A record is created, then
  the parent it belongs to is deleted before it's confirmed — what state is it
  in now?"* Vague designs collapse under specific scenarios; that collapse,
  early, is the whole point.

- **Term-sharpening.** When the human uses a vague or overloaded word, propose a
  precise canonical term on the spot. *"You keep saying 'account' — do you mean
  the paying organisation or the individual login? Those are two different
  things; let's name them."* When a term conflicts with what the glossary
  already records, call it out immediately and force a reconciliation.

- **Code cross-referencing.** When the human asserts how something works, check
  the code. If they contradict each other, surface it as a question, not an
  accusation: *"You said partial cancellation is allowed, but the code only ever
  cancels the whole record — which is correct, the code or the design?"*

- **Dependency-ordering of decisions.** Actively sequence the open questions:
  name what must be decided first and why, defer what depends on it, and refuse
  to let the conversation settle a downstream choice on top of an unsettled
  foundation.

## Lazy file creation

Create artifacts **only when there is something to write** — never up front, never
as empty scaffolds. If no glossary exists, create it the moment the first term is
resolved. If no ADR directory exists, create it when the first ADR-worthy decision
lands. Update each artifact **inline, the instant a decision crystallises** —
never batch them to the end of the session, where they get lost or summarised
away. The artifacts live under the repo's in-repo design root and are
version-controlled and reviewed with the code; the design doc for the unit itself
lands under `$ARTIFACT_ROOT`.

## The glossary — one concept, one canonical word

The glossary is a **pure glossary**: a list of the project's domain terms and what
each one means. It is *not* a spec, a scratchpad, or a home for implementation
decisions (those are ADRs). Keep it utterly free of implementation detail.

**Rules:**

- **Be opinionated.** When several words exist for one concept, pick the best one
  and list the rest under `_Avoid_`. One concept = one canonical word.
- **Keep definitions tight.** One or two sentences. Define what a thing *is*, not
  what it does.
- **Only domain-specific terms.** General programming concepts (timeouts, retries,
  caches) do not belong, however heavily used. Before adding a term, ask: is this
  unique to *this* project's domain, or a generic engineering concept? Only the
  former earns a line.
- **Group under subheadings** when natural clusters emerge; a flat list is fine if
  the terms cohere.

**Format** (neutral example):

```md
# {Project / context name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**:
A confirmed request from a customer for goods or services.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organisation that places orders.
_Avoid_: Client, buyer, account
```

A single repo keeps one glossary at its root. A repo with several bounded
contexts keeps a root map that lists each context, where its glossary lives, and
how the contexts relate (e.g. which emits events the other consumes); infer which
context the current topic belongs to, and ask only if it is genuinely unclear.

## ADRs — and the three-part gate

An ADR records **that** a decision was made and **why**. Most are a single
paragraph — the value is the *that* and the *why*, not filled-in sections. They
live in a sequential, numbered directory (`0001-slug.md`, `0002-slug.md`, …);
scan for the highest number and increment. Create the directory lazily, on the
first ADR.

**Template:**

```md
# {Short title of the decision}

{1-3 sentences: the context, what we decided, and why.}
```

Add `Status` frontmatter, `Considered Options`, or `Consequences` sections **only**
when they carry genuine value — most ADRs need none of them.

**The gate — offer an ADR only when ALL THREE are true:**

1. **Hard to reverse** — changing your mind later costs something meaningful.
2. **Surprising without context** — a future reader looking at the code will
   wonder *"why on earth did they do it this way?"*
3. **The result of a real trade-off** — there were genuine alternatives and you
   picked one for specific reasons.

If any one is missing, **skip it.** Easy to reverse → you'll just reverse it, no
record needed. Not surprising → nobody will wonder. No real alternative → there's
nothing to record beyond "we did the obvious thing." This gate is what keeps the
ADR log signal, not noise.

**What typically qualifies:** architectural shape (monorepo; event-sourced write
model); integration patterns between contexts (domain events vs. synchronous
calls); technology choices with real lock-in (database, message bus, auth
provider, deploy target — not every library); boundary and scope decisions (which
context owns which data; the explicit *no*s); deliberate deviations from the
obvious path (hand-written SQL instead of an ORM, *because X*); constraints
invisible in the code (a latency budget from a partner contract); and rejected
alternatives whose rejection is non-obvious (chose REST over GraphQL for subtle
reasons — record it, or someone re-proposes GraphQL in six months).

## Exit of the grill

The grill ends when the design survives interrogation: every branch of the
decision tree resolved, every fuzzy term sharpened against the glossary, every
ADR-worthy decision recorded, and the unit's design doc committed under
`$ARTIFACT_ROOT`. That committed, grilled design is the input the plan stage
inherits — pointers, not re-explanation.

*This file is a process contract. If the grilling habit drifts from it, fix one
or the other — don't let them diverge.*
