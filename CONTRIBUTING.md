# Contributing to Specora

## Development Setup
1. Install Node.js 20 or newer.
2. Install dependencies:

npm install

3. Validate local quality checks:

npm run lint
npm run build
npm run test

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
