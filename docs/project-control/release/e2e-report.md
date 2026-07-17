# E2E Report Template — Advanced Project Control

## نحوه اجرا

```bash
./infrastructure/scripts/project-control/run-e2e.sh
./infrastructure/scripts/project-control/capture-screenshots.sh
```

Base URL: `PLAYWRIGHT_BASE_URL` (پیش‌فرض Staging `http://127.0.0.1:18080`)

## سناریوهای پوشش‌داده‌شده در اسپک

| # | سناریو | اسپک |
|---|--------|------|
| 1 | Login Editor | project-control.spec / dashboard.spec |
| 2 | انتخاب پروژه آزمایشی | project-control.spec |
| 3 | فعال‌سازی Project Control | project-control.spec |
| 4–7 | Import Wizard / Manifest UI | project-control.spec + import-fixture.sh |
| 8–10 | WBS Expand/Collapse | project-control.spec |
| 11–16 | Progress/Dependency/Baseline | API import-fixture + UI editors (Staging manual checklist) |
| 17–19 | Dashboard / S-Curve / Gantt | project-control.spec |
| 20–22 | Gantt draft Zoom | project-control.spec |
| 23–25 | Viewer dashboard + no edit link | project-control.spec |
| 26–28 | Fullscreen / Print / Mobile | project-control.spec |
| 29 | Dashboard قدیمی برای پروژه غیرفعال | DashboardRouter + smoke |
| 30 | Risks/Decisions regression | smoke-test + dashboard.spec |

## نتیجه اجرا

| مورد | وضعیت | زمان | یادداشت |
|------|--------|------|---------|
| E2E Playwright | _pending staging run_ | | |
| Screenshot capture | _pending staging run_ | | |
| Manifest assert (import-fixture) | _pending staging run_ | | |

## Screenshot paths (پس از موفقیت)

- `artifacts/project-control/control-overview-1920x1080.png`
- `artifacts/project-control/wbs-editor-1920x1080.png`
- `artifacts/project-control/import-manifest-1920x1080.png`
- `artifacts/project-control/dashboard-1920x1080.png`
- `artifacts/project-control/dashboard-1366x768.png`
- `artifacts/project-control/dashboard-tablet-768x1024.png`
- `artifacts/project-control/dashboard-mobile-390x844.png`
- `artifacts/project-control/gantt-viewer-1920x1080.png`
- `artifacts/project-control/gantt-editor-1920x1080.png`
- `artifacts/project-control/phase-drilldown-1920x1080.png`

Screenshotها فقط Fixture Sanitized؛ Password/Token/مسیر محرمانه نباید دیده شود.
`artifacts/*` در gitignore است.
