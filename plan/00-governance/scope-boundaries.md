# Scope In / Scope Out

## In Scope (v0.1.0)
1. Spec ingestion
- URL input
- Raw JSON/YAML paste
- Local file upload

2. Core package
- Parse JSON and YAML
- Validate OpenAPI structures
- Return structured diagnostics
- Provide spec summary metadata

3. Web app
- Endpoint and operation list
- Operation details and examples
- Basic schema browsing
- Search/filter operations
- Friendly load/error/empty states

4. Try-out
- Compose request with params, query, headers, body
- Execute request and inspect response
- Optional local proxy mode for CORS constraints

5. CLI
- `specora validate <path>`
- `specora serve <path>`
- `specora export <path>`

6. OSS readiness
- Documentation
- Contribution guide
- License and governance baseline
- Release checklist and changelog entry

## Out Scope (v0.1.0)
1. Collaboration
- Multi-user editing
- Live commenting and annotations

2. Enterprise controls
- SSO and RBAC
- Audit trails

3. Advanced governance
- Breaking-change detection dashboards
- Policy packs and custom rulesets

4. Platform extras
- Plugin marketplace
- Usage analytics
- Hosted paid SaaS features

## Scope Change Policy
1. Any new feature request must map to one of:
- Stability fix
- Security fix
- Current in-scope item
2. Otherwise defer to post-v0.1.0 backlog.
