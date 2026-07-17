# Known Limitations — Release Candidate

1. **E2E روی GitHub Runner اجرا می‌شود** (SSH Tunnel به Staging). وابستگی به `npm/pnpm` روی Server حذف شده است. نتیجهٔ مورد انتظار: ۱۹/۱۹.
2. **MPP Import** نیازمند Java Runtime + MPXJ Helper Jar داخل API Image است (`MPXJ_HELPER_JAR=/app/mpp/mpxj-helper.jar`). Badge «MPP آماده است» فقط وقتی `javaAvailable && mpxjAvailable` نشان داده می‌شود. فایل MPP واقعی در Repository Commit نمی‌شود.
3. **Excel واقعی پروژه** (`ساختار شکست کار...xlsx`) در Repository عمومی Commit نمی‌شود. پس از Deploy از UI امن Production Upload می‌شود. Workflow کد از Workflow ورود داده جداست. از `import-audit-report.mjs` برای Audit پس از Commit استفاده کنید.
4. **Gantt Editor Drag/Save** در E2E فعلی به‌صورت UI Zoom/وجود کنترل پوشش داده شده؛ سناریوهای پیچیده Draft نیاز به داده Fixture Commit‌شده دارند.
5. **`projects.activeControlPlanId` بدون FK دیتابیسی** است (جلوگیری از وابستگی دایره‌ای). یکپارچگی در Service لایه کنترل می‌شود.
6. **تنها مسیر Deploy:** `.github/workflows/release.yml` (Build روی GHA linux/amd64 → GHCR → Pull روی Server). `deploy-production.yml` منسوخ است. Build/Save/SCP روی Mac ممنوع است.
7. **Rollback** از طریق `rollback.sh` هم‌زمان API + Web + Env + Compose قبلی را برمی‌گرداند. `docker image prune -f` بلافاصله بعد از Deploy ممنوع است؛ Backup حذف نمی‌شود.
8. **HTTPS Cutover** Task جدا است: `docs/project-control/release/https-cutover-task.md`. تا آماده‌شدن TLS، Runtime فعلی (`HTTP:1011`, `COOKIE_SECURE=false`) حفظ می‌شود.
9. **Screenshotها Commit نمی‌شوند** (`artifacts/*` در gitignore)؛ فقط به‌صورت Artifact محلی/CI نگهداری شوند.
10. **Seed شکست** دیگر با پیام گمراه‌کننده مخفی نمی‌شود؛ اگر `RUN_SEED_ON_START=true` و Seed fail شود، API start نمی‌شود (عمدی).
