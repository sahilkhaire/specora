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
