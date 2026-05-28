# Iteration PR Checklist (Post-v0.1.0)

## Usage
1. Create one branch and one PR per checklist item unless noted.
2. Include item ID in branch name and PR title.
3. Add validation output for lint, build, and test in each PR.

## Naming Conventions
- Branch: `feat/<id>-<short-scope>` or `fix/<id>-<short-scope>`
- PR title: `[<id>] <summary>`
- Commit prefix: `<id>:`

## M7 Workspace Stability (Week 1)

1. N0-1 Workspace rename flow
- Branch: `feat/n0-1-workspace-rename-flow`
- PR title: `[N0-1] Add workspace rename flow with validation`
- Primary package: `apps/web`
- Suggested file focus:
  - `apps/web/src/features/workspaces/use-workspaces.ts`
  - `apps/web/src/features/workspaces/WorkspaceSelector.tsx`
  - `apps/web/src/app/App.tsx`
- Validation checklist:
  - rename works for active and inactive workspaces
  - duplicate and empty names show user-visible errors
  - environments remain linked after rename
- Required tests:
  - workspace rename component tests

2. N0-1b Workspace state recovery hardening
- Branch: `fix/n0-1b-workspace-state-recovery`
- PR title: `[N0-1b] Harden workspace recovery from malformed storage`
- Primary package: `apps/web`
- Suggested file focus:
  - `apps/web/src/features/workspaces/use-workspaces.ts`
  - `apps/web/src/app/App.tsx`
- Validation checklist:
  - malformed localStorage state does not crash app
  - safe default workspace bootstrap path works
- Required tests:
  - workspace hook tests for malformed storage scenarios

3. N0-1c Workspace lifecycle CI gate
- Branch: `test/n0-1c-workspace-lifecycle-gate`
- PR title: `[N0-1c] Add workspace lifecycle regression gate tests`
- Primary package: `apps/web`
- Suggested file focus:
  - `apps/web/src/app/App.test.tsx`
  - `apps/web/src/test-setup.ts`
- Validation checklist:
  - lifecycle tests run in default web test suite
- Required tests:
  - create -> rename -> switch -> delete path tests

## M8 Try-Out + Proxy Reliability (Week 2-3)

1. N0-2 Try-out error taxonomy and action mapping
- Branch: `feat/n0-2-tryout-error-taxonomy`
- PR title: `[N0-2] Add actionable try-out error taxonomy`
- Primary package: `apps/web`
- Suggested file focus:
  - `apps/web/src/features/tryout/tryout-utils.ts`
  - `apps/web/src/app/App.tsx`
- Validation checklist:
  - timeout, CORS, auth, proxy-down, and network errors have mapped actions
  - error states are human-readable and deterministic
- Required tests:
  - unit tests for error mapping table
  - UI tests for representative error rendering

2. N0-3 Proxy failure-path integration tests
- Branch: `test/n0-3-proxy-failure-integration`
- PR title: `[N0-3] Add proxy failure-path integration coverage`
- Primary package: `packages/cli`
- Suggested file focus:
  - `packages/cli/src/commands/proxy-command.ts`
  - `packages/cli/src/server/proxy-server.ts`
  - `packages/cli/tests/cli.integration.test.ts`
- Validation checklist:
  - deterministic behavior for upstream timeout, 5xx, invalid target, proxy unavailable
- Required tests:
  - integration scenarios for each failure path

3. N0-3b Web and proxy contract checks
- Branch: `test/n0-3b-web-proxy-contract`
- PR title: `[N0-3b] Add web-proxy contract checks and smoke script`
- Primary packages: `apps/web`, `packages/cli`
- Suggested file focus:
  - `apps/web/src/features/tryout/*`
  - `packages/cli/src/server/proxy-server.ts`
- Validation checklist:
  - documented request and error payload contract
  - smoke script passes against fixture endpoints
- Required tests:
  - contract checks plus smoke evidence in PR notes

## M9 Performance + Patch Readiness (Week 4)

1. N1-1 Large-spec rendering optimization
- Branch: `perf/n1-1-large-spec-rendering`
- PR title: `[N1-1] Optimize large-spec operation rendering`
- Primary package: `apps/web`
- Suggested file focus:
  - `apps/web/src/app/App.tsx`
  - `apps/web/src/features/schemas/SchemasView.tsx`
  - `apps/web/src/features/spec/spec-utils.ts`
- Validation checklist:
  - benchmark fixture first render p95 improved vs baseline
  - no regressions in navigation behavior
- Required tests:
  - benchmark report committed in PR description
  - updated tests for list/detail behavior

2. N1-2 Contributor clean-machine validation
- Branch: `docs/n1-2-clean-machine-validation`
- PR title: `[N1-2] Validate clean-machine onboarding and update docs`
- Primary files:
  - `README.md`
  - `CONTRIBUTING.md`
- Validation checklist:
  - setup succeeds from clean environment without hidden steps
  - docs capture all required prerequisites and commands
- Required tests:
  - onboarding run log attached in PR description

3. M9-RC Regression sweep and release prep
- Branch: `chore/m9-rc-regression-sweep`
- PR title: `[M9-RC] Complete regression sweep and release prep`
- Primary files:
  - `plan/20-delivery/release-checklist.md`
  - `plan/40-quality/quality-gates.md`
- Validation checklist:
  - no critical open defects
  - final release checklist is signoff-ready
- Required tests:
  - final run references for `npm run lint`, `npm run build`, and `npm run test`

## PR Template Requirements
1. Scope: list item ID and milestone (M7/M8/M9).
2. Risk: note user impact and rollback plan.
3. Validation: paste exact commands run and result summary.
4. Evidence: attach screenshots/log snippets for user-facing or reliability work.

## Definition-of-Done Gate
Every PR in this checklist must satisfy:
1. `plan/30-execution/definition-of-done.md`
2. `plan/40-quality/quality-gates.md`