# نگاشت داده — Data Mapping (Excel + MPP → WbsNode)

مرجع: `source-analysis.md`. تمام نگاشت‌ها Additive و Backward-Compatible هستند و روی
مدل `WbsNode` جدید اعمال می‌شوند (مدل `Activity` قدیمی دست‌نخورده می‌ماند).

## 1. نگاشت Excel «گانت» → WbsNode

| ستون Excel | WbsNode field | تبدیل |
|------------|---------------|-------|
| B (Phase) | نود `PHASE` (`title`,`normalizedTitle`,`code`=«۱..۷») | Fill-down از Merge، Normalize فارسی |
| C (Break1) | نود `BREAK1` فرزند Phase | Fill-down، `code`=«n-m» |
| D (Break 2) | نود `WORK_PACKAGE`/`TASK`/`SUMMARY_TASK` | `sourceRawTitle`=خام با تورفتگی، `normalizedTitle`=Trim/Normalize، Outline از تورفتگی |
| E تاریخ شروع | `plannedStart` | Jalali→UTC (Asia/Tehran)، نامعتبر→`null`+warning |
| F تاریخ پایان | `plannedFinish` | مانند بالا |
| G مبلغ پیشنهادی | `budgetAmount` | حذف جداکننده + پسوند «تومان» + ارقام فارسی→لاتین |
| H مسئول انجام | `ownerText` + `NodeAssignment(OWNER)` | Normalize، تفکیک چندنفره با «،/,/-» |
| I DOD | `definitionOfDone` | Trim |
| J PLAN START | `periodPlanStart` | Int |
| K DURATION | `periodPlanDuration` | Int |
| L ACTUAL START | `periodActualStart` | Int |
| M ACTUAL DURATION | `periodActualDuration` | Int |
| N PERCENT COMPLETE | `percentComplete` | 0..100 (اگر 0..1 بود ×100 با تشخیص) |
| O..FE | ماتریس Period (نمایشی گانت) | ذخیره در متادیتای Period plan/actual |

- `sourceFileType = EXCEL`، `sourceRow = <ردیف واقعی>`، `sourceFileHash = <SHA-256>`.
- `nodeType`: Phase→`PHASE`، Break1→`BREAK1`، Break2 بدون فرزند→`TASK`، Break2 با
  زیرفعالیت (تورفتگی/Summary)→`SUMMARY_TASK`/`WORK_PACKAGE`، تاریخ‌های نقطه‌ای→`MILESTONE`.

## 2. نگاشت MPP → WbsNode (فقط فاز ۵)

| فیلد MPP | WbsNode field | توضیح |
|----------|---------------|-------|
| Outline Number / Outline Level | `outlineNumber` / `depth` | **مرجع اصلی سلسله‌مراتب** |
| WBS | `code` (کمکی) | در صورت ناسازگاری با Outline → Ambiguous |
| Unique ID | `externalUid` | کلید تطبیق پایدار |
| Task Name | `sourceRawTitle`/`title`/`normalizedTitle` | Normalize فارسی |
| Summary | `isSummary` | |
| Milestone | `isMilestone` / `nodeType=MILESTONE` | |
| Start/Finish | `plannedStart`/`plannedFinish` | |
| Duration | `plannedDurationMinutes` | تبدیل واحد MPXJ→دقیقه |
| Actual Start/Finish/Duration | `actualStart`/`actualFinish`/`actualDurationMinutes` | |
| Remaining Duration | `remainingDurationMinutes` | |
| Percent / Physical Percent | `percentComplete`/`physicalProgress` | |
| Baseline Start/Finish/Duration/Cost | `baselineStart/Finish/...` | (در این فایل خالی) |
| `COST2` (شرکتی) | `mppCost` | **منبع پولی MPP** |
| `COST1` (پیشرفت ریالی) | `financialProgress` (کمکی) | |
| `NUMBER1` (وزن) | `weight` (source=`MPP_CUSTOM_FIELD`) | خالی → مشتق‌سازی |
| `NUMBER20` (درصد پیشرفت وزنی) | مرجع کمکی physical | |
| Work/ActualWork/RemainingWork | `workMinutes/...` | |
| Constraint Type/Date, Deadline | `constraintType/constraintDate/deadline` | |
| Predecessors/Successors + Lag | `TaskDependency(type,lagMinutes)` | همگی FS/lag0 در این فایل |
| Resources | `NodeAssignment(externalResourceName)` | ۱۰ شخص |
| Calendar | `calendarName` | |
| Notes | `notes` | |

## 3. Normalize فارسی (قطعی)

1. `ي (U+064A) → ی (U+06CC)`
2. `ك (U+0643) → ک (U+06A9)`
3. حذف Zero-Width ناخواسته: `U+200B, U+200C(کنترل‌شده), U+200D, U+FEFF`
4. یکسان‌سازی نیم‌فاصله (`U+200C`) در جای صحیح
5. ارقام فارسی `۰-۹` و عربی `٠-٩` → لاتین `0-9`
6. `Trim` فاصلهٔ انتهایی (نه ابتدایی در نسخهٔ Raw)
7. تبدیل فاصله‌های چندگانه به یک فاصله (فقط در normalized)
8. ذخیرهٔ جداگانهٔ `rawTitle` (با تورفتگی) و `normalizedTitle`

## 4. منطق تطبیق Excel ⟷ MPP (به ترتیب اولویت)

1. WBS Code
2. Outline Number
3. Source Unique ID (`externalUid`)
4. عنوان Normalize‌شده
5. Parent Normalize‌شده
6. تاریخ شروع/پایان
7. Duration
8. Manual Mapping (Editor)

هیچ بازنویسی بدون **Preview + Conflict Resolution** انجام نمی‌شود.

## 5. Precedence پیش‌فرض

| موضوع | منبع برنده |
|-------|-----------|
| نام و ساختار ۷ فاز و Break1 | **Excel** |
| Outline / Dependency | **MPP** |
| Resource / Calendar | **MPP** |
| درصد پیشرفت | آخرین منبع معتبر بر اساس `reportingDate` |
| تاریخ‌های دارای Conflict | نیازمند تأیید Editor |
| بودجه (`budgetAmount`) vs هزینه MPP (`mppCost`) | **فیلدهای جدا** — هیچ Overwrite خام |

هر دو مقدار پولی جداگانه ذخیره و در Dashboard تفکیک‌شده نمایش داده می‌شوند.
