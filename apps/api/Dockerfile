# syntax=docker/dockerfile:1
# ==========================================================================
# Dockerfile چندمرحله‌ای برای NestJS API (مونوریپو pnpm)
# ساخت از ریشه مخزن اجرا می‌شود: docker build -f apps/api/Dockerfile .
# ==========================================================================

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
# libc6-compat برای موتورهای Prisma روی Alpine لازم است.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- مرحله ساخت ---
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter @ppm/contracts build
RUN pnpm --filter @ppm/api exec prisma generate
RUN pnpm --filter @ppm/api build

# استخراج نسخه Production با وابستگی‌های runtime
RUN pnpm --filter @ppm/api deploy --prod /app/deploy
# افزودن Prisma Client تولیدشده و CLI برای اجرای migrate در زمان استقرار
RUN cp -r /app/node_modules/.prisma /app/deploy/node_modules/.prisma \
    && cp -r /app/node_modules/prisma /app/deploy/node_modules/prisma

# --- مرحله اجرا ---
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/deploy ./
COPY --from=build /app/apps/api/prisma ./prisma
COPY --chmod=0755 infrastructure/scripts/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh

# اجرای سرویس با کاربر غیر root
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/liveness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["api-entrypoint.sh"]
CMD ["node", "dist/main.js"]
