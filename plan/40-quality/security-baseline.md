# Security Baseline

## Security Principles

1. Least privilege
- Do not introduce elevated runtime permissions without need.

2. Input safety
- Validate and sanitize untrusted inputs from URL, pasted text, and proxy payloads.

3. Error hygiene
- Avoid leaking internal stack details in user-facing messages.

4. Dependency hygiene
- Review dependency updates and monitor audit results regularly.

## Current Security Controls

1. Deterministic CLI error handling and exit codes.
2. Strict TypeScript typing across packages.
3. Controlled proxy endpoint contract for web try-out mode.
4. CI automation for lint/build/test quality gates.

## Security Review Checklist

1. Are new network paths authenticated/validated as needed?
2. Are request/response payloads handled safely?
3. Are sensitive values avoided in logs and error output?
4. Have dependency and audit impacts been reviewed?
