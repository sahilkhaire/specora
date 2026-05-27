# Specora Product Charter

## Vision
Build the most practical and modern open-source OpenAPI documentation experience: faster than script-heavy workflows, clearer than default Swagger UI, and easy for both solo developers and teams.

## Problem Statement
Current script-based Swagger/OpenAPI workflows are fragmented:
- Parsing/validation is hidden in build scripts
- Docs experience feels outdated
- URL/paste/upload exploration often requires multiple tools
- Static docs export and CI usage are inconsistent

## Product Goals (6-8 Weeks)
1. Deliver a modern web visualizer for OpenAPI specs using URL, paste, and file upload inputs.
2. Deliver a script-replacement CLI with `validate`, `serve`, and `export` commands.
3. Share parsing/validation logic in a single core package.
4. Ship as pure open source with contributor-ready docs and governance.

## Non-Goals (Current Cycle)
- Real-time collaboration
- SSO/RBAC
- Hosted paid cloud platform
- Enterprise analytics dashboards
- Plugin marketplace

## Primary Users
1. Individual developers exploring API contracts.
2. Startup teams replacing ad-hoc Swagger scripts.
3. Platform teams evaluating open-source internal API docs tooling.

## Value Proposition
Specora combines premium documentation UX with developer workflow commands in one open-source stack.

## Success Metrics
1. Functional:
- 95% of valid OpenAPI 3.x sample fixtures parse successfully.
- CLI commands return deterministic exit codes in CI.
- Web app handles URL/paste/upload flows without crashes.

2. Quality:
- p95 first meaningful render below 2 seconds for 100KB spec.
- No critical bugs at v0.1.0 release.

3. OSS:
- Contributor onboarding completes in under 20 minutes via docs.
- Initial release assets and issue templates published.

## Release Target
- v0.1.0 within 6-8 weeks from kickoff.
