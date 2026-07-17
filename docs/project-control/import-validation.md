# اعتبارسنجی Import — Import Validation

Import چندمرحله‌ای، Transactional و Atomic است. Commit فقط پس از رفع خطاهای بحرانی
فعال می‌شود. هر Import یک `ImportBatch` + رکوردهای `ImportSourceRecord` ثبت می‌کند.

## 1. مراحل
Upload → Hash/Antivirus → Parse → Structure → Match(Excel⟷MPP) → Conflict →
Parent Mapping → Field Mapping → Data Quality → Preview → Dry-Run → Commit(TX) → Report.

## 2. Manifest Assert (Excel) — خطای بحرانی در صورت عدم تطابق
| Assert | مقدار انتظار |
|---|---|
| Sheets | `گانت`, `شکست 1 و 2`, `Sheet1`(ignore) |
| فاز | 7 |
| Break1 | 24 |
| ردیف فعالیت | 142 |
| Node بدون Root | 173 |
| فعالیت هر فاز | 13,18,12,13,65,10,11 |
| دوره | 147 |
| روز / ماه | 620 / 21 |
| ردیف بودجه / جمع | 5 / 929,875,000,000 تومان |
| مسئول / DOD / پیشرفت | 65 / 48 / 104 |
| شروع غیرخالی/معتبر | 65 / 60 |
| پایان غیرخالی/معتبر | 65 / 60 |
| بازهٔ تاریخ | 1404/09/01 .. 1406/12/10 |

## 3. سطوح خطا
- **CRITICAL** (مانع Commit): Manifest mismatch، Cycle، Parent نامعتبر، تاریخ شروع>پایان
  در نود دارای هر دو مقدار، عدم تطابق تعداد.
- **WARNING** (اجازهٔ Draft، مانع Publish/Baseline): وزن نامتوازن (Σ≠100)، تاریخ نامعتبر
  (`INVALID_DATE`)، وزن مشتق‌شده، نبود مسئول/DOD، Ambiguous Outline.
- **INFO**: نود بدون تاریخ (سطوح بالا)، Period بدون داده.

## 4. Ambiguous Mapping
اگر Outline Level/Number مبهم بود (مثل ناسازگاری WBS `2.1` با Outline `1.5.2` در MPP):
- حدس خاموش ممنوع.
- نمایش در بخش Ambiguous برای انتخاب Parent صحیح توسط Editor.
- Commit تا حل تمام CRITICALها غیرفعال.

## 5. تاریخ‌های نامعتبر
۵ سلول شروع و ۵ سلول پایان (65−60) حاوی متن غیرتاریخی‌اند → `INVALID_DATE` (WARNING)،
`plannedStart/Finish=null`، متن خام در `rawData` نگه داشته می‌شود.

## 6. امنیت Import
- پسوند مجاز: `xlsx, xlsm, mpp`. اعتبارسنجی MIME + Signature (Magic bytes).
- حداکثر حجم پیش‌فرض 50MB. Filename امن، Path Traversal/Command Injection ممنوع.
- MPP از طریق Adapter ایزولهٔ MPXJ (Process با Timeout/Memory limit) — مسیر فایل هرگز
  مستقیم وارد Shell نمی‌شود. فایل موقت پس از Import حذف می‌شود.
- فایل خام/داده در Log چاپ نمی‌شود. Raw data فقط برای Editor.

## 7. Dry-Run و Commit
- Dry-Run: تمام اعتبارسنجی‌ها بدون نوشتن؛ گزارش Count/Conflict/Warning.
- Commit: در یک Transaction؛ خطا → Rollback کامل (هیچ دادهٔ نیمه‌کاره).
- ثبت `ImportBatch(status,totalRows,importedRows,warningRows,failedRows,validationReport,mappingReport)`.

## 8. API Import (نسخهٔ `/api/v1`)
تمام Mutationها فقط با نقش `PROJECT_EDITOR`:

```
POST /api/v1/projects/:projectId/control/imports/upload      # بارگذاری xlsx/xlsm/mpp → ImportBatch
POST /api/v1/projects/:projectId/control/imports/:id/preview # Dry-Run + Manifest (پیش‌فرض dryRun=true)
POST /api/v1/projects/:projectId/control/imports/:id/map      # Mapping/Conflict دستی
POST /api/v1/projects/:projectId/control/imports/:id/validate # اعتبارسنجی کامل بدون ذخیره
POST /api/v1/projects/:projectId/control/imports/:id/commit   # Commit اتمیک (confirm=true الزامی)
GET  /api/v1/projects/:projectId/control/imports              # فهرست
GET  /api/v1/projects/:projectId/control/imports/:id          # جزئیات
GET  /api/v1/projects/:projectId/control/imports/:id/errors   # خطاها/هشدارها
GET  /api/v1/projects/:projectId/control/imports/mpp-check    # وضعیت محیط MPP
```

اعتبارسنجی آپلود: پسوند (`xlsx/xlsm/mpp`) + MIME + Magic bytes (`PK..` برای Excel، `D0CF11E0` برای MPP)،
حداکثر حجم `VALIDATION.UPLOAD_MAX_BYTES`، ذخیره با نام تصادفی زیر `<upload>/project-control`.

## 9. CLI Import
پیش‌فرض Dry-Run است؛ بدون `--commit` هیچ نوشتنی رخ نمی‌دهد. فایل خام/Secret در Log چاپ نمی‌شود.

```bash
# Dry-Run
pnpm --filter @ppm/api project-control:import -- \
  --project-id <UUID> --excel "<PATH.xlsx>" [--mpp "<PATH.mpp>"] --dry-run

# Commit اتمیک
pnpm --filter @ppm/api project-control:import -- \
  --project-id <UUID> --excel "<PATH.xlsx>" [--mpp "<PATH.mpp>"] --commit
```

Exit Code: `0` موفق، `2` خطای بحرانی/عدم تطابق Manifest، `1` خطای اجرا.

## 10. MPP و پیش‌نیاز Java (مستندسازی)
- تجزیهٔ MPP از طریق **Adapter ایزولهٔ MPXJ** انجام می‌شود که فقط پشت `MppAdapter` قرار دارد؛
  بنابراین تست‌های Backend به Java روی سیستم توسعه وابسته نیستند (از `FixtureMppAdapter` و Fixture
  نسخه‌بندی‌شدهٔ Sanitized استفاده می‌شود).
- پیش‌نیاز اجرای واقعی MPP: نصب **Java Runtime** و تنظیم متغیر محیطی **`MPXJ_HELPER_JAR`** به مسیر
  Helper Jar مبتنی بر MPXJ. مسیر فایل هرگز وارد Shell نمی‌شود (`execFile` با آرایهٔ آرگومان، Timeout و
  محدودیت حافظه).
- در نبود Java/MPXJ، API و CLI خطای **کنترل‌شدهٔ فارسی** می‌دهند (نه Crash). فرمان تشخیصی:

```bash
pnpm --filter @ppm/api project-control:mpp-check [-- --file "<PATH.mpp>"]
```

خروجی: وجود `java` در PATH، نسخهٔ Java، حضور/نسخهٔ Adapter، وجود MPXJ Helper، دسترسی فایل و پیام وضعیت.
Exit Code: `0` آماده، `3` MPP در دسترس نیست (بدون خطای اجرا).
