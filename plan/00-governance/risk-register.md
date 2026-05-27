# Risk Register

## Scoring Model
- Probability: Low, Medium, High
- Impact: Low, Medium, High
- Priority: derived from probability x impact

## Current Risks

1. Risk ID: R-001
- Title: Scope expansion beyond 8-week target
- Probability: High
- Impact: High
- Priority: Critical
- Mitigation: Enforce scope boundaries doc and require change-control note for new feature classes.
- Owner: Project lead

2. Risk ID: R-002
- Title: CORS and network restrictions block web try-out
- Probability: High
- Impact: Medium
- Priority: High
- Mitigation: Maintain CLI proxy command and test proxy flow contract.
- Owner: CLI maintainer

3. Risk ID: R-003
- Title: Large OpenAPI documents degrade UI responsiveness
- Probability: Medium
- Impact: High
- Priority: High
- Mitigation: Add performance benchmarks and optimization backlog for list virtualization and lazy detail rendering.
- Owner: Web maintainer

4. Risk ID: R-004
- Title: Single maintainer bottleneck
- Probability: High
- Impact: Medium
- Priority: High
- Mitigation: Keep contribution docs high quality; label good-first-issue; automate CI and quality gates.
- Owner: Project lead

5. Risk ID: R-005
- Title: Regression leakage without end-to-end coverage
- Probability: Medium
- Impact: High
- Priority: High
- Mitigation: Expand integration and component tests each milestone; release checklist gate for regression sweep.
- Owner: QA owner

## Review Cadence
- Review weekly during active development.
- Update probability/impact after each milestone.
