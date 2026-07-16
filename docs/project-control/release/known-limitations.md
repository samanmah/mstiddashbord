# Known Limitations — Release Candidate

1. **E2E کامل ۳۰ سناریو روی CI بدون Staging زنده اجرا نمی‌شود.** اسپک‌ها و اسکریپت‌ها آماده‌اند؛ اجرای واقعی نیازمند `deploy-staging.sh --execute` است.
2. **MPP Import** به Java/MPXJ روی Image وابسته است. در نبود Java، Excel مستقل ادامه می‌یابد؛ UI Crash نمی‌کند.
3. **Gantt Editor Drag/Save** در E2E فعلی به‌صورت UI Zoom/وجود کنترل پوشش داده شده؛ سناریوهای پیچیده Draft نیاز به داده Fixture Commit‌شده دارند.
4. **`projects.activeControlPlanId` بدون FK دیتابیسی** است (جلوگیری از وابستگی دایره‌ای). یکپارچگی در Service لایه کنترل می‌شود.
5. **Docker Build نیازمند دسترسی DNS به Docker Hub / GHCR است.** در محیط Agent فعلی (`lookup auth.docker.io: no such host`) Build Image و Staging Deploy اجرا نشد؛ باید روی ماشین CI/Staging با شبکه سالم انجام شود.
6. **GitHub Actions `deploy-production.yml` هنوز Rollback Web Image را کامل نمی‌کند** (فقط API در workflow فعلی). اسکریپت `rollback.sh` هر دو Image را پوشش می‌دهد — برای Production از اسکریپت استفاده کنید.
7. **Screenshotها Commit نمی‌شوند** (`artifacts/*` در gitignore)؛ فقط به‌صورت Artifact محلی/CI نگهداری شوند.
8. **Seed شکست** دیگر با پیام گمراه‌کننده مخفی نمی‌شود؛ اگر `RUN_SEED_ON_START=true` و Seed fail شود، API start نمی‌شود (عمدی).
