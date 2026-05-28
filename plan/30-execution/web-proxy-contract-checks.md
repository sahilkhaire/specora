# Web ↔ Proxy Contract Checks (N0-3b)

## Scope
- Item ID: N0-3b
- Milestone: M8 (Try-Out + Proxy Reliability)
- Packages: `apps/web`, `packages/cli`
- Purpose: define and verify a stable request/response contract between web try-out and local proxy mode.

## Request Contract (Web → Proxy)

### Endpoint
- `POST /proxy`

### Headers
- `content-type: application/json`

### JSON body
```json
{
  "url": "https://api.example.com/pets?limit=10",
  "method": "GET",
  "headers": {
    "accept": "application/json"
  },
  "body": "{\"name\":\"Fluffy\"}"
}
```

### Field requirements
1. `url`: required, absolute URL string.
2. `method`: optional, defaults to `GET` when omitted or invalid.
3. `headers`: optional object; forwarded as upstream request headers.
4. `body`: optional string; ignored for `GET` and `HEAD`.

## Response Contract (Proxy → Web)

### Success envelope
Proxy returns HTTP `200` for upstream success (`2xx`) and includes:

```json
{
  "ok": true,
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": "{\"data\":[]}"
}
```

### Upstream non-2xx envelope
Proxy returns HTTP `502` for upstream non-2xx and includes upstream status:

```json
{
  "ok": false,
  "status": 500,
  "headers": {
    "content-type": "text/plain"
  },
  "body": "upstream failure",
  "error": "Target returned HTTP 500"
}
```

### Deterministic input/network failures
1. Invalid URL (`url` not parseable): HTTP `400`, `{"ok": false, "error": "Invalid target URL."}`
2. Upstream timeout: HTTP `504`, `{"ok": false, "error": "Target request timed out."}`
3. Upstream network/connectivity failure: HTTP `502`, `{"ok": false, "error": "Target request failed."}`
4. Missing `url`: HTTP `400`, `{"ok": false, "error": "Field 'url' is required."}`

## Smoke Script
- Script: `scripts/smoke-proxy-contract.mjs`
- Command: `npm run smoke:proxy-contract`
- Verifies:
  1. success path (`200` envelope)
  2. upstream `5xx` path (`502` deterministic envelope)
  3. invalid URL path (`400` deterministic envelope)

## Traceability
- Web caller: `apps/web/src/app/App.tsx` (try-out proxy path)
- Proxy implementation: `packages/cli/src/server/proxy-server.ts`
- Integration checks: `packages/cli/tests/proxy.integration.test.ts`
