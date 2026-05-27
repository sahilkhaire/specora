# Weekly Roadmap (6-8 Weeks)

## Week 1: Foundation and Contracts
Deliverables:
1. Finalize product contract and scope boundaries.
2. Bootstrap monorepo with web, core, and CLI packages.
3. Configure lint/build/test scripts.
4. Define coding standards and branch/review rules.

Exit Criteria:
1. `npm install` works.
2. `npm run build` runs across workspaces.
3. Architecture and scope docs accepted.

## Week 2: Core Parsing Engine
Deliverables:
1. JSON/YAML parsing and validation.
2. Structured parse/validation errors.
3. Summary extraction utility.
4. Fixture set for valid and invalid specs.

Exit Criteria:
1. Core package passes parser fixture checks.
2. Diagnostic output is stable and actionable.

## Week 3: Web Visualizer Base
Deliverables:
1. URL/paste/upload flows in UI.
2. Operation listing and summary metadata.
3. Operation detail rendering.
4. Search/filter baseline.

Exit Criteria:
1. Medium spec can be loaded and navigated without UI breakage.

## Week 4: Try-Out Flow
Deliverables:
1. Request builder (params/query/headers/body).
2. Auth baseline (bearer/basic/api-key).
3. Response inspector (status, headers, payload, timing).
4. Request history and replay baseline.

Exit Criteria:
1. At least 5 real endpoint invocations verified.

## Week 5: CLI Workflow Replacement
Deliverables:
1. Complete `validate`, `serve`, and `export` usability.
2. Better error output and machine-readable mode.
3. CI examples replacing script-based workflows.

Exit Criteria:
1. A sample CI pipeline uses CLI commands successfully.

## Week 6: Premium UX + Performance
Deliverables:
1. UI polish pass (layout consistency, typography scale, readability).
2. Resilient empty/loading/error states.
3. Performance optimization for larger specs.

Exit Criteria:
1. First meaningful render p95 target hit on benchmark fixture.

## Week 7: OSS Readiness
Deliverables:
1. Contributor documentation and templates.
2. Governance and maintenance notes.
3. Release checklist draft and demo assets.

Exit Criteria:
1. New contributor dry run succeeds using docs only.

## Week 8: RC + Launch
Deliverables:
1. Regression fixes and release candidate stabilization.
2. Changelog and release notes.
3. v0.1.0 tag and public announcement package.

Exit Criteria:
1. No critical defects open.
2. Release checklist signed off.
