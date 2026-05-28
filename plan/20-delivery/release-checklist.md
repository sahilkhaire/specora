# Release Checklist (v0.1.x Patch Stream)

## Pre-Release
1. Confirm scope freeze for target patch release (v0.1.x).
2. Ensure all P0 backlog items complete.
3. Run lint/build/test for all packages.
4. Verify version numbers and changelog entries.

## QA
1. Validate URL/paste/upload flows.
2. Validate CLI commands:
- `specora validate`
- `specora serve`
- `specora export`
3. Verify error handling for invalid specs.
4. Confirm large fixture does not crash UI.

## Documentation
1. README includes setup and run commands.
2. CLI examples are copy-paste runnable.
3. Contribution guide present.
4. Issue and PR templates present.

## Release Artifacts
1. Tag release as `v0.1.x`.
2. Publish release notes.
3. Attach screenshots/demo gif.
4. Announce in selected OSS channels.

## Post-Release
1. Monitor issues for first 72 hours.
2. Triage bugs by severity.
3. Schedule v0.1.1 stabilization if needed.

## M9-RC Regression Sweep Evidence (v0.1.1)
1. Final command references:
   - `npm run lint`
   - `npm run build`
   - `npm run test`
   - `npm run smoke:proxy-contract`
2. Run status:
   - PASS (local validation run: 2026-05-28)
3. Release-readiness notes:
   - Workspace lifecycle regression gate is covered in web tests.
   - Try-out/proxy deterministic failure handling is covered in unit + integration + smoke checks.
   - No critical defects identified during local regression sweep.
