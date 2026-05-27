# Specora Planning System

This folder is organized for enterprise-grade planning, traceability, and delivery governance.

## Folder Layout

- 00-governance: product direction, scope, standards, governance, risks
- 10-architecture: architecture docs and architecture decision records
- 20-delivery: roadmap, release strategy, milestones, KPIs
- 30-execution: backlog and implementation readiness standards
- 40-quality: testing strategy, quality gates, security baseline

## Operating Model

1. Every feature begins with scope validation in 00-governance.
2. Architecture-impacting changes require an ADR in 10-architecture/adr.
3. Delivery commitments must be reflected in 20-delivery docs.
4. Execution status should map backlog items to Definition of Done.
5. No release proceeds unless all quality gates in 40-quality are green.

## Planning Standards

1. Single source of truth: do not duplicate requirements across files.
2. Atomic updates: update only relevant docs per change.
3. Traceability: reference milestone IDs, backlog IDs, and ADR IDs.
4. Measurable acceptance: use testable outcomes, not vague goals.
5. Change control: scope changes require risk and timeline impact note.
