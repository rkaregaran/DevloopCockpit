#!/usr/bin/env bash
# agentic-devloop — project configuration (the ONE file you fill in)
#
# Copy this to `config.sh` next to it, edit the values for your project, and
# keep `config.sh` out of version control if it holds anything sensitive.
# Every script and stage-settings file in this skill reads from here, so the
# rest of the bundle stays project-agnostic. Defaults below are concrete for a
# Rails + Linear + GitHub project on the Claude Code harness (macOS). Porting to
# another stack/tracker/host is an edit to THIS file, not a rewrite.
#
# This file lives at the skill ROOT; the scripts live in scripts/ and source it
# one level up. Resolve + source pattern used by every script:
#   HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   ROOT_DIR="$(cd "$HERE/.." && pwd)"
#   . "$ROOT_DIR/config.sh"   # else config.template.sh

set -euo pipefail

# ── Identity ────────────────────────────────────────────────────────────────
# Regex an issue id must match. It is VALIDATED before it is ever interpolated
# into a filesystem path or branch name (untrusted-input → path discipline).
ISSUE_ID_PATTERN='^[A-Z][A-Z0-9]*-[0-9]+$'   # e.g. ABC-123

# ── Tracker + VCS host (concrete first-class adapters) ───────────────────────
TRACKER="linear"          # issue tracker with hierarchy + branch-name source + states + comments
VCS_HOST="github"         # pull-request host
CLOSE_KEYWORD="Closes"    # PR-body keyword that links/closes the issue
# NOTE: tracker↔VCS auto-close is not guaranteed to fire. After merge, verify the
# issue actually moved to Done — or move it manually. (See reference/failure-modes.md)

# ── Path roots ───────────────────────────────────────────────────────────────
ARTIFACT_ROOT="docs/specs"                       # in-repo design/plan artifacts per unit
HANDOFF_ROOT="${HOME}/.agentic-devloop/handoffs" # durable, OUTSIDE the repo and NOT $TMPDIR
WORKTREE_ROOT=".worktrees"                        # git worktrees, one per in-flight unit
CHAIN_LOG_ROOT="${HOME}/.agentic-devloop/chains"  # durable per-unit stage chain log (crash recovery)

# ── Unattended commit signing ────────────────────────────────────────────────
# A dedicated, passphrase-less automation identity scoped to the worktree, so
# headless commits sign without an interactive credential-manager prompt and the
# human's main-checkout signing config is untouched. (Set to "" to disable signing.)
AUTOMATION_SIGNING_KEY="${HOME}/.ssh/automation_signing"
# Gotcha to re-check per credential manager: 1Password's op-ssh-sign hijacks
# gpg.ssh.program globally; the worktree sets gpg.ssh.program=ssh-keygen LOCALLY.

# ── Verification profile (Rails defaults; swap for your stack) ────────────────
TEST_CMD="bin/rails test"
SYSTEM_TEST_CMD="bin/rails test:system"
LINT_CMD="bin/rubocop"
SECURITY_CMD="bin/brakeman -q"
MIGRATE_CMD="bin/rails db:prepare"
BUILD_CMD=""                                      # e.g. asset/precompile step; empty = none
# The test runner emits this deterministic JSON stamp — the trust anchor a stage's
# exit contract checks (its mtime must be NEWER than HEAD). Schema:
#   {"exit_code":N,"examples":N,"failures":N,"finished_at":"<iso8601>"}
TEST_STAMP_PATH="tmp/agentic-devloop-last-suite.json"

# ── Onboarding probe profile (scripts/onboard + scripts/doctor) ──────────────
# These drive the one-command developer setup + the read-only readiness check.
# Each is consumed as `${VAR:-<Rails default>}`, so leaving any unset keeps the
# Rails defaults below; a non-Rails port routes its toolchain through here. They
# live in this file (the config seam) so the whole profile is discoverable in one
# place. (Defined with ?= -style fallback so an env override on the command line
# still wins for hermetic tests.)
: "${SETUP_CMD:=bin/setup --skip-server}"          # one-shot deps + db prepare (onboard runs this)
# Language-runtime pin (empty RUNTIME_NAME = skip the runtime step entirely):
: "${RUNTIME_NAME:=Ruby}"
: "${RUNTIME_VERSION:=4.0.5}"
: "${RUNTIME_VERSION_CMD:=ruby -eprint(RUBY_VERSION)}"  # MUST be space-free per token (word-split unquoted)
: "${RUNTIME_INSTALL_CMD:=asdf install}"
: "${RUNTIME_MANAGER_PKG:=asdf}"                   # package providing the version manager
: "${RUNTIME_MANAGER_BIN:=asdf}"                   # the version-manager executable to probe
# Database provisioning + readiness:
: "${DB_READY_CMD:=pg_isready -q}"                 # exit 0 iff the dev db is reachable
: "${DB_READY_PROBE:=pg_isready}"                  # the db-readiness executable to probe on PATH
: "${DB_INSTALL_CMD:=brew install postgresql@16}"
: "${DB_START_CMD:=brew services start postgresql@16}"
: "${DEPS_CHECK_CMD:=bundle check}"                # exit 0 iff dependencies already installed
# Non-scriptable shared secret (empty = skip the check; Rails: the master key path):
: "${SHARED_SECRET_PATH:=}"
: "${SHARED_SECRET_HINT:=Get it from your team secret store / a teammate}"
# Package installer the host-step remedies assume (macOS Homebrew default):
: "${PKG_INSTALL:=brew install}"
: "${PKG_BIN:=brew}"
# CLIs the cockpit drives: VCS-host CLI + agent harness CLI.
: "${VCS_CLI:=gh}"
: "${AGENT_CLI:=claude}"
# Personal commit-signing key (only minted if no global SSH signer exists):
: "${PERSONAL_SIGNING_KEY:=${HOME}/.ssh/personal_signing}"

# ── Acceptance oracle ─────────────────────────────────────────────────────────
# The format of the per-unit acceptance spec fed verbatim to the QA review pass.
ACCEPTANCE_FORMAT="gherkin"   # gherkin | user-story-ac | test-manifest

# ── Circuit-breaker fence ─────────────────────────────────────────────────────
# Paths a headless stage may NEVER write (its own governance/secret/config dirs).
# This is enforced by the harness, not by the agent — it cannot be overridden from
# inside a stage. VERIFY THIS LIST EMPIRICALLY against your harness version.
# .github is intentionally NOT fenced (CI/workflow edits are normal unit work).
CIRCUIT_BREAKER_PATHS=".git .claude .devcontainer .vscode .idea .husky .cargo .yarn .mvn .env"

# ── Notifications ─────────────────────────────────────────────────────────────
# Exactly three events fire to the human: plan-ready, escalation, pr-open.
# Replace the body to route to Slack/email/etc. Signature: notify <event> <message>
notify() {
  local event="$1" message="$2"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"${message}\" with title \"agentic-devloop: ${event}\"" >/dev/null 2>&1 || true
  else
    printf '[agentic-devloop:%s] %s\n' "$event" "$message" >&2
  fi
}
