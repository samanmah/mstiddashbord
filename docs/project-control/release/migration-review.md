# Migration Review — Advanced Project Control

**Migration:** `20260716135226_advanced_project_control`  
**Branch:** `feature/advanced-project-control-wbs-gantt`  
**PostgreSQL target:** 18  

## Verdict

**PASS — Additive only.** مناسب برای Forward-Only Deploy. Migration Down تعریف نشده و توصیه نمی‌شود.

## Destructive operations audit

| Operation | Count | Result |
|-----------|------:|--------|
| `DROP TABLE` | 0 | ✅ |
| `DROP COLUMN` | 0 | ✅ |
| `DROP TYPE` | 0 | ✅ |
| Rename مخرب | 0 | ✅ |
| تغییر نوع مخرب | 0 | ✅ |
| حذف داده | 0 | ✅ |
| SQL خام خطرناک (`TRUNCATE`, `DELETE` بدون WHERE) | 0 | ✅ |

## Additive changes

### ALTER TABLE (ADD COLUMN only)

- `projects`: `activeControlPlanId`, `controlCurrency`, `controlStatusDate`, `controlVersion` (DEFAULT 1), `projectControlEnabled` (DEFAULT false)
- `risks`: `phaseNodeId`, `wbsNodeId` (nullable, FK SET NULL)
- `decisions`: `phaseNodeId`, `wbsNodeId` (nullable, FK SET NULL)

پروژه‌های موجود با `projectControlEnabled=false` رفتار Dashboard قدیمی را حفظ می‌کنند.

### New enums (10)

`WbsNodeType`, `WeightSource`, `DependencyType`, `DependencySource`, `AssignmentRole`, `ControlNodeStatus`, `ControlPeriodUnit`, `ControlImportSourceType`, `ControlImportStatus`, `ImportMatchStatus`

### New tables (10)

`project_control_plans`, `wbs_nodes`, `task_dependencies`, `node_assignments`, `progress_updates`, `project_baselines`, `baseline_node_snapshots`, `import_batches`, `import_source_records`, `project_schedule_snapshots`

### Indexes

Indexهای مسیر مادری (`materializedPath`)، `(controlPlanId, sortOrder)`، و کلیدهای یکتای وابستگی ایجاد شده‌اند. برای بار Impart و Dashboard کافی است.

### Foreign keys

- CASCADE روی تعلق به Plan/Project برای پاک‌سازی منطقی زیرمجموعه‌ها
- RESTRICT روی `wbs_nodes.parentId` برای جلوگیری از یتیم‌شدن درخت
- SET NULL روی Risk/Decision → WBS و ImportSourceRecord → node

**نکته:** `projects.activeControlPlanId` در این Migration FK ندارد (اجتناب از وابستگی دایره‌ای هنگام ایجاد Plan). سازگاری کاربردی در لایه Service تضمین می‌شود.

## PostgreSQL 18

- نوع‌ها و syntax استاندارد Postgres سازگار است.
- Volume Compose باید به `/var/lib/postgresql` Mount شود (نه `/var/lib/postgresql/data`).

## Test matrix

### A) Disposable empty DB

```bash
./infrastructure/scripts/project-control/run-migrations.sh --disposable
```

انتظار: migrate deploy + prisma validate موفق.

### B) Upgrade path (schema نسخه قبل + داده قدیمی)

1. DB با فقط migration `init`
2. Seed داده قدیمی (projects/activities/risks/decisions)
3. `prisma migrate deploy` → اعمال `advanced_project_control`
4. Assert: ردیف‌های قدیمی `projects`/`risks`/`decisions` حفظ شده‌اند
5. Dashboard قدیمی برای `projectControlEnabled=false` کار می‌کند
6. Enable Control + Import Fixture → Dashboard جدید

### C) Production isolation

هیچ تستی نباید به Production DB متصل شود. فقط Staging یا Disposable.

## Rollback strategy (پس از migrate)

Migration Down وجود ندارد و توصیه نمی‌شود.

1. Image قبلی API/Web را برگردانید (`rollback.sh`)
2. جداول/ستون‌های Additive بلااستفاده باقی می‌مانند
3. Restore DB فقط در وضعیت اضطراری با تأیید مضاعف
