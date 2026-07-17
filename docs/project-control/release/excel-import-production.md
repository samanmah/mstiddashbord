# Excel Import — جدا از Pipeline کد

فایل واقعی:

`ساختار شکست کار بهمراه گانت چارت طرح پیشران نوآوری V03 تاریخ 1450423.xlsx`

**هرگز در Repository عمومی Commit نشود** (پوشش `.gitignore`).

## زمان اجرا

پس از موفقیت Release Pipeline (Staging + Production) — از رابط امن Production Upload شود.

## مسیر کامل Import

1. Upload  
2. Manifest  
3. Structure  
4. Conflicts  
5. Data Quality  
6. Dry Run  
7. Commit  
8. Result  

## Validation پس از Commit

- تعداد Nodeهای DB = Preview `totalNodes` + Root Project  
- جمع وزن‌ها و بودجه‌ها با Manifest  
- تمام سطوح WBS با `parentId` صحیح  
- Gantt تمام فعالیت‌های زمان‌دار را نمایش دهد  
- Dashboard از دادهٔ واقعی (نه Fixture)

## Audit Report

```bash
# پس از ذخیرهٔ JSONهای Preview/Commit از API:
node infrastructure/scripts/project-control/import-audit-report.mjs \
  --preview /path/to/preview.json \
  --commit /path/to/commit.json \
  --out artifacts/project-control/import-audit-report.json
```

هیچ مقدار نباید به‌خاطر صفر، null، رشتهٔ فارسی، تاریخ شمسی یا فرمت عددی حذف شود.
