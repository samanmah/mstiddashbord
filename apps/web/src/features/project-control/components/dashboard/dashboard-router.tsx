'use client';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import { FullPageSpinner } from '@/components/ui/spinner';
import { useControlPlan } from '../../hooks/use-control-plan';
import { AdvancedDashboardView } from './advanced-dashboard-view';

/**
 * انتخاب داشبورد بر اساس فعال بودن «کنترل پروژه»:
 * - اگر برنامهٔ کنترل فعال باشد → داشبورد مدیریتی پیشرفته.
 * - در غیر این صورت (یا در صورت خطا) → داشبورد قبلی (بدون تغییر رفتار موجود).
 */
export function DashboardRouter({ projectId }: { projectId: string }): React.JSX.Element {
  const plan = useControlPlan(projectId);

  if (plan.isLoading) {
    return <FullPageSpinner label="در حال بارگذاری داشبورد…" />;
  }

  if (plan.data) {
    return <AdvancedDashboardView projectId={projectId} />;
  }

  return <DashboardView projectId={projectId} />;
}
