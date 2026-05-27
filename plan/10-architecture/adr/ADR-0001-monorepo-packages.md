# ADR-0001: Monorepo Package Strategy

## Status
Accepted

## Context
Specora contains three tightly related deliverables:
- Shared OpenAPI parsing core
- Command-line workflow tool
- Web documentation application

These modules must evolve together while preserving clear boundaries.

## Decision
Use a single npm workspace monorepo with:
- packages/core
- packages/cli
- apps/web

## Consequences

Positive:
1. Unified versioning and dependency updates.
2. Shared CI and quality checks.
3. Faster refactoring across package boundaries.

Negative:
1. Requires disciplined boundaries to avoid coupling.
2. Build and test pipelines must remain efficient as repository grows.

## Guardrails
1. Shared domain logic belongs in packages/core.
2. CLI and web app should avoid duplicating parsing logic.
3. Feature work must include cross-package impact review.
