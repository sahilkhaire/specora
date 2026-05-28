# N1-1 Large-Spec Rendering Benchmark Report

## Goal
- Verify operation-list render-path responsiveness improvements for large specs.

## Benchmark setup
1. Command: `npm run bench:web-large-spec`
2. Script: `scripts/benchmark-large-spec-render.mjs`
3. Fixture profile:
   - generated OpenAPI spec with 1,500 paths and 3,000 operations
   - mixed methods, tags, and search patterns
4. Measurement:
   - p95 duration over 120 iterations
   - baseline emulates pre-optimization filter/select path
   - optimized path uses precomputed operation search index and stable operation keys

## Result (2026-05-28)
- Operation count: `3000`
- Baseline p95: `0.592 ms`
- Optimized p95: `0.230 ms`
- Improvement: `61.11%`

## Outcome
- N1-1 performance target met for operation-list first-pass computation path.
- Optimization maintained behavior while reducing repeated string lowering and key reconstruction during filtering and selection.
