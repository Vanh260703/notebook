# syntax=docker/dockerfile:1
# Build context là gốc repo: docker build -f apps/api/Dockerfile .
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Tải package vào store chỉ dựa trên lockfile (cache tốt khi chỉ đổi source).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

FROM deps AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "api..."
RUN pnpm --filter "api..." run build
# pnpm 12: deploy mặc định (không --legacy) dùng lockfile chung của workspace và chép
# @notebook/shared (đã build) vào /out/node_modules. --legacy vẫn chạy nhưng báo WARN và tự resolve lại.
RUN pnpm --filter api deploy --prod /out

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
