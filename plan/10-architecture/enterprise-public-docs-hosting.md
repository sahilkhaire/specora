# Enterprise public docs hosting

Enterprise instances choose where published API docs are served. The admin UI (`/admin` → Hosting) maps to `instance_settings` in the API.

## Hosting modes

| Mode | Example | Notes |
|------|---------|-------|
| Platform subdomain | `acme.docs.your-specora.example` | Default on first install; DNS wildcard to ingress |
| Customer subdomain | `api-docs.acme.com` CNAME → instance | Customer manages DNS |
| Custom domain | `developers.acme.com` | TLS cert on ingress (cert-manager or uploaded) |

## Nginx / ingress pattern

Route by `Host` header to the read-only docs surface (`VITE_APP_SURFACE=docs`):

```nginx
# Full app (authenticated)
server {
  listen 443 ssl;
  server_name specora.acme.internal;
  location / {
    proxy_pass http://web:80;
  }
}

# Published docs (read-only)
server {
  listen 443 ssl;
  server_name ~^(?<slug>[a-z0-9-]+)\.docs\.acme\.internal$;
  location / {
    proxy_pass http://web:80;
    proxy_set_header X-Specora-Docs-Slug $slug;
  }
}
```

The web app resolves the slug via `/public/docs/:slug` on the API and loads the published OpenAPI spec into the docs surface (no try-out, no workflows).

## Docker Compose

Use `docker-compose.yml` at the repo root:

- `api` — Hono API + SQLite (swap to Postgres in production)
- `web` — static SPA behind nginx

Set environment:

- `VITE_DEPLOYMENT_MODE=enterprise`
- `VITE_ENABLE_SAAS_AUTH=false`
- `SPECORA_ADMIN_PASSWORD` — bootstrap admin password

## SaaS contrast

SaaS uses `*.specora.doc` subdomains and optional custom domains managed in **Publish docs** (workspace settings). Enterprise uses the same `published_sites` model but hostnames are instance-scoped and configured in admin hosting settings.
