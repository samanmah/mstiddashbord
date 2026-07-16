/**
 * انتخاب/اعتبارسنجی deterministic پروژه Fixture Staging.
 * هرگز اولین پروژهٔ لیست (arr[0]) به‌عنوان fallback استفاده نمی‌شود.
 */

export const FIXTURE_PROJECT_CODE = 'STG-PC-001';

export const FIXTURE_PROJECT_CREATE = Object.freeze({
  titleFa: 'Staging Control Project',
  titleEn: 'Staging Control',
  projectCode: FIXTURE_PROJECT_CODE,
  projectManager: 'Staging Editor',
  budgetBillionRial: 1,
  // فیلدهای اجباری API (هویت Fixture نیستند؛ فقط برای Create معتبر)
  projectType: 'زیرساختی',
  description: 'Staging fixture project for Advanced Project Control',
  startDate: '1404/09/01',
  plannedEndDate: '1406/12/10',
  reportDate: '1405/04/25',
});

/**
 * قرارداد Fixture: projectCode و titleFa باید دقیقاً مطابق باشند.
 * @param {object} project
 */
export function assertFixtureProjectContract(project) {
  if (!project || typeof project !== 'object') {
    throw new Error('پروژه Fixture نامعتبر است (پاسخ خالی).');
  }
  if (project.projectCode !== FIXTURE_PROJECT_CODE) {
    throw new Error(
      `قرارداد Fixture نقض شد: انتظار projectCode=${FIXTURE_PROJECT_CODE}؛ دریافت شد: ${String(project.projectCode)}`,
    );
  }
  if (project.titleFa !== FIXTURE_PROJECT_CREATE.titleFa) {
    throw new Error(
      `قرارداد Fixture نقض شد: projectCode=${FIXTURE_PROJECT_CODE} موجود است اما titleFa ناسازگار است ` +
        `(انتظار «${FIXTURE_PROJECT_CREATE.titleFa}»؛ دریافت «${String(project.titleFa)}»). ` +
        'پروژه نامرتبط تغییر داده نمی‌شود — دستی اصلاح یا حذف کنید.',
    );
  }
  if (project.titleEn != null && project.titleEn !== FIXTURE_PROJECT_CREATE.titleEn) {
    throw new Error(
      `قرارداد Fixture نقض شد: titleEn ناسازگار است (انتظار «${FIXTURE_PROJECT_CREATE.titleEn}»؛ دریافت «${String(project.titleEn)}»).`,
    );
  }
}

/**
 * @param {Array<object>} projects
 * @returns {{ action: 'reuse', project: object } | { action: 'create', project: null }}
 */
export function selectStagingFixtureProject(projects) {
  if (!Array.isArray(projects)) {
    throw new Error('فهرست پروژه‌ها باید آرایه باشد.');
  }

  const byCode = projects.find((p) => p?.projectCode === FIXTURE_PROJECT_CODE);
  if (byCode) {
    assertFixtureProjectContract(byCode);
    return { action: 'reuse', project: byCode };
  }

  // Fallback ثانویهٔ صریح (سازگاری با دادهٔ قدیمی) — هرگز arr[0]
  const byTitleEn = projects.find((p) => p?.titleEn === FIXTURE_PROJECT_CREATE.titleEn);
  if (byTitleEn) {
    if (byTitleEn.projectCode && byTitleEn.projectCode !== FIXTURE_PROJECT_CODE) {
      throw new Error(
        `پروژه‌ای با titleEn=«${FIXTURE_PROJECT_CREATE.titleEn}» یافت شد اما projectCode=${String(byTitleEn.projectCode)} ` +
          `با ${FIXTURE_PROJECT_CODE} سازگار نیست. پروژه نامرتبط تغییر داده نمی‌شود.`,
      );
    }
    if (byTitleEn.titleFa !== FIXTURE_PROJECT_CREATE.titleFa) {
      throw new Error(
        `پروژه‌ای با titleEn=«${FIXTURE_PROJECT_CREATE.titleEn}» یافت شد اما titleFa ناسازگار است. پروژه نامرتبط تغییر داده نمی‌شود.`,
      );
    }
    if (byTitleEn.projectCode === FIXTURE_PROJECT_CODE) {
      assertFixtureProjectContract(byTitleEn);
      return { action: 'reuse', project: byTitleEn };
    }
    // titleEn مطابق است اما projectCode ندارد → پروژهٔ جدید STG-PC-001 ساخته می‌شود (بدون mutate).
  }

  return { action: 'create', project: null };
}
