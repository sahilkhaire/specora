# Testing Strategy

## Test Layers
1. Unit Tests
- Core parser utilities
- Summary extraction logic
- CLI helpers with mocked file operations

2. Integration Tests
- CLI command invocation (`validate`, `serve`, `export`)
- End-to-end parsing from fixture files

3. UI Tests
- Load spec by URL/paste/upload
- Render summary and operations list
- Error state rendering

4. Manual Smoke Tests
- Large spec rendering behavior
- Exported preview openability
- Cross-browser basic checks

## Fixture Strategy
1. Valid fixtures
- Small OpenAPI 3.x
- Medium OpenAPI 3.x with tags and schemas

2. Invalid fixtures
- Missing version fields
- Broken JSON
- Broken YAML indentation

## Performance Checks
1. Measure parse+render timing for benchmark fixture.
2. Track operation list render time for larger path sets.
3. Record before/after for optimization changes.

## Release Gates
1. Critical path smoke tests all green.
2. No known high-severity regressions.
3. CLI return codes verified.
4. Documentation commands validated from clean clone.
