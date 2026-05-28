# Next Iteration Plan (4 Weeks)

## Scope Window
- Timebox: 4 weeks immediately after v0.1.0 release.
- Goal: stabilize workspace-based UX, improve try-out reliability, and close release readiness gaps for v0.1.1.
- Execution board: `plan/30-execution/iteration-4-week-delivery-board.md`.
- PR checklist: `plan/30-execution/iteration-4-week-pr-checklist.md`.

## Milestones

1. M7 Workspace Stability and Safety (end of week 1)
- Objectives:
  - Resolve workspace persistence and switching edge cases.
  - Add workspace rename support and basic data safety checks.
  - Ensure invalid workspace state fails gracefully in UI.
- Exit Criteria:
  - Workspace create/switch/delete/rename flows pass web tests.
  - No high-severity workspace bugs open.

2. M8 Try-Out Reliability and Proxy Hardening (end of week 2-3)
- Objectives:
  - Harden local proxy behavior for CORS/network failure paths.
  - Improve try-out request/response diagnostics in web UI.
  - Add deterministic error mapping for network/proxy failures.
- Exit Criteria:
  - Proxy integration tests cover success + failure scenarios.
  - Web try-out shows actionable errors for timeout/CORS/connection failures.

3. M9 Performance and Patch Release (end of week 4)
- Objectives:
  - Improve large-spec rendering responsiveness (list and detail views).
  - Complete regression sweep and prepare v0.1.1 release notes.
  - Re-validate contributor onboarding docs with a clean machine run.
- Exit Criteria:
  - Benchmark fixture render p95 improves against v0.1.0 baseline.
  - v0.1.1 release checklist items are complete and signed off.

## Prioritized Delivery Themes

1. Stabilize core user journeys
- Workspace lifecycle and spec ingestion remain uninterrupted.

2. Reduce operational support load
- Improve diagnostics and deterministic failures across CLI proxy and web try-out.

3. Improve confidence in change velocity
- Increase test coverage around known regression hotspots before adding new feature classes.

## KPI Targets (Iteration)

1. Quality
- 0 critical defects open for workspace and try-out flows at iteration close.
- >= 95% CI pass rate on main over rolling 14 days.

2. Reliability
- CLI proxy command returns deterministic exit behavior across tested failure modes.
- Try-out error messages map to user action in <= 2 steps (retry, auth, endpoint, proxy).

3. Performance
- Large fixture operation-list first render p95 improves by >= 20% vs v0.1.0 baseline.

## Risk Alignment
- R-002 (CORS/network): addressed by M8 proxy and try-out hardening.
- R-003 (large spec performance): addressed by M9 performance work.
- R-005 (regression leakage): addressed through integration and component test expansion across M7-M9.

## Scope Guardrails

1. No new feature classes unless a scope-change note is approved against R-001.
2. Prioritize reliability and usability defects over net-new UX breadth.
3. Any architecture-impacting changes require ADR update before implementation.

## Implementation Start (In Progress)

1. Started: N0-1 Workspace rename flow
- Status: Completed
- Delivery links:
  - `plan/30-execution/iteration-4-week-delivery-board.md` (N0-1)
  - `plan/30-execution/iteration-4-week-pr-checklist.md` (N0-1)
- Initial implementation scope:
  - Wire workspace selector into app header
  - Add rename workflow with duplicate-name validation
  - Add component tests for rename success + duplicate prevention

2. Next implementation target: N0-1b Workspace state recovery hardening
- Status: In progress
- Current implementation scope:
  - Sanitize malformed workspace records from localStorage
  - Self-heal missing/invalid active workspace ID to safe fallback
  - Add hook tests for malformed storage and fallback behavior

3. Next implementation target: N0-1c Workspace lifecycle regression gate
- Status: In progress
- Current implementation scope:
  - Add create -> rename -> switch -> delete flow test to app suite
  - Ensure lifecycle coverage runs in default web test run