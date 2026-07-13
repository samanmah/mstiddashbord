'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  FileSpreadsheet,
  ListTodo,
  Scale,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { DecisionStatus, VALIDATION } from '@ppm/contracts';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';
import { faPercent, isoToJalaliFa } from '@/lib/utils';

export default function AdminHomePage(): React.JSX.Element {
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectService.list,
  });

  const first = projectsQuery.data?.[0];

  const dashboardQuery = useQuery({
    queryKey: first ? queryKeys.dashboard(first.id) : ['dashboard', 'none'],
    queryFn: () => projectService.dashboard(first!.id),
    enabled: Boolean(first),
  });

  if (projectsQuery.isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (projectsQuery.isError) {
    return <ErrorState error={projectsQuery.error} onRetry={() => void projectsQuery.refetch()} />;
  }

  if (!first) {
    return (
      <>
        <PageHeader title="خانهٔ مدیریت" />
        <EmptyState
          title="هنوز پروژه‌ای ثبت نشده است"
          description="برای شروع یک فایل Excel وارد کنید."
          action={
            <Link href="/admin/import" className="btn btn-primary">
              <Upload className="h-4 w-4" /> ورود از Excel
            </Link>
          }
        />
      </>
    );
  }

  const d = dashboardQuery.data;
  const openDecisions =
    d?.decisions.filter((x) => x.status !== DecisionStatus.DONE).length ?? 0;
  const totalWeight = d?.summary.totalWeight ?? 0;
  const weightValid = d ? Math.abs(totalWeight - 100) < VALIDATION.WEIGHT_SUM_TOLERANCE : true;

  return (
    <>
      <PageHeader
        title="خانهٔ مدیریت"
        description={first.titleFa}
        action={
          <Link href={`/admin/projects/${first.id}/general`} className="btn btn-primary">
            ویرایش پروژه
          </Link>
        }
      />

      {d ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={<Activity />} label="تعداد فعالیت‌ها" value={String(d.activities.length)} />
            <StatCard
              icon={<Scale />}
              label="مجموع وزن"
              value={faPercent(totalWeight)}
              warning={!weightValid}
            />
            <StatCard icon={<AlertTriangle />} label="تعداد ریسک‌ها" value={String(d.risks.length)} />
            <StatCard icon={<ListTodo />} label="تصمیمات باز" value={String(openDecisions)} />
          </div>

          {!weightValid ? (
            <div className="mt-4 flex items-center gap-2 rounded-card border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
              <AlertTriangle className="h-4 w-4" />
              مجموع وزن فعالیت‌ها {faPercent(totalWeight)} است و باید دقیقاً ۱۰۰ باشد.
            </div>
          ) : null}
          {d.consistency.hasWarning ? (
            <div className="mt-3 flex items-center gap-2 rounded-card border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
              <AlertTriangle className="h-4 w-4" />
              اختلاف بین آخرین پیشرفت واقعی ماهانه و پیشرفت واقعی پروژه بیش از حد مجاز است.
            </div>
          ) : null}

          <p className="mt-4 text-sm text-grayx-header">
            آخرین به‌روزرسانی پروژه: {isoToJalaliFa(first.updatedAt)}
          </p>
        </>
      ) : null}

      <h2 className="mt-8 mb-3 text-sm font-bold text-navy-900">میان‌برها</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <ShortcutCard href={`/admin/projects/${first.id}/activities`} icon={<Activity />} label="فعالیت‌ها" />
        <ShortcutCard href={`/admin/projects/${first.id}/monthly-progress`} icon={<ClipboardCheck />} label="پیشرفت ماهانه" />
        <ShortcutCard href={`/admin/projects/${first.id}/risks`} icon={<AlertTriangle />} label="ریسک‌ها" />
        <ShortcutCard href={`/admin/projects/${first.id}/decisions`} icon={<ListTodo />} label="تصمیمات" />
        <ShortcutCard href="/admin/import" icon={<FileSpreadsheet />} label="ورود از Excel" />
        <ShortcutCard href="/admin/users" icon={<Users />} label="کاربران" />
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warning?: boolean;
}): React.JSX.Element {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${warning ? 'bg-brand-orange/15 text-brand-orange' : 'bg-navy-800/10 text-navy-800'}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-grayx-header">{label}</p>
        <p className={`text-xl font-bold ${warning ? 'text-brand-orange' : 'text-navy-900'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ShortcutCard({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center gap-2 p-5 text-center transition-shadow hover:shadow-cardhover"
    >
      <div className="text-navy-700">{icon}</div>
      <span className="text-sm font-medium text-ink">{label}</span>
    </Link>
  );
}
