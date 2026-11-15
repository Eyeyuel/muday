FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY apps/backend apps/backend
COPY packages/contracts packages/contracts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/muday_build \
    npm run db:generate && \
    npm run build --workspace @mezgeb/contracts && \
    npm run build --workspace @mezgeb/backend

FROM node:24-alpine AS runtime
RUN apk add --no-cache ffmpeg tini && \
    addgroup -S -g 101 muday && \
    adduser -S -D -H -u 100 -G muday muday
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=muday:muday /app/package.json /app/package-lock.json ./
COPY --from=build --chown=muday:muday /app/node_modules node_modules
COPY --from=build --chown=muday:muday /app/apps/backend/package.json apps/backend/package.json
COPY --from=build --chown=muday:muday /app/apps/backend/prisma.config.ts apps/backend/prisma.config.ts
COPY --from=build --chown=muday:muday /app/apps/backend/dist apps/backend/dist
COPY --from=build --chown=muday:muday /app/apps/backend/prisma apps/backend/prisma
COPY --from=build --chown=muday:muday /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build --chown=muday:muday /app/packages/contracts/dist packages/contracts/dist
RUN install -d -o muday -g muday /app/.local/tmp/voice /app/.local/tmp/receipt
USER muday
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/backend/dist/main-api.js"]
