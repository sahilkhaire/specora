# MVP Backlog

## Priority P0
1. As a developer, I can load an OpenAPI spec from URL so that I can inspect APIs quickly.
Acceptance Criteria:
- URL fetch errors are visible and actionable.
- Valid response parses and renders summary.

2. As a developer, I can paste JSON/YAML spec text and parse it.
Acceptance Criteria:
- JSON and YAML both supported.
- Validation errors include a clear message.

3. As a developer, I can upload a local spec file.
Acceptance Criteria:
- `.json`, `.yaml`, `.yml` accepted.
- File load updates operation list.

4. As a developer, I can browse operations and summaries.
Acceptance Criteria:
- Method + path visible.
- Summary shown when available.

5. As a developer, I can validate specs in CI via CLI.
Acceptance Criteria:
- Non-zero exit on invalid spec.
- Human-readable summary on success.

## Priority P1
1. As a developer, I can export a static HTML preview from CLI.
Acceptance Criteria:
- Output path option works.
- Output file opens in browser.

2. As a developer, I can serve a local preview.
Acceptance Criteria:
- Port option works.
- Preview shows summary and raw spec.

3. As a developer, I can search/filter operations in web UI.
Acceptance Criteria:
- Search by method/path/summary text.
- Empty state shown for no matches.

## Priority P2
1. As a developer, I can run basic try-out requests from web app.
Acceptance Criteria:
- Request body and headers configurable.
- Response status and payload visible.

2. As a maintainer, I can onboard contributors through docs.
Acceptance Criteria:
- Setup guide verified by new environment run.
