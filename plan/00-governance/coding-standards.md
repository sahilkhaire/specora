# Coding Standards and Engineering Policies

## Purpose
Define enforceable implementation standards for Specora across web, core, and CLI packages.

## Baseline Standards

1. Language and typing
- TypeScript strict mode is mandatory.
- Avoid using any unless justified in code review.
- Prefer explicit interfaces for public module boundaries.

2. Architecture boundaries
- Keep parsing and shared logic in packages/core.
- CLI concerns stay in packages/cli.
- UI concerns stay in apps/web.
- Cross-package imports must follow workspace boundaries.

3. Error handling
- Return actionable errors with hints when possible.
- Avoid swallowing exceptions.
- CLI commands must emit deterministic non-zero exit codes on failure.

4. Testing
- Behavior changes require test updates.
- Core logic requires unit tests.
- CLI command contracts require integration tests.
- UI interactions require component and utility tests for critical paths.

5. Performance and UX
- Avoid unnecessary re-renders and heavy synchronous parsing in UI.
- Keep default UX responsive for medium-sized specs.
- Add loading/error/empty states for user-facing flows.

6. Documentation
- Update README when commands or setup steps change.
- Update planning docs when milestones or scope change.

## Pull Request Requirements

1. Must pass:
- npm run lint
- npm run build
- npm run test

2. Must include:
- Summary of behavior changes
- Validation steps
- Scope impact statement

3. Must not include:
- Unrelated refactors mixed with feature work
- Hidden breaking changes without migration notes
