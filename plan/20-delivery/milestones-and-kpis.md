# Milestones and KPIs

## Milestone Plan (6-8 Weeks)

1. M1 Foundation Complete (end of week 1)
- KPI: repository setup and baseline quality commands pass.

2. M2 Core Engine Stable (end of week 2)
- KPI: parser and validation tests green with representative fixtures.

3. M3 Web Navigation and Detail Stable (end of week 4)
- KPI: URL/paste/upload and operation browsing flows pass component tests.

4. M4 CLI Workflow Replacement Stable (end of week 5)
- KPI: validate/export/serve/proxy command integration tests green.

5. M5 Quality Hardening (end of week 6)
- KPI: no critical lint/build/test failures; release candidate checklist mostly complete.

6. M6 Release Candidate and Launch (week 7-8)
- KPI: v0.1.0 tagged with all quality gates passing.

## Post-v0.1.0 Next Plan (4 Weeks)

1. M7 Workspace Stability and Safety (week 1)
- KPI: workspace lifecycle flows (create/switch/delete/rename) pass tests with no high-severity open defects.

2. M8 Try-Out + Proxy Reliability (week 2-3)
- KPI: proxy integration tests and web try-out error-path coverage green for timeout/CORS/network failure cases.

3. M9 Performance + v0.1.1 Patch Readiness (week 4)
- KPI: large-spec render p95 improves against v0.1.0 baseline and patch checklist reaches signoff-ready state.

Reference Plan:
- See `plan/20-delivery/next-iteration-plan-4-weeks.md` for objectives, scope guardrails, and risk alignment.

## Product KPIs

1. Quality
- 0 critical test failures on main branch.
- 100% CI success on release branch prior to tag.

2. Delivery
- Milestone exit criteria met on schedule.
- Scope-change requests tracked with decision records.

3. Reliability
- CLI failure modes return deterministic exit codes.
- Web app shows graceful error states for invalid specs and failed requests.
