# Smoke Test — Advanced Project Control

## اجرا

```bash
./infrastructure/scripts/project-control/smoke-test.sh
```

## Checklist

- [ ] `GET /api/v1/health`
- [ ] `GET /api/v1/health/liveness` (شامل version/gitSha)
- [ ] `GET /api/v1/health/readiness`
- [ ] Login Editor
- [ ] Login Viewer
- [ ] Dashboard قدیمی
- [ ] Dashboard جدید (اگر Control فعال)
- [ ] Control Plan / WBS / Gantt / S-Curve / Phase Rollup / Critical Path / Data Quality / Imports
- [ ] Risks / Decisions
- [ ] API بدون Restart Loop
- [ ] Web Healthy
- [ ] PostgreSQL Healthy
- [ ] Nginx بدون 502 روی health
- [ ] Migration Pending نباشد
- [ ] Log بحرانی انبوه نباشد

## نتیجه

وضعیت: _pending staging run_
