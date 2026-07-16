# قواعد محاسبات — Calculation Rules

تمام محاسبات در Backend داخل `ProjectControlCalculationService` انجام می‌شود؛ Frontend
فقط نتایج را نمایش می‌دهد. همهٔ قواعد **Configurable** هستند (thresholdها از config).

## 1. Leaf Node
نودی که هیچ فرزند **فعال** (`isActive && deletedAt=null`) ندارد.

## 2. Actual Progress
- Leaf: اولویت `physicalProgress` → `percentComplete` → آخرین `ProgressUpdate.actualPercent`.
- Summary: `Σ(childActual × childNormalizedWeight)` روی فرزندان فعال.

## 3. Weight (اولویت + weightSource)
1. `EXPLICIT` — وزن صریح Excel/MPP
2. `MPP_CUSTOM_FIELD` — `NUMBER1` (در فایل فعلی خالی)
3. `COST_DERIVED` — بر اساس `budgetAmount`/`mppCost`
4. `DURATION_DERIVED` — بر اساس Duration
5. `EQUAL_DERIVED` — توزیع مساوی
6. `NONE`

- هر وزن مشتق‌شده **با هشدار داده‌ای** همراه است.
- `Σ(childWeight)` هر Parent باید = 100 باشد. اگر نبود:
  - Draft Save مجاز، Publish/Baseline/Final Commit **ممنوع**.
  - نمایش Data Quality Warning + مقدار کسری/اضافه.

## 4. Planned Progress
- اگر `plannedProgressOverride` موجود → همان.
- اگر تاریخ شروع/پایان موجود:
  - قبل از شروع → 0؛ بعد از پایان → 100؛ بین → خطی بر اساس **روز کاری/Calendar**.
  - نبود Calendar → روز تقویمی با Label «تقریبی».
- اگر تاریخ نبود ولی `periodPlanStart`+`periodPlanDuration` موجود → بر اساس Period.
- Summary: rollup وزنی از فرزندان.

## 5. Schedule Variance
- `scheduleVariancePercent = actualProgress − plannedProgress`
- `finishVarianceDays = forecastFinish − baselineFinish` (روز)

## 6. Earned Value (فقط با Budget و Actual Cost معتبر)
```
BAC = budget
PV  = BAC × plannedProgress / 100
EV  = BAC × actualProgress  / 100
AC  = actualCost
SV  = EV − PV        CV  = EV − AC
SPI = EV / PV        CPI = EV / AC
```
- مدیریت Division by Zero: مخرج صفر → `null`.
- نبود دادهٔ کافی → `null` + Label «داده کافی نیست» (نه صفر جعلی).

## 7. Status (Configurable thresholds)
`NOT_STARTED, ON_TRACK, AT_RISK, DELAYED, BLOCKED, COMPLETED, CANCELLED, UNKNOWN`

| قاعده (پیش‌فرض) | شرط |
|---|---|
| `BLOCKED` | `statusOverride=BLOCKED` |
| `CANCELLED` | `statusOverride=CANCELLED` |
| `COMPLETED` | `actualProgress ≥ 100` |
| `NOT_STARTED` | `actualProgress = 0` و شروع در آینده |
| `ON_TRACK` | `SV% ≥ −5` |
| `AT_RISK` | `−15 ≤ SV% < −5` |
| `DELAYED` | `SV% < −15` یا (پایان برنامه گذشته و progress<100) |
| `UNKNOWN` | دادهٔ ناکافی |

## 8. Critical Path (CPM)
فقط وقتی: Dependency معتبر + Duration معتبر + گراف بدون Cycle.
- Forward/Backward Pass → `earlyStart, earlyFinish, lateStart, lateFinish, totalFloat, freeFloat, isCritical`.
- نبود Dependency کافی → عدم حدس (خروجی خالی + پیام).

## 9. S-Curve
خروجی روزانه/هفتگی/ماهانه: Planned Physical، Actual Physical، Forecast، Planned
Financial، Actual Financial. Snapshotها بر اساس `statusDate` در `ProjectScheduleSnapshot`
ذخیره می‌شوند تا تاریخچه حفظ شود.

## 10. Cache
کلید: `projectId + controlPlanId + statusDate + version`. بعد از هر Mutation فقط Cache
مرتبط Invalidate می‌شود.
