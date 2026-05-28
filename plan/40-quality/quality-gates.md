# Quality Gates

## Branch Gates (main)

1. Static quality
- Type checks pass for all workspaces.
- Lint checks pass for all workspaces.

2. Build quality
- Core, CLI, and web production builds succeed.

3. Test quality
- Core tests pass.
- CLI integration tests pass.
- Web test suite passes.

4. Documentation quality
- Critical command and usage docs updated for behavior changes.

## Release Gates (v0.1.x)

1. All main branch gates pass.
2. No open critical defects.
3. Release checklist complete.
4. Risk register reviewed and updated.

## Current Gate Evidence (v0.1.1 stabilization)
1. Static quality
- `npm run lint` passes locally (2026-05-28).
2. Build quality
- `npm run build` passes locally (2026-05-28).
3. Test quality
- `npm run test` passes locally (2026-05-28).
- `npm run smoke:proxy-contract` passes locally (2026-05-28).
4. Documentation quality
- Setup, onboarding, and proxy smoke steps updated in `README.md` and `CONTRIBUTING.md`.

## Enforcement
- CI is the source of truth for gate status.
- Gate exceptions require documented rationale and follow-up issue.
