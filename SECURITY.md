# امنیت (Security)

این سند سیاست‌ها و اقدامات امنیتی سامانه پایش پیشرفت پروژه‌های استراتژیک را شرح می‌دهد.

---

## ۱. مدیریت Secret

- تمام Secretها (JWT، Cookie، دیتابیس) از طریق **Environment Variable** تأمین می‌شوند و هرگز در مخزن Commit نمی‌شوند.
- فایل `.env` در `.gitignore` قرار دارد؛ فقط `.env.example` **بدون** مقدار محرمانه واقعی Commit شده است.
- در **Production**، اگر Secretهای پیش‌فرض ناامن (مقادیر نمونه) استفاده شوند، برنامه هنگام Startup متوقف شده و خطای واضح می‌دهد.
- Secretها در Log چاپ نمی‌شوند و در GitHub Actions به‌صورت Masked مدیریت می‌شوند.
- حداقل طول Secretها ۳۲ کاراکتر تصادفی است (`openssl rand -hex 32`).

## ۲. جریان احراز هویت (Auth Flow)

1. کاربر با نام کاربری و رمز از `/api/v1/auth/login` وارد می‌شود.
2. رمز با **Argon2id** تأیید می‌شود.
3. یک **Access Token** کوتاه‌عمر و یک **Refresh Token** چرخشی صادر می‌شود.
4. توکن‌ها در **Cookieهای HttpOnly** قرار می‌گیرند (نه در LocalStorage/SessionStorage).
5. تمدید نشست از طریق `/api/v1/auth/refresh` با **Rotation**: توکن قدیمی Revoke و توکن جدید صادر می‌شود.
6. `/api/v1/auth/logout` توکن Refresh را Revoke می‌کند.

فقط **Hash** توکن Refresh در دیتابیس ذخیره می‌شود؛ مقدار خام هرگز نگهداری نمی‌شود.

## ۳. سیاست Cookie

| ویژگی | مقدار |
|-------|-------|
| `HttpOnly` | همیشه فعال |
| `Secure` | در Production فعال (`COOKIE_SECURE=true`) |
| `SameSite` | مقدار مناسب (پیش‌فرض `lax`) |
| امضا | با `COOKIE_SECRET` |

برای درخواست‌های Mutation مبتنی بر Cookie، **CSRF Protection** اعمال می‌شود (توکن CSRF جداگانه).

## ۴. کنترل دسترسی (RBAC)

- کنترل دسترسی در **Backend** با Guard و Decorator انجام می‌شود؛ مخفی کردن دکمه در Frontend کافی نیست.
- تمام Endpointهای Mutation فقط برای `PROJECT_EDITOR` مجاز است.
- GETهای داشبورد برای هر دو نقش مجاز است.

## ۵. امنیت ورود

- **قفل حساب** پس از ۵ تلاش ناموفق به‌مدت ۱۵ دقیقه (قابل تنظیم).
- **Rate Limiting** روی Endpoint ورود و کل API.
- جلوگیری از **User Enumeration** با پیام خطای عمومی.

## ۶. اعتبارسنجی ورودی و خروجی

- اعتبارسنجی با `class-validator`/`class-transformer` در Backend و Zod در Frontend.
- جلوگیری از **Mass Assignment** با DTOهای صریح.
- جلوگیری از **SQL Injection** از طریق Prisma (Parameterized Queries).
- **Output Encoding** برای جلوگیری از XSS.

## ۷. آپلود فایل

- فقط `xlsx`/`xlsm` با بررسی MIME واقعی پذیرفته می‌شود.
- محدودیت حجم پیش‌فرض ۲۰ مگابایت.
- نام‌گذاری امن فایل (نام اصلی به‌عنوان مسیر ذخیره استفاده نمی‌شود) و جلوگیری از **Path Traversal**.
- Macroهای فایل XLSM اجرا نمی‌شوند.

## ۸. جلوگیری از Formula Injection

هنگام Export به Excel، سلول‌هایی که با `=`، `+`، `-` یا `@` آغاز می‌شوند خنثی‌سازی می‌شوند تا از **Spreadsheet Formula Injection** جلوگیری شود.

## ۹. هدرها و پیکربندی امنیتی

- **Helmet** روی API.
- **Security Headers** در Nginx (X-Frame-Options، X-Content-Type-Options، Referrer-Policy، در HTTPS: HSTS).
- **CORS** فقط برای Originهای تعریف‌شده.
- محدودیت حجم Request در Nginx (`client_max_body_size`).
- اجرای سرویس‌ها با کاربر **Non-root** در Docker.

## ۱۰. مشاهده‌پذیری و Audit

- **Structured Logging** با **Request ID**.
- **Audit Log** برای عملیات حساس (چه کسی، چه زمانی، چه تغییری) با مقادیر قبل/بعد.
- داده‌های حساس (رمز، توکن، Cookie) هرگز در Log ثبت نمی‌شوند و **Mask** می‌شوند.
- **مدیریت Exception سراسری** با ساختار خطای ثابت.

## ۱۱. Backup

- پشتیبان‌گیری خودکار PostgreSQL با `pg_dump`، فشرده‌سازی و Retention قابل تنظیم (پیش‌فرض ۱۴ روز).
- فایل‌های پشتیبان در `.gitignore` هستند و نباید Commit شوند.
- جزئیات در [DEPLOYMENT.md](./DEPLOYMENT.md).

## ۱۲. چرخش Secret (Rotation)

1. Secret جدید تولید کنید (`openssl rand -hex 32`).
2. مقدار را در `.env` سرور و GitHub Secrets به‌روز کنید.
3. سرویس API را ری‌استارت کنید (`docker compose -f compose.production.yml up -d api`).
4. با چرخش `JWT_*_SECRET`، نشست‌های فعال باطل شده و کاربران باید مجدداً وارد شوند.

## ۱۳. واکنش به رخداد (Incident Response)

1. **مهار**: سرویس آسیب‌دیده را ایزوله یا متوقف کنید.
2. **ابطال**: Secretها را بچرخانید و تمام Refresh Tokenها را Revoke کنید.
3. **بررسی**: از Audit Log و Logها برای تعیین دامنه نفوذ استفاده کنید.
4. **بازیابی**: در صورت نیاز از آخرین Backup سالم Restore کنید.
5. **پیشگیری**: علت ریشه‌ای را رفع و اقدامات را مستند کنید.

## ۱۴. گزارش آسیب‌پذیری

آسیب‌پذیری‌ها را به‌صورت خصوصی به تیم نگهداری گزارش دهید و از افشای عمومی پیش از رفع خودداری کنید. لطفاً شامل: توضیح، مراحل بازتولید، دامنه تأثیر و در صورت امکان PoC باشد.
