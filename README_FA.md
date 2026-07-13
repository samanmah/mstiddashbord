# سامانه پایش پیشرفت پروژه‌های استراتژیک

سامانه‌ای تحت وب، فارسی و RTL برای پایش و مدیریت پیشرفت پروژه‌های استراتژیک. اطلاعات منشور و پیشرفت پروژه از فایل Excel وارد، در PostgreSQL ذخیره، در یک داشبورد مدیریتی جذاب نمایش و از طریق پنل مدیریت قابل ویرایش می‌شود.

> نسخه انگلیسی مستندات: [README.md](./README.md)

---

## فهرست

- [قابلیت‌ها](#قابلیتها)
- [معماری](#معماری)
- [ساختار پوشه‌ها](#ساختار-پوشهها)
- [پیش‌نیازها](#پیشنیازها)
- [نصب و اجرای Local](#نصب-و-اجرای-local)
- [متغیرهای محیطی](#متغیرهای-محیطی)
- [Migration و Seed](#migration-و-seed)
- [ورود اولیه](#ورود-اولیه)
- [Import فایل Excel](#import-فایل-excel)
- [اجرای تست‌ها](#اجرای-تستها)
- [اجرا با Docker](#اجرا-با-docker)
- [Backup و Restore](#backup-و-restore)
- [ساخت کاربر](#ساخت-کاربر)
- [خطاهای متداول](#خطاهای-متداول)

---

## قابلیت‌ها

- **دو سطح دسترسی**: `MANAGER_VIEWER` (فقط‌خواندنی) و `PROJECT_EDITOR` (ویرایشگر کامل).
- **احراز هویت امن**: JWT با Refresh Token چرخشی، Argon2id، قفل حساب پس از تلاش‌های ناموفق، Cookieهای HttpOnly/Secure/SameSite، محافظت CSRF.
- **داشبورد مدیریتی**: کارت‌های اطلاعات پروژه، وضعیت کلی (Donut/Gauge)، شاخص اثربخشی، جدول فعالیت‌ها، روند ماهانه (Line Chart)، ریسک‌ها، تصمیمات، نمودار مقایسه‌ای میله‌ای و Timeline اجرای فعالیت‌ها.
- **حالت مانیتور مدیریتی (Wallboard)**: تمام‌صفحه با Auto Refresh هر ۶۰ ثانیه.
- **پنل مدیریت کامل**: ویرایش اطلاعات پروژه، شاخص‌ها، پیشرفت ماهانه (با Paste از Excel و Bulk Save)، فعالیت‌ها (با اعتبارسنجی وزن و مرتب‌سازی)، ریسک‌ها، تصمیمات، مدیریت کاربران و Audit Log.
- **Import اکسل**: پیش‌نمایش، اعتبارسنجی، محاسبه SHA-256، و Import اتمیک در یک Transaction.
- **Export اکسل**: پنج شیت فارسی با محافظت در برابر Formula Injection.
- **محاسبات مستقل در Backend**: تمام محاسبات پیشرفت، تحقق و وضعیت در `DashboardCalculationService` انجام می‌شود (نه در فرمول‌های Excel و نه در Frontend).
- **تاریخ جلالی**: نمایش، Date Picker و اعتبارسنجی کامل تقویم جلالی؛ ذخیره به‌صورت Date استاندارد در PostgreSQL با Timezone `Asia/Tehran`.
- **Optimistic Concurrency**: جلوگیری از بازنویسی تغییرات با `version` و پاسخ HTTP 409.
- **Print/PDF**: Stylesheet چاپ حرفه‌ای برای داشبورد.
- **امنیت و مشاهده‌پذیری**: Helmet، Rate Limiting، Structured Logging، Request ID، Audit Log و Health Check واقعی.

---

## معماری

```
Browser
   │
   ▼
 Nginx  (Reverse Proxy + TLS + Security Headers)
   ├── /        → Next.js Web  (App Router, RTL)
   └── /api     → NestJS API
                    ├── Prisma ORM
                    └── PostgreSQL 18
        /api/docs → Swagger / OpenAPI
```

جزئیات بیشتر در [docs/architecture.md](./docs/architecture.md).

**پشته فناوری**

| لایه | فناوری |
|------|--------|
| Frontend | Next.js (App Router)، TypeScript strict، Tailwind CSS، React Hook Form، Zod، TanStack Query، TanStack Table، Recharts |
| Backend | NestJS، Prisma، PostgreSQL 18، JWT، Argon2id، Helmet، Swagger |
| Runtime | Node.js 24 LTS، pnpm |
| Deploy | Docker، Docker Compose، Nginx، GitHub Actions، GHCR |

---

## ساختار پوشه‌ها

```
project-monitoring-platform/
├── apps/
│   ├── web/          # Next.js (Frontend)
│   └── api/          # NestJS (Backend)
├── packages/
│   ├── contracts/    # Enum، Zod Schema، DTO، ابزار تاریخ/عدد مشترک
│   ├── eslint-config/
│   └── tsconfig/
├── references/       # فایل Excel و تصویر مرجع
├── docs/             # source-analysis، architecture، data-mapping
├── infrastructure/
│   ├── nginx/        # nginx.conf و conf.d
│   ├── scripts/      # api-entrypoint.sh
│   └── backup/       # backup/restore PostgreSQL
├── .github/workflows/  # ci.yml و deploy-production.yml
├── compose.yml
├── compose.production.yml
└── .env.example
```

---

## پیش‌نیازها

- **Node.js 24 LTS** (نسخه در `.nvmrc` ثبت شده است)
- **pnpm** (از طریق Corepack: `corepack enable`)
- **PostgreSQL 18** (به‌صورت محلی یا با Docker)
- (اختیاری) **Docker** و **Docker Compose** برای اجرای کامل

---

## نصب و اجرای Local

```bash
# ۱) فعال‌سازی pnpm
corepack enable

# ۲) نصب وابستگی‌ها
pnpm install --frozen-lockfile

# ۳) ساخت فایل محیطی
cp .env.example .env
#   سپس مقادیر DATABASE_URL و Secretها را در .env تنظیم کنید.

# ۴) بالا آوردن دیتابیس (اگر Docker دارید)
docker compose up -d postgres

# ۵) ساخت بسته contracts و تولید Prisma Client
pnpm --filter=@ppm/contracts build
pnpm db:generate

# ۶) اجرای Migration و Seed
pnpm db:deploy
pnpm db:seed

# ۷) اجرای همزمان API و Web در حالت توسعه
pnpm dev
```

- Frontend: <http://localhost:3000>
- API: <http://localhost:4000/api/v1>
- Swagger: <http://localhost:4000/api/docs>

---

## متغیرهای محیطی

نمونه کامل در [`.env.example`](./.env.example). مهم‌ترین‌ها:

| متغیر | توضیح |
|-------|-------|
| `DATABASE_URL` | رشته اتصال PostgreSQL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secret توکن‌ها (حداقل ۳۲ کاراکتر) |
| `COOKIE_SECRET` | Secret امضای Cookie |
| `COOKIE_SECURE` | در Production حتماً `true` |
| `CORS_ORIGINS` | Originهای مجاز (با کاما) |
| `SEED_EDITOR_USERNAME` / `SEED_EDITOR_PASSWORD` | کاربر ویرایشگر اولیه |
| `SEED_VIEWER_USERNAME` / `SEED_VIEWER_PASSWORD` | کاربر بیننده اولیه |
| `UPLOAD_DIR` / `UPLOAD_MAX_BYTES` | مسیر و حجم مجاز آپلود |
| `NEXT_PUBLIC_API_BASE_URL` | آدرس API از دید مرورگر |

> در Production اگر Secretهای پیش‌فرض ناامن استفاده شوند، برنامه هنگام Startup متوقف می‌شود و خطای واضح می‌دهد.

---

## Migration و Seed

```bash
# ساخت Migration جدید در توسعه
pnpm db:migrate

# اعمال Migrationها در Production
pnpm db:deploy

# اجرای Seed (یک پروژه نمونه + دو کاربر)
pnpm db:seed
```

داده Seed شامل پروژه «تاسیس پارک تخصصی فناوری و نوآوری فولاد مبارکه (فاز اول)» با ۱۴ دوره ماهانه، ۵ فعالیت، ۲ ریسک و ۳ تصمیم است. نتایج محاسباتی مورد انتظار: برنامه کل ۳۵٪، واقعی کل ۳۵٪، تحقق برنامه ۱۰۰٪، تحقق شاخص ۰٪.

---

## ورود اولیه

پس از Seed، با کاربرانی که در `.env` تعریف کرده‌اید وارد شوید:

- **ویرایشگر**: مقدار `SEED_EDITOR_USERNAME` / `SEED_EDITOR_PASSWORD`
- **بیننده**: مقدار `SEED_VIEWER_USERNAME` / `SEED_VIEWER_PASSWORD`

صفحه ورود: <http://localhost:3000/login>

---

## Import فایل Excel

۱. به‌عنوان `PROJECT_EDITOR` وارد شوید. ۲. به `/admin/import` بروید. ۳. فایل `xlsx`/`xlsm` را Drag & Drop کنید. ۴. پیش‌نمایش (تعداد پروژه، ماه‌ها، فعالیت‌ها، ریسک‌ها، تصمیمات و خطاها) را بررسی کنید. ۵. تأیید نهایی؛ Import در یک Transaction اتمیک انجام می‌شود.

Macroهای فایل XLSM اجرا نمی‌شوند؛ فقط مقادیر سلول‌ها و مقادیر Cache شده فرمول‌ها خوانده می‌شوند. جزئیات Mapping در [docs/data-mapping.md](./docs/data-mapping.md).

---

## اجرای تست‌ها

```bash
pnpm lint            # بررسی ESLint
pnpm typecheck       # بررسی نوع‌ها
pnpm test            # تست‌های واحد (API + Web)
pnpm --filter=@ppm/api test:integration   # تست‌های یکپارچه با PostgreSQL
pnpm build           # Build کامل
pnpm test:e2e        # تست‌های Playwright (نیازمند اجرای Stack)
```

قبل از اجرای E2E، Stack را با `docker compose up -d` یا `pnpm dev` بالا بیاورید و در صورت نیاز `pnpm --filter=@ppm/web test:e2e:install` را برای نصب مرورگرها اجرا کنید.

---

## اجرا با Docker

**توسعه:**

```bash
cp .env.example .env
docker compose up -d --build
# Web: http://localhost:3000  |  API: http://localhost:4000/api/v1
```

**Production (پشت Nginx):**

```bash
docker compose -f compose.production.yml up -d
# دسترسی از طریق http://<domain>  و  http://<domain>/api
```

راهنمای کامل استقرار روی سرور در [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Backup و Restore

```bash
# پشتیبان‌گیری (نام فایل شامل تاریخ/ساعت، فشرده و با Retention قابل تنظیم)
./infrastructure/backup/backup-postgres.sh

# بازیابی از فایل پشتیبان
./infrastructure/backup/restore-postgres.sh /var/backups/ppm/ppm_ppm_db_YYYY-MM-DD_HH-MM-SS.sql.gz
```

تنظیم Cron و جزئیات در [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## ساخت کاربر

کاربر جدید از طریق پنل `/admin/users` توسط `PROJECT_EDITOR` ساخته می‌شود. رمز باید حداقل ۱۲ کاراکتر با حرف بزرگ، حرف کوچک، عدد و علامت ویژه باشد. آخرین `PROJECT_EDITOR` فعال قابل حذف یا غیرفعال‌سازی نیست.

---

## خطاهای متداول

| نشانه | علت / راه‌حل |
|-------|--------------|
| برنامه در Production بالا نمی‌آید | Secret پیش‌فرض ناامن استفاده شده؛ مقادیر `JWT_*_SECRET` و `COOKIE_SECRET` را تنظیم کنید. |
| خطای اتصال دیتابیس | `DATABASE_URL` را بررسی و از سلامت کانتینر `postgres` مطمئن شوید (`docker compose ps`). |
| ورود ناموفق مکرر و قفل حساب | پس از ۵ تلاش ناموفق، حساب ۱۵ دقیقه قفل می‌شود. |
| رد شدن فایل Import | فقط `xlsx`/`xlsm` تا سقف ۲۰ مگابایت پذیرفته می‌شود؛ فایل نباید خراب یا با MIME جعلی باشد. |
| نمایش `—` به‌جای مقدار | این علامت جایگزین مقادیر خالی است (مثلاً کد پروژه) و طبیعی است. |
