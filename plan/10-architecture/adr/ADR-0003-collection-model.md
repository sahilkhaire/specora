# ADR-0003: Collection Tree and SavedRequest Model

## Status
Accepted

## Context
Specora needs Postman-like organization (folders, saved requests) while keeping OpenAPI as the primary source of truth.

## Decision

1. **Separate collection tree from OpenAPI document** — Users can reorder folders without mutating the spec.
2. **`SavedRequest` entities** — Persist params, headers, body, and auth per request. Linked OpenAPI operations use `operationKey`; custom and Postman imports use `source: "custom" | "postman"`.
3. **Spec sync** — On spec reload, upsert by `operationKey`; never delete `custom` or `postman` nodes. User may "Reset from spec" per request.
4. **Canonical Postman export** — Always Collection v2.1; import accepts v1, v2.0, v2.1 and environment JSON.
5. **Parsing** — `@specora/core` is the single parser for Swagger 2.0, OpenAPI 3.0.x, and 3.1.x.

## Consequences

- New stores: `CollectionStore`, `HistoryStore` per workspace.
- Workflows reference `savedRequestId` over duplicated JSON fields.
- UI uses resizable shell with collection sidebar as primary navigation.
