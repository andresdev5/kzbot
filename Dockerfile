# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev


FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin nodejs \
 && mkdir -p /app/cache \
 && chown -R nodejs:nodejs /app

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package.json package-lock.json tsconfig.json ./
COPY --chown=nodejs:nodejs src ./src

USER nodejs

CMD ["npm", "start"]
