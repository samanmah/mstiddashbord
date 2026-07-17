# ==========================================================================
# Dockerfile چندمرحله‌ای برای Next.js Web (خروجی standalone)
# ساخت از ریشه مخزن اجرا می‌شود: docker build -f apps/web/Dockerfile .
# نکته: از # syntax=docker/dockerfile:1 استفاده نمی‌کنیم تا Build به دانلود
# frontend از Docker Hub وابسته نباشد (مناسب محیط‌های محدود شبکه).
# ==========================================================================

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- مرحله ساخت ---
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG APP_VERSION=1.0.0
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter @ppm/contracts build
RUN pnpm --filter @ppm/web build

# --- مرحله اجرا ---
FROM base AS runtime
ARG APP_VERSION=1.0.0
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="ppm-web" \
      org.opencontainers.image.description="Strategic Project Monitoring Web" \
      org.opencontainers.image.source="https://github.com/samanmah/mstiddashbord" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${APP_VERSION}"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE
WORKDIR /app

# خروجی standalone شامل server.js و node_modules حداقلی است.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
