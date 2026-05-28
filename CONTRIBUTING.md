# Contributing to Specora

## Development Setup
1. Install Node.js 20 or newer.
2. Clone the repository and open the root directory.
3. Install dependencies:

```bash
npm install
```

4. Run local quality checks:

```bash
npm run lint
npm run build
npm run test
```

5. Optional reliability smoke checks for web try-out proxy contract:

```bash
npm run smoke:proxy-contract
```

## Clean-Machine Validation (N1-2)
Use this checklist when validating onboarding from a fresh environment:

1. Confirm prerequisites:
   - Node.js >= 20 (`node -v`)
   - npm available (`npm -v`)
2. Run install and baseline checks from repository root:
   - `npm install`
   - `npm run lint`
   - `npm run build`
   - `npm run test`
3. Verify the two primary local entrypoints:
   - Web: `npm run dev:web`
   - CLI: `npm run dev:cli`
4. Verify try-out proxy flow:
   - Start proxy with `npx specora proxy --port 8787` (or `npm run -w @specora/cli dev -- proxy --port 8787`)
   - In web try-out, enable local proxy mode and keep `http://localhost:8787/proxy`
5. Record any missing steps and update docs in the same PR.

## Project Structure
- apps/web: React + Vite user interface
- packages/core: OpenAPI parsing and summary logic
- packages/cli: command line workflows
- plan: roadmap and delivery documents

## Branch and PR Flow
1. Create a feature branch from main.
2. Keep PRs focused on one concern.
3. Include clear validation steps in PR description.
4. Ensure lint, build, and test pass before requesting review.

## Coding Standards
1. Use strict TypeScript and avoid any unless justified.
2. Preserve existing architecture boundaries.
3. Add tests when changing behavior in core logic.
4. Keep docs updated when commands or setup change.

## Commit Guidance
1. Use descriptive commit messages.
2. Mention affected package when possible.

## Issue Triage
Use labels for severity and type:
- severity:critical, severity:high, severity:medium, severity:low
- type:bug, type:feature, type:docs, type:chore

## Community Behavior
Be respectful, collaborative, and constructive in all project discussions.
