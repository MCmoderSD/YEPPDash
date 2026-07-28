# ---- Stage 1: Dependencies (for build, incl. devDependencies) ----
FROM node:26-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- Stage 2: Build ----
FROM node:26-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---- Stage 3: Production-only dependencies ----
FROM node:26-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# ---- Stage 4: Runtime image ----
FROM node:26-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NG_ALLOWED_HOSTS=www.yeppbot.com,yeppbot.com,dash.yeppbot.com

RUN addgroup -S angular && adduser -S angular -G angular

COPY --from=prod-deps --chown=angular:angular /app/node_modules ./node_modules
COPY --from=build --chown=angular:angular /app/dist/YEPPDash ./dist/YEPPDash
COPY --from=build --chown=angular:angular /app/package.json ./package.json

USER angular

EXPOSE 4000

CMD ["node", "dist/YEPPDash/server/server.mjs"]
