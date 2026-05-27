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

## Release Gates (v0.1.0)

1. All main branch gates pass.
2. No open critical defects.
3. Release checklist complete.
4. Risk register reviewed and updated.

## Enforcement
- CI is the source of truth for gate status.
- Gate exceptions require documented rationale and follow-up issue.
