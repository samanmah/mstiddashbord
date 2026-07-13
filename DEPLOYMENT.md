# راهنمای استقرار (Deployment)

این سند مراحل استقرار سامانه پایش پیشرفت پروژه‌های استراتژیک را روی یک سرور Ubuntu با Docker، Nginx و GitHub Actions شرح می‌دهد.

---

## ۱. آماده‌سازی سرور Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw

# فایروال پایه
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## ۲. نصب Docker و Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # پس از اجرا یک‌بار Logout/Login کنید
docker --version
docker compose version
```

## ۳. ایجاد کاربر استقرار (Deploy User)

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/ppm && sudo chown deploy:deploy /opt/ppm
```

## ۴. تنظیم SSH برای GitHub Actions

روی ماشین محلی یک کلید مخصوص استقرار بسازید و کلید عمومی را به سرور اضافه کنید:

```bash
ssh-keygen -t ed25519 -C "ppm-deploy" -f ~/.ssh/ppm_deploy
ssh-copy-id -i ~/.ssh/ppm_deploy.pub deploy@<SERVER_HOST>
```

محتوای کلید خصوصی (`~/.ssh/ppm_deploy`) در Secret به نام `SERVER_SSH_KEY` قرار می‌گیرد.

## ۵. دریافت پروژه روی سرور

```bash
su - deploy
cd /opt/ppm
git clone https://github.com/samanmah/mstiddashbord.git .
```

## ۶. تنظیم متغیرهای محیطی

```bash
cp .env.example .env
nano .env
```

مقادیر زیر را حتماً برای Production تنظیم کنید:

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
- `DATABASE_URL` (با نام سرویس `postgres` به‌جای `localhost`)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET` (هرکدام حداقل ۳۲ کاراکتر تصادفی)
- `COOKIE_SECURE=true`
- `APP_ORIGIN=https://<domain>` و `APP_DOMAIN=<domain>`
- `API_IMAGE` / `WEB_IMAGE` (تگ GHCR)
- کاربران Seed (`SEED_EDITOR_*`, `SEED_VIEWER_*`)

برای تولید Secret تصادفی:

```bash
openssl rand -hex 32
```

## ۷. تنظیم دامنه و Nginx

- رکورد `A` دامنه را به IP سرور اشاره دهید.
- پیکربندی Nginx در `infrastructure/nginx/` قرار دارد و به‌صورت Volume در کانتینر `nginx` سوار می‌شود.
- برای مسیرها: `/` به Next.js، `/api` به NestJS و `/api/docs` به Swagger پراکسی می‌شود.

## ۸. تنظیم SSL (Let's Encrypt)

روش پیشنهادی با certbot (standalone) پیش از بالا آوردن Nginx:

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d <domain>
sudo cp /etc/letsencrypt/live/<domain>/fullchain.pem infrastructure/nginx/certs/
sudo cp /etc/letsencrypt/live/<domain>/privkey.pem  infrastructure/nginx/certs/
sudo chown deploy:deploy infrastructure/nginx/certs/*.pem
```

سپس در `infrastructure/nginx/conf.d/default.conf` بخش `server` مربوط به پورت ۴۴۳ را از حالت کامنت خارج کرده و ریدایرکت HTTP→HTTPS را فعال کنید.

## ۹. اجرای Migration و Containerها

Migrationها به‌صورت خودکار در Entrypoint کانتینر API (`prisma migrate deploy`) اجرا می‌شوند. برای اولین راه‌اندازی، Seed را با متغیر زیر فعال کنید:

```bash
# فقط بار اول
RUN_SEED_ON_START=true docker compose -f compose.production.yml up -d
# سپس در .env مقدار را به false برگردانید.
```

اجرای عادی:

```bash
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps
```

## ۱۰. اتصال به GHCR

Imageها روی GitHub Container Registry منتشر می‌شوند. برای Pull دستی روی سرور:

```bash
echo <GHCR_TOKEN> | docker login ghcr.io -u <github-username> --password-stdin
```

در GitHub Actions از `GITHUB_TOKEN` داخلی برای Push/Pull استفاده می‌شود.

## ۱۱. GitHub Secrets مورد نیاز

این Secretها را در `Settings → Secrets and variables → Actions` تعریف کنید:

| Secret | توضیح |
|--------|-------|
| `SERVER_HOST` | آدرس/IP سرور |
| `SERVER_PORT` | پورت SSH (معمولاً ۲۲) |
| `SERVER_USER` | کاربر استقرار (`deploy`) |
| `SERVER_SSH_KEY` | کلید خصوصی SSH |
| `DEPLOY_PATH` | مسیر پروژه روی سرور (`/opt/ppm`) |
| `APP_DOMAIN` | دامنه برنامه |
| `DATABASE_URL` | رشته اتصال دیتابیس |
| `JWT_ACCESS_SECRET` | Secret توکن دسترسی |
| `JWT_REFRESH_SECRET` | Secret توکن Refresh |
| `COOKIE_SECRET` | Secret امضای Cookie |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | اعتبار دیتابیس |
| `SEED_EDITOR_USERNAME` / `SEED_EDITOR_PASSWORD` | کاربر ویرایشگر |
| `SEED_VIEWER_USERNAME` / `SEED_VIEWER_PASSWORD` | کاربر بیننده |

> Secretها هرگز در Log چاپ نمی‌شوند و Actionهای Third-party به نسخه مشخص Pin شده‌اند.

## ۱۲. GitHub Actions (CI/CD)

- **`.github/workflows/ci.yml`**: روی هر Push/PR اجرا می‌شود — Install، Lint، Typecheck، Unit Test، Integration Test (با سرویس PostgreSQL) و Build.
- **`.github/workflows/deploy-production.yml`**: روی Push به `main` یا `workflow_dispatch` — ابتدا CI، سپس Build و Push دو Image به GHCR (با تگ `latest` و `SHA`)، اتصال SSH به سرور، Pull، `up -d`، Health Check و Rollback خودکار در صورت شکست. با `concurrency` از اجرای هم‌زمان دو Deployment جلوگیری می‌شود.

## ۱۳. Backup

اسکریپت `infrastructure/backup/backup-postgres.sh`:

```bash
# اجرای دستی
BACKUP_DIR=/var/backups/ppm ./infrastructure/backup/backup-postgres.sh
```

تنظیم Cron برای پشتیبان‌گیری روزانه ساعت ۲ بامداد:

```bash
crontab -e
# افزودن خط زیر:
0 2 * * * cd /opt/ppm && BACKUP_DIR=/var/backups/ppm BACKUP_RETENTION_DAYS=14 ./infrastructure/backup/backup-postgres.sh >> /var/log/ppm-backup.log 2>&1
```

ویژگی‌ها: نام فایل شامل تاریخ/ساعت، فشرده‌سازی gzip، بررسی سلامت فایل، و حذف خودکار پشتیبان‌های قدیمی‌تر از `BACKUP_RETENTION_DAYS` (پیش‌فرض ۱۴ روز).

## ۱۴. Restore

```bash
./infrastructure/backup/restore-postgres.sh /var/backups/ppm/ppm_ppm_db_YYYY-MM-DD_HH-MM-SS.sql.gz
```

> هشدار: این عملیات داده‌های فعلی را بازنویسی می‌کند و نیاز به تأیید تعاملی (`yes`) دارد.

## ۱۵. Rollback

Workflow استقرار در صورت شکست Health Check به‌طور خودکار به Image قبلی برمی‌گردد. برای Rollback دستی:

```bash
export API_IMAGE=ghcr.io/samanmah/mstiddashbord-api:<previous-sha>
export WEB_IMAGE=ghcr.io/samanmah/mstiddashbord-web:<previous-sha>
docker compose -f compose.production.yml up -d
```

## ۱۶. مشاهده Log

```bash
docker compose -f compose.production.yml logs -f api
docker compose -f compose.production.yml logs -f web
docker compose -f compose.production.yml logs -f nginx
```

## ۱۷. Health Check

```bash
curl -fsS http://<domain>/api/v1/health
curl -fsS http://<domain>/api/v1/health/readiness   # شامل بررسی اتصال دیتابیس
curl -fsS http://<domain>/api/v1/health/liveness
```

## ۱۸. به‌روزرسانی نسخه

```bash
cd /opt/ppm
git pull
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
```

یا صرفاً با Push به `main` که به‌صورت خودکار توسط GitHub Actions مستقر می‌شود.
