'use client';

import { useQuery } from '@tanstack/react-query';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';

export default function DashboardPage(): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectService.list,
  });

  if (isLoading) {
    return <FullPageSpinner label="در حال بارگذاری پروژه‌ها…" />;
  }
  if (isError) {
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  const first = data?.[0];
  if (!first) {
    return (
      <div className="p-6">
        <EmptyState
          title="هنوز پروژه‌ای ثبت نشده است"
          description="برای شروع، یک فایل Excel وارد کنید یا پروژه جدیدی بسازید."
        />
      </div>
    );
  }

  return <DashboardView projectId={first.id} />;
}
