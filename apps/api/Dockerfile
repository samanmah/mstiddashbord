# ==========================================================================
# Dockerfile چندمرحله‌ای برای NestJS API (مونوریپو pnpm)
# ساخت از ریشه مخزن اجرا می‌شود: docker build -f apps/api/Dockerfile .
# نکته: از # syntax=docker/dockerfile:1 استفاده نمی‌کنیم تا Build به دانلود
# frontend از Docker Hub وابسته نباشد (مناسب محیط‌های محدود شبکه).
# ==========================================================================

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
# libc6-compat + openssl برای موتورهای Prisma روی Alpine لازم است.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- مرحله ساخت ---
FROM base AS build
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter @ppm/contracts build
RUN pnpm --filter @ppm/api exec prisma generate
RUN pnpm --filter @ppm/api build

# استخراج نسخه Production با وابستگی‌های runtime (pnpm 11: --legacy)
# Prisma Client از طریق allowBuilds/@prisma/client تولید می‌شود؛ کپی دستی .prisma ممنوع است.
RUN pnpm --filter @ppm/api deploy --prod --legacy /app/deploy \
    && test -d /app/deploy/node_modules/@prisma/client \
    && test -f /app/deploy/dist/main.js \
    && test -f /app/deploy/dist/seed/run-seed.js \
    && test -f /app/deploy/dist/modules/project-control/import/cli/import.cli.js

# Prisma CLI برای migrate deploy در Runtime (در dependencies است)
RUN test -f /app/deploy/node_modules/prisma/build/index.js

# --- مرحله اجرا ---
FROM base AS runtime
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="ppm-api" \
      org.opencontainers.image.description="Strategic Project Monitoring API" \
      org.opencontainers.image.source="https://github.com/samanmah/mstiddashbord" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${APP_VERSION}"

ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE
WORKDIR /app

COPY --from=build /app/deploy ./
COPY --from=build /app/apps/api/prisma ./prisma
COPY --chmod=0755 infrastructure/scripts/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh

# اجرای سرویس با کاربر غیر root
RUN mkdir -p /app/uploads /tmp/ppm-import && chown -R node:node /app /tmp/ppm-import
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/liveness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["api-entrypoint.sh"]
CMD ["node", "dist/main.js"]
