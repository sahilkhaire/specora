# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/cli/package.json packages/cli/
COPY packages/core/package.json packages/core/
COPY packages/embed-core/package.json packages/embed-core/
COPY packages/import-postman/package.json packages/import-postman/
COPY packages/sdk-node/package.json packages/sdk-node/

FROM manifests AS build
RUN npm ci --workspace @specora/api --workspace @specora/core
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/api apps/api
RUN npm run -w @specora/core build && npm run -w @specora/api build

FROM manifests AS runtime
ENV NODE_ENV=production \
    PORT=8788 \
    DATABASE_URL=file:/data/specora.db \
    PROXY_ENABLED=false
RUN npm ci --omit=dev --workspace @specora/api --workspace @specora/core && npm cache clean --force
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/apps/api/dist apps/api/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]
