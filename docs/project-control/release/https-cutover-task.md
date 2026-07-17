# Task جدا — HTTPS Cutover (پورت 1012)

> این Task بخشی از Hotfix Release Pipeline نیست. تا تکمیل آن، Runtime فعلی سرور
> (`HTTP:1011`, `NODE_ENV=development`, `COOKIE_SECURE=false`) باید حفظ شود.

## هدف

فعال‌سازی TLS بدون Down کردن سامانهٔ فعلی روی پورت 1011.

## وضعیت فعلی (حفظ شود تا Cutover)

| مورد | مقدار |
|------|--------|
| Public URL | `http://…:1011` |
| `NODE_ENV` | `development` |
| `COOKIE_SECURE` | `false` |
| Compose overlays | `/opt/ppm/compose.server.yml` + `/opt/ppm/compose.runtime-production.yml` |

## هدف پس از Cutover

| مورد | مقدار |
|------|--------|
| TLS port | `1012` |
| `APP_ORIGIN` | `https://…` |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |

## گام‌ها

1. صدور/نصب Certificate روی `/opt/ppm/infrastructure/nginx/certs`
2. افزودن `listen 1012 ssl` در conf.d بدون قطع listener 1011
3. به‌روزرسانی `compose.runtime-production.yml` روی سرور (نه Override ناقص از CI)
4. تنظیم `APP_ORIGIN=https://…` و `COOKIE_SECURE=true`
5. Smoke روی 1012 + تأیید Cookie Secure
6. سپس قطع تدریجی 1011

## ممنوع در Pipeline فعلی

- تغییر ناگهانی `COOKIE_SECURE=true` وقتی فقط HTTP در دسترس است
- Deploy فقط با `compose.production.yml` بدون overlays سرور
