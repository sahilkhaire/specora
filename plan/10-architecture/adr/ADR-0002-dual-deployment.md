# ADR-0002: Dual deployment (SaaS, enterprise, embed)

## Status

Accepted

## Context

Specora must support:

- Hosted SaaS with optional accounts and guest localStorage
- Enterprise self-hosted with instance admin and custom doc hosting
- In-repo developer embed via thin Node/Python/Go SDKs loading UI from CDN

## Decision

1. **Storage port** in web (`AppDataStores`) with `local` and `remote` backends.
2. **`apps/api`** (Hono + SQLite/Postgres) for auth, workspaces, environments, workflows, publish sites, admin.
3. **`VITE_APP_SURFACE`**: `full` | `docs` | `embed` — controls visible features.
4. **`@specora/embed-core`** + **`@specora/node`** fetch `cdn.specora.doc/embed/latest`; registry packages change rarely.
5. **Enterprise** `docker-compose.yml` ships api + web; admin configures visibility and doc host.

## Consequences

- UI releases publish to CDN; SDK semver bumps only for integration API changes.
- Guest export schema enables signup migration (`POST /migrate-guest`).
