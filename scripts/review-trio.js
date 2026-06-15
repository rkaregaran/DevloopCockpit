// review-trio — the multi-lens adversarial review stage.
//
// Three independent single-purpose finders run in parallel — Security (always),
// QA-against-acceptance (always), Usability/a11y (UI-conditional). Each finder
// defaults to block. Every high/critical finding then gets a second adversarial
// REFUTER agent that tries to disprove it citing real code; only un-refuted
// findings block. The gate is severity-triage, NOT zero-findings.
//
// Config seam: project-specific surface (issue-id shape, acceptance-spec format,
// stack test command) is read from the bundle's config.sh — see config.template.sh
// for the canonical variable names. This file stays project-agnostic; the only
// concrete bindings that remain are the chosen stack (Linear tracker, GitHub PRs,
// Rails verification profile), which are themselves config-driven defaults.
//
// Shape: the workflow body lives in the exported `run(input, harness)` async
// function. The harness requires it and supplies the agent/pipeline/parallel/log
// primitives — keeping this file a valid standalone module (passes node --check)
// rather than relying on injected globals + a top-level return.

const meta = {
  name: 'review-trio',
  description: 'Review stage: parallel security/QA/usability passes with adversarial verification of PR-blocking findings',
  whenToUse: 'Review stage of a unit-of-work loop. args: {issue, branch, acceptance, uiChanged}',
  phases: [
    { title: 'Trio', detail: 'security, QA, usability — one finder each, in parallel' },
    { title: 'Verify', detail: 'adversarial refuter per high/critical finding' },
  ],
}

// Config the orchestrator threads in (sourced from config.sh; env-overridable for
// testability). ACCEPTANCE_FORMAT drives how the per-unit acceptance spec is
// described to the QA pass — the spec text itself arrives in `input.acceptance`.
const env = (typeof process !== 'undefined' && process.env) ? process.env : {}
const ACCEPTANCE_FORMAT = env.ACCEPTANCE_FORMAT || 'gherkin'
const TEST_CMD = env.TEST_CMD || 'bin/rails test'

// Human-readable name for the acceptance oracle, by format. Drives the QA prompt
// so the finder knows what shape of spec it is reading and how to map coverage.
const ACCEPTANCE_LABEL = {
  'gherkin': 'Gherkin acceptance scenarios + test plan',
  'user-story-ac': 'user-story acceptance criteria + test plan',
  'test-manifest': 'acceptance test manifest',
}[ACCEPTANCE_FORMAT] || `acceptance spec (${ACCEPTANCE_FORMAT})`

// The unit a QA pass proves coverage against, by format. Gherkin → "scenario";
// user-story-ac → "criterion"; test-manifest → "listed test".
const ACCEPTANCE_UNIT = {
  'gherkin': 'scenario',
  'user-story-ac': 'acceptance criterion',
  'test-manifest': 'listed test',
}[ACCEPTANCE_FORMAT] || 'acceptance item'

const FINDINGS = {
  type: 'object', additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' },
          severity: { enum: ['low', 'medium', 'high', 'critical'] },
          file: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['title', 'severity', 'detail'],
      },
    },
  },
  required: ['pass', 'summary', 'findings'],
}

const VERDICT = {
  type: 'object', additionalProperties: false,
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'],
}

// Build the parallel finder set for this run. Security + QA always fire; the
// usability finder is UI-conditional (synthesised as N/A-pass below when absent).
function buildDims({ issue, branch, acceptance, uiChanged }) {
  return [
    {
      key: 'security',
      prompt: `Security pass (review trio, pass 1) for ${issue} on branch ${branch}. Review the branch diff (git diff origin/main...HEAD) and the touched code. Check: SQL/command injection; authorization and tenant isolation — cross-tenant data leakage is CRITICAL (inspect every scoped query, ownership/authorization policies, and strong-params that permit a tenant key or a cross-tenant foreign key); secret leakage; immutability/audit bypasses on records that must not change after creation; unsafe deserialization. Verify any standing security-scanner ignore entries still hold. pass=true only if nothing high/critical.`,
    },
    {
      key: 'qa',
      prompt: `QA pass (review trio, pass 2) for ${issue} on branch ${branch}. The unit's ${ACCEPTANCE_LABEL}:\n\n${acceptance}\n\nVerify: (i) a passing test exists for EVERY ${ACCEPTANCE_UNIT} — name each test file:line; (ii) the test plan's edge/negative cases are present; (iii) the implementation actually satisfies each ${ACCEPTANCE_UNIT} (read the code, not just the tests); (iv) run \`${TEST_CMD}\` and report the exact counts. pass=true only if every ${ACCEPTANCE_UNIT} is covered and the suite is green.`,
    },
    uiChanged ? {
      key: 'usability',
      prompt: `Usability & accessibility pass (review trio, pass 3) for ${issue} on branch ${branch}. Against the project design system: design-token adherence, information density appropriate to each role, and any documented interaction principles. WCAG AA: color contrast in every supported theme, full keyboard navigation, adequately sized tap/click targets, and a visible focus indicator. Review only the changed UI surface (git diff origin/main...HEAD -- the view/asset/client directories). pass=true only if no a11y blockers.`,
    } : null,
  ].filter(Boolean)
}

// The review stage. `harness` supplies the orchestration primitives:
//   agent(prompt, opts)        → runs one finder/refuter session, returns the schema'd result
//   pipeline(items, map, then) → map each finder in parallel, chain `then` per result
//   parallel(thunks)           → run an array of () => Promise concurrently
//   log(msg)                   → stage log line
async function run(input, harness) {
  // Args may arrive JSON-encoded depending on the invoker; normalize, then fail FAST
  // on anything missing — a silent undefined turns the trio into a hollow green gate
  // (the canonical false-completion mode: a finder "reviews" undefined and an N/A
  // pass gets fabricated without any agent actually looking). See failure-modes.md.
  const parsed = typeof input === 'string' ? JSON.parse(input) : input
  if (!parsed || !parsed.issue || !parsed.branch || !parsed.acceptance || parsed.uiChanged === undefined) {
    throw new Error(`review-trio: missing args {issue, branch, acceptance, uiChanged} — got ${JSON.stringify(parsed ? Object.keys(parsed) : parsed)}`)
  }
  const { issue, branch, uiChanged } = parsed
  const { agent, pipeline, parallel, log } = harness

  const dims = buildDims(parsed)

  const results = await pipeline(
    dims,
    d => agent(d.prompt, { label: `trio:${d.key}`, phase: 'Trio', schema: FINDINGS })
          .then(r => r && { key: d.key, ...r }),
    async review => {
      if (!review) return null
      const blocking = review.findings.filter(f => f.severity === 'high' || f.severity === 'critical')
      const verdicts = await parallel(blocking.map(f => () =>
        agent(
          `Adversarially try to REFUTE this ${review.key} finding for ${issue} on branch ${branch}: "${f.title}" — ${f.detail}${f.file ? ` (${f.file})` : ''}. Read the actual code. refuted=true only if the finding is wrong, already mitigated, or unreachable — cite the evidence. If it genuinely holds, refuted=false.`,
          { label: `verify:${f.title.slice(0, 40)}`, phase: 'Verify', schema: VERDICT }
        ).then(v => ({ ...f, refuted: v ? v.refuted : false, verdictReason: v ? v.reason : 'verifier unavailable — treated as confirmed' }))
      ))
      return { ...review, confirmedBlocking: verdicts.filter(Boolean).filter(f => !f.refuted) }
    }
  )

  const passes = results.filter(Boolean)
  // Explicit N/A synthesis: when no UI changed there is no usability finder, so we
  // synthesise the pass rather than leaving the dimension silently absent — a missing
  // pass and a deliberate N/A pass must never be indistinguishable downstream.
  if (!uiChanged) passes.push({ key: 'usability', pass: true, findings: [], confirmedBlocking: [], summary: 'N/A (no UI changes in branch diff)' })

  const confirmedBlocking = passes.flatMap(p => p.confirmedBlocking || [])
  log(`${passes.length} passes; ${confirmedBlocking.length} confirmed blocking finding(s) after adversarial verify`)
  return { issue, branch, passes, confirmedBlocking }
}

module.exports = { meta, FINDINGS, VERDICT, buildDims, run }
module.exports.default = run
