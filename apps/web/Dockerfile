# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Manifests first so dependency installs are cached independently of source edits.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/cli/package.json packages/cli/
COPY packages/core/package.json packages/core/
COPY packages/embed-core/package.json packages/embed-core/
COPY packages/import-postman/package.json packages/import-postman/
COPY packages/sdk-node/package.json packages/sdk-node/
RUN npm ci --workspace @specora/web --workspace @specora/core --workspace @specora/import-postman

COPY packages/core packages/core
COPY packages/import-postman packages/import-postman
COPY apps/web apps/web

# Vite inlines VITE_* at build time; runtime env vars have no effect on the bundle.
ARG VITE_DEPLOYMENT_MODE=enterprise
ARG VITE_APP_SURFACE=full
ARG VITE_API_BASE_URL=""
ARG VITE_ENABLE_SAAS_AUTH=false
ARG VITE_TRYOUT_USE_PROXY=false
ARG VITE_TRYOUT_PROXY_URL=""
ARG VITE_PLATFORM_DOCS_DOMAIN=""
ENV VITE_DEPLOYMENT_MODE=$VITE_DEPLOYMENT_MODE \
    VITE_APP_SURFACE=$VITE_APP_SURFACE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_ENABLE_SAAS_AUTH=$VITE_ENABLE_SAAS_AUTH \
    VITE_TRYOUT_USE_PROXY=$VITE_TRYOUT_USE_PROXY \
    VITE_TRYOUT_PROXY_URL=$VITE_TRYOUT_PROXY_URL \
    VITE_PLATFORM_DOCS_DOMAIN=$VITE_PLATFORM_DOCS_DOMAIN

RUN npm run -w @specora/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
