# Rollback — Advanced Project Control

## اصل

Migration این Feature **Additive / Forward-Only** است.

```bash
git checkout 13c6def
```

به‌تنهایی Rollback کامل Production **نیست** (پس از migrate).

## Rollback ترجیحی (پس از migrate)

1. بازگرداندن Image قبلی API
2. بازگرداندن Image قبلی Web
3. حفظ جدول‌ها/ستون‌های جدید بلااستفاده
4. **عدم** اجرای Migration Down
5. Health Check
6. Restore DB فقط در وضعیت اضطراری (تغییر مخرب داده)

## دستور

```bash
# Dry-run
./infrastructure/scripts/project-control/rollback.sh --staging --dry-run

# Staging واقعی
./infrastructure/scripts/project-control/rollback.sh --staging --execute

# Production (تأیید مضاعف)
./infrastructure/scripts/project-control/rollback.sh --production --execute

# Restore DB (خطرناک — فقط اضطراری)
./infrastructure/scripts/project-control/rollback.sh --production --execute --restore-db
```

State از آخرین `release.env` خوانده می‌شود:

- Staging: `/tmp/ppm-releases/project-control/<ts>/release.env`
- Production: `/opt/ppm/releases/project-control/<ts>/release.env`

## ممنوع در Rollback

- `docker compose down -v`
- حذف Volume
- Restore بدون تأیید
- چاپ Secret
