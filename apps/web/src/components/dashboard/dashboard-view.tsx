'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  LazyActivityBarChart,
  LazyActivityTimeline,
  LazyMonthlyLineChart,
} from '@/components/charts/lazy';
import { ActivitiesTable } from '@/components/dashboard/activities-table';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DecisionsTable } from '@/components/dashboard/decisions-table';
import { IndicatorCard } from '@/components/dashboard/indicator-card';
import { OverallStatusCard } from '@/components/dashboard/overall-status-card';
import { ProjectInfoCard } from '@/components/dashboard/project-info-card';
import { RisksTable } from '@/components/dashboard/risks-table';
import { Card } from '@/components/ui/card';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { ProjectSelector } from '@/components/dashboard/project-selector';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { projectService } from '@/lib/services';

const AUTO_REFRESH_MS = 60_000;

export function DashboardView({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.dashboard(projectId),
    queryFn: () => projectService.dashboard(projectId),
    refetchInterval: () => {
      // توقف Auto Refresh هنگام باز بودن Modal
      if (typeof document !== 'undefined' && document.body.dataset.modalOpen === 'true') {
        return false;
      }
      return AUTO_REFRESH_MS;
    },
  });

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next && document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => undefined);
        } else if (!next && document.fullscreenElement && document.exitFullscreen) {
          void document.exitFullscreen().catch(() => undefined);
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onFsChange = (): void => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleRefresh = useCallback(() => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
    toast.success('اطلاعات به‌روزرسانی شد');
  }, [refetch, queryClient, projectId]);

  if (isLoading) {
    return <FullPageSpinner label="در حال بارگذاری داشبورد…" />;
  }
  if (isError || !data) {
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className={cn('mx-auto max-w-[1600px] space-y-3 p-3 md:p-4', isFullscreen && 'max-w-none')}>
      <div className="no-print">
        <ProjectSelector currentId={projectId} />
      </div>

      <DashboardHeader
        project={data.project}
        isFullscreen={isFullscreen}
        lastSyncedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : data.generatedAt}
        onToggleFullscreen={toggleFullscreen}
        onRefresh={handleRefresh}
      />

      {data.consistency.hasWarning ? (
        <div className="no-print rounded-card border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-sm text-brand-orange">
          اختلاف بین آخرین پیشرفت واقعی ماهانه و پیشرفت واقعی پروژه بیش از حد مجاز است.
        </div>
      ) : null}

      {/* ردیف اول */}
      <div className="grid grid-cols-1 gap-3 print-grid md:grid-cols-3">
        <ProjectInfoCard project={data.project} />
        <OverallStatusCard summary={data.summary} />
        <IndicatorCard summary={data.indicatorSummary} />
      </div>

      {/* ردیف دوم */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="وضعیت پیشرفت فعالیت‌ها" headerTone="orange" bodyClassName="p-0 sm:p-2">
          <ActivitiesTable activities={data.activities} />
        </Card>
        <Card title="روند پیشرفت ماهیانه پروژه" headerTone="navy">
          <LazyMonthlyLineChart data={data.monthlyProgress} />
        </Card>
      </div>

      {/* ردیف سوم */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="تصمیمات جلسات گذشته" headerTone="navy" bodyClassName="p-0 sm:p-2">
          <DecisionsTable decisions={data.decisions} />
        </Card>
        <Card title="چالش‌ها و ریسک‌های بحرانی" headerTone="orange" bodyClassName="p-0 sm:p-2">
          <RisksTable risks={data.risks} />
        </Card>
      </div>

      {/* ردیف تحلیلی */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="مقایسه برنامه و عملکرد فعالیت‌ها" headerTone="navy">
          <LazyActivityBarChart data={data.activities} />
        </Card>
        <Card title="تقویم و مسیر اجرای فعالیت‌ها" headerTone="orange">
          <LazyActivityTimeline
            activities={data.activities}
            reportDateIso={data.project.reportDate}
          />
        </Card>
      </div>

      <DashboardLegend />
    </div>
  );
}

function DashboardLegend(): React.JSX.Element {
  const items: { color: string; label: string }[] = [
    { color: '#20A55A', label: 'خوب / انجام شد' },
    { color: '#F57C00', label: 'متوسط / در حال اجرا' },
    { color: '#E53935', label: 'ضعیف / ریسک بالا' },
    { color: '#FFD400', label: 'ریسک پایین' },
    { color: '#2D9CDB', label: 'جدید' },
    { color: '#8E5BD9', label: 'در انتظار گزارش' },
    { color: '#9AA6B2', label: 'نامشخص / سایر' },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-card bg-white/60 px-4 py-2 text-[11px] text-grayx-header">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
