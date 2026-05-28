# Iteration Delivery Board (4 Weeks)

## Window
- Release stream: post-v0.1.0 toward v0.1.1
- Duration: 4 weeks
- Primary objective: reliability and performance hardening before new feature classes
- Execution PR checklist: `plan/30-execution/iteration-4-week-pr-checklist.md`

## Delivery Rules
1. Work in this board must map to M7, M8, or M9.
2. Every item must include a test artifact before close.
3. Scope increases require explicit risk note against R-001.

## Week 1 (M7): Workspace Stability and Safety

1. Item: Workspace rename flow
- ID: N0-1
- Owner: Web maintainer
- Estimate: 1.5 days
- Dependencies: existing workspace CRUD hooks
- Done when:
  - rename UI supports validation for empty/duplicate names
  - rename preserves workspace identity and environment linkage
- Verification artifacts:
  - component tests for rename success and validation failures
  - manual smoke script for create -> rename -> switch -> delete

2. Item: Workspace state recovery hardening
- ID: N0-1b
- Owner: Web maintainer
- Estimate: 1 day
- Dependencies: localStorage workspace schema
- Done when:
  - app handles malformed or partial workspace storage without crash
  - fallback state creates a safe default workspace path
- Verification artifacts:
  - tests for malformed storage and missing active workspace

3. Item: Regression gate for workspace lifecycle
- ID: N0-1c
- Owner: QA owner
- Estimate: 0.5 day
- Dependencies: test setup in apps/web
- Done when:
  - lifecycle path tests run in default CI suite
- Verification artifacts:
  - CI run with lifecycle suite included

## Week 2-3 (M8): Try-Out and Proxy Reliability

1. Item: Try-out error taxonomy and action mapping
- ID: N0-2
- Owner: Web maintainer
- Estimate: 2 days
- Dependencies: try-out utility and response inspector
- Done when:
  - timeout, network, CORS, auth, and proxy-down errors map to actionable UI messages
  - each message includes a user-next-action hint
- Verification artifacts:
  - unit tests for error mapping matrix
  - snapshot tests for rendered error states

2. Item: Proxy failure-path integration tests
- ID: N0-3
- Owner: CLI maintainer
- Estimate: 2 days
- Dependencies: proxy command and proxy server modules
- Done when:
  - tests cover upstream timeout, upstream 5xx, bad target URL, and proxy unavailable
  - exit behavior and output remain deterministic
- Verification artifacts:
  - integration tests in packages/cli/tests

3. Item: Web + proxy end-to-end contract checks
- ID: N0-3b
- Owner: QA owner
- Estimate: 1 day
- Dependencies: local proxy command and web try-out mode
- Done when:
  - documented contract for proxy request/response and error payload shape
  - smoke checks run against a fixture endpoint set
- Verification artifacts:
  - contract test notes + scripted smoke checklist

## Week 4 (M9): Performance and Patch Readiness

1. Item: Large-spec rendering optimization
- ID: N1-1
- Owner: Web maintainer
- Estimate: 2.5 days
- Dependencies: operation list/detail rendering path
- Done when:
  - operation list render path optimized for benchmark fixture
  - interaction remains stable while navigating large operation sets
- Verification artifacts:
  - benchmark before/after report with p95 delta

2. Item: Contributor clean-machine validation
- ID: N1-2
- Owner: Project lead
- Estimate: 1 day
- Dependencies: README and contributing docs
- Done when:
  - fresh environment setup completes without undocumented steps
  - docs updated for observed friction
- Verification artifacts:
  - setup run log and doc update PR references

3. Item: v0.1.1 regression sweep and release prep
- ID: M9-RC
- Owner: Project lead
- Estimate: 1 day
- Dependencies: quality gates and release checklist
- Done when:
  - no open critical defects
  - release checklist is signoff-ready
- Verification artifacts:
  - release checklist completion evidence
  - final lint/build/test run references

## Dependency Summary
1. N0-1 precedes N0-1c.
2. N0-2 and N0-3 can run in parallel after week 1 stabilization.
3. N1-1 starts after M8 reliability fixes are merged to reduce noise in benchmarks.

## Capacity and Risk Buffers
1. Reserve 15% of iteration capacity for unplanned defect response.
2. If critical defects exceed buffer, defer N2-class enhancements.
3. Any net-new feature requests require explicit change-control entry.

## Tracking and Reporting
1. Daily: item status (Not Started, In Progress, Blocked, Done).
2. Weekly: milestone health (On Track, At Risk, Off Track).
3. Closeout: KPI report against M7/M8/M9 exit criteria.