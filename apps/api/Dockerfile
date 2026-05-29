FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY apps/api ./apps/api
RUN npm ci && npm run -w @specora/core build && npm run -w @specora/api build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8788
ENV PROXY_ENABLED=false
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
EXPOSE 8788
CMD ["node", "apps/api/dist/index.js"]
