# معماری کنترل پروژه پیشرفته — Architecture

> توسعهٔ **افزایشی و Backward-Compatible** روی سامانهٔ موجود (Monorepo pnpm: NestJS + Next.js +
> Prisma/PostgreSQL). هیچ مدل/جدول موجود حذف یا Rename نمی‌شود. قابلیت‌های فعلی
> (Auth، Dashboard قدیمی، Activity، Risk، Decision، Import/Export قدیمی) دست‌نخورده می‌مانند.

## 1. ساختار Monorepo موجود (بدون تغییر ساختاری)
```
apps/
  api/   NestJS  → modules: auth, users, projects, dashboard, calculation,
                    import, export, audit, health  (+ جدید: project-control)
  web/   Next.js App Router  → (app)/dashboard, (app)/admin, login, ...
packages/
  contracts/   انواع، enums، jalali.ts، normalize.ts (بازاستفاده می‌شوند)
  eslint-config, tsconfig
infrastructure/  docker, nginx, compose
```

## 2. بازاستفاده از ابزارهای موجود (بدون بازنویسی)
- **Persian Normalize:** `packages/contracts/src/normalize.ts`
  (`normalizeText`, `toLatinDigits`, `parseNumeric`, `sanitizeForSpreadsheet`).
  Importer یک لایهٔ نازک `normalizeTitle`/`rawTitle` روی این‌ها اضافه می‌کند (حفظ تورفتگی در Raw).
- **Jalali:** `packages/contracts/src/jalali.ts` (`jalaliStringToDate`, `dateToJalaliString`).
- **RBAC/Guards/Audit:** از ماژول‌های `auth` و `audit` موجود.
- **Formula-Injection guard:** `sanitizeForSpreadsheet` برای Exportها.

## 3. ماژول جدید Backend: `project-control`
`apps/api/src/modules/project-control/` شامل:
- `project-control.module.ts`
- کنترلرها: `wbs`, `gantt`, `dependencies`, `progress`, `baselines`, `analytics`,
  `imports`, `dashboard`, `export` (همه تحت `/api/v1/projects/:projectId/control/...`).
- سرویس‌ها:
  - `ProjectControlCalculationService` (rollup، planned، variance، status، EV، S-Curve، CPM).
  - `WbsService` (CRUD + reorder/reparent + cycle guard + materializedPath).
  - `ImportOrchestratorService` (Upload→Parse→Match→Validate→Preview→Commit TX).
  - `ExcelParserService` (openpyxl معادل با `exceljs`/موجود).
  - `MppAdapterService` → فراخوانی امن **MPXJ**.
- **Feature Flag:** تمام مسیرها فقط وقتی `Project.projectControlEnabled=true` فعال‌اند؛
  فعال‌سازی صرفاً توسط `PROJECT_EDITOR`.

### 3.1 RBAC
- `PROJECT_EDITOR`: تمام Mutationها + Import.
- `MANAGER_VIEWER`: فقط `GET`. اعمال RBAC در Backend (Guard) — نه صرفاً UI.

### 3.2 Cache
`CalculationCache` با کلید `projectId+controlPlanId+statusDate+version`؛ Invalidate هدفمند
پس از Mutation. Auto-Refresh موجود حفظ می‌شود؛ Polling هنگام باز بودن Edit Modal کنترل می‌شود.

## 4. Adapter امن MPXJ (خواندن MPP)
- **مسئله:** MPP باینری است و باید با Parser معتبر خوانده شود (نه دستی).
- **راهکار:** Adapter ایزوله مبتنی بر **MPXJ** (`org.mpxj`) که خروجی را به **JSON استاندارد و
  Versioned** تبدیل می‌کند.
- **الگو:** یک ابزار CLI کوچک Java (MPXJ) یا Worker مستقل که NestJS از طریق `spawn` امن
  آن را صدا می‌زند:
  - آرگومان‌ها به‌صورت آرایه (بدون `shell:true`) → **بدون Command Injection**.
  - مسیر فایل هرگز مستقیم داخل رشتهٔ Shell قرار نمی‌گیرد؛ فایل موقت با نام امن.
  - `timeout` و محدودیت حافظه؛ حذف فایل موقت پس از پردازش.
  - ورودی/خروجی با Schema (Zod) اعتبارسنجی و `parserVersion` ثبت می‌شود.
- خروجی JSON: `{ parserVersion, project, tasks[], resources[], relations[], customFields[] }`.
- در محیط توسعه/تست از **Fixture JSON ناشناس** استفاده می‌شود تا وابستگی به Java در CI حذف شود.

## 5. مدل داده (خلاصه — جزئیات در data-model.md)
مدل‌های جدید (همگی Additive):
`ProjectControlPlan, WbsNode, TaskDependency, NodeAssignment, ProgressUpdate,
ProjectBaseline, BaselineNodeSnapshot, ImportBatch, ImportSourceRecord,
ProjectScheduleSnapshot` + فیلدهای جدید روی `Project`
(`projectControlEnabled, activeControlPlanId, controlStatusDate, controlCurrency, controlVersion`)
و افزودن `phaseNodeId/wbsNodeId` nullable به `Risk`/`Decision`.

- WBS **نامحدود**: `parentId + depth + materializedPath + outlineNumber + sortOrder`.
- Soft Delete (`deletedAt`)، منع Cycle، Indexهای مناسب روی FKها/`sortOrder`/`materializedPath`/
  `projectId`/`controlPlanId`/`statusDate`/`reportingDate`.

## 6. Frontend
- **Editor** تحت `/(app)/admin/projects/[projectId]/control/...` (Overview, WBS, Gantt,
  Progress, Dependencies, Baselines, Costs, Imports, Data-Quality).
- **Viewer** داشبورد پیشرفته روی Route موجود Dashboard؛ برای پروژهٔ دارای Project Control
  فعال، نسخهٔ پیشرفته (WbsNode) و در غیر این‌صورت داشبورد قدیمی (Activity).
- Gantt: ابتدا توسعهٔ پیاده‌سازی CSS/SVG موجود + Virtualization برای 170+ نود؛ بدون
  کتابخانهٔ سنگین. Chartها Lazy Load.
- Design System فعلی (`ui/dashboard-visual-refresh`) حفظ و رنگ‌های Semantic فاز/وضعیت اضافه می‌شود.
- RTL کامل، Jalali، WCAG AA، Responsive (تا 390×844)، Wallboard + Print.

## 7. Import CLI
`pnpm --filter @ppm/api project-control:import -- --project-id <UUID> --excel <p> --mpp <p> [--dry-run|--commit]`
- Read-only خواندن فایل، نمایش Hash/Manifest، Verify Countها، گزارش Conflict،
  Dry-Run پیش‌فرض، Commit در Transaction، ثبت `ImportBatch`، Exit Code صحیح.

## 8. سازگاری Deployment (حفظ می‌شود)
pnpm 11 allowBuilds، OpenSSL در Alpine، `pnpm deploy --legacy`، عدم کپی دستی
`.prisma`، PostgreSQL 18 volume، Cookie از ENV، `compose.server.yml`، HTTP موقت. هیچ
ارتقای بزرگ (Node/Next/Nest/Prisma/pnpm) بدون ضرورت.

## 9. Migration
فقط `CREATE TABLE / ADD COLUMN / CREATE INDEX`. بدون DROP/Rename مخرب؛ بدون تغییر دادهٔ
موجود؛ Idempotent روی `migrate deploy`؛ تست روی Copy از Production و PostgreSQL 18.
