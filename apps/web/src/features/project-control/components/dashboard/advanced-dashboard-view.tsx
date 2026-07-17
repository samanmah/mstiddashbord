'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Diamond,
  Gauge,
  LayoutGrid,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { DecisionsTable } from '@/components/dashboard/decisions-table';
import { RisksTable } from '@/components/dashboard/risks-table';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { queryKeys } from '@/lib/query-keys';
import { decisionService, projectService, riskService } from '@/lib/services';
import { cn } from '@/lib/utils';
import type { DecisionDto, RiskDto } from '@ppm/contracts';
import { controlKeys } from '../../api/project-control-query-keys';
import type { WbsNodeComputedDto } from '../../api/project-control-types';
import { WbsNodeType } from '../../api/project-control-types';
import { useBaselines } from '../../hooks/use-control-baselines';
import { useControlDashboard, useSCurve } from '../../hooks/use-control-dashboard';
import { useControlGantt } from '../../hooks/use-control-gantt';
import { GanttChart } from '../gantt/gantt-chart';
import { AdvancedDashboardHeader } from './advanced-dashboard-header';
import { CriticalTasksTable } from './critical-tasks-table';
import { DashboardDataQuality } from './dashboard-data-quality';
import { EarnedValuePanel } from './earned-value-panel';
import { ExecutiveKpis } from './executive-kpis';
import { MilestonesPanel } from './milestones-panel';
import { OwnerWorkloadTable } from './owner-workload-table';
import { PhaseComparisonChart } from './phase-comparison-chart';
import { PhaseOverview } from './phase-overview';
import { SCurveChart } from './s-curve-chart';

const AUTO_REFRESH_MS = 60_000;

/** داشبورد مدیریتی «کنترل پروژهٔ پیشرفته» (Read-only). */
export function AdvancedDashboardView({ projectId }: { projectId: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const { isEditor, isLoading: isAuthLoading } = useAuth();
  /** فقط پس از اتمام auth/me — جلوگیری از Flash دکمهٔ ویرایش برای Viewer */
  const showEditorActions = !isAuthLoading && isEditor;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWallboard, setIsWallboard] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const dashboardQuery = useControlDashboard(projectId);
  const sCurveQuery = useSCurve(projectId);
  const ganttQuery = useControlGantt(projectId);
  const baselinesQuery = useBaselines(projectId);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectService.get(projectId),
    staleTime: 300_000,
  });
  const risksQuery = useQuery({
    queryKey: queryKeys.risks(projectId),
    queryFn: () => riskService.list(projectId),
  });
  const decisionsQuery = useQuery({
    queryKey: queryKeys.decisions(projectId),
    queryFn: () => decisionService.list(projectId),
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

  useEffect(() => {
    if (!isWallboard) return;
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: controlKeys.dashboard(projectId) });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [isWallboard, projectId, queryClient]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: controlKeys.root(projectId) });
    void dashboardQuery.refetch();
    toast.success('اطلاعات به‌روزرسانی شد');
  }, [queryClient, projectId, dashboardQuery]);

  const nodes: WbsNodeComputedDto[] = useMemo(
    () => ganttQuery.data?.nodes ?? [],
    [ganttQuery.data],
  );
  const rootComputed = useMemo(() => {
    const root =
      nodes.find((n) => n.nodeType === WbsNodeType.PROJECT) ??
      nodes.find((n) => n.depth === 0);
    return root?.computed ?? null;
  }, [nodes]);

  const activeBaselineTitle = useMemo(() => {
    const active = baselinesQuery.data?.find((b) => b.isActive);
    return active?.title ?? null;
  }, [baselinesQuery.data]);

  const criticalAndDelayed = useMemo(() => {
    const d = dashboardQuery.data;
    if (!d) return [];
    const map = new Map<string, WbsNodeComputedDto>();
    for (const t of [...d.criticalTasks, ...d.delayedTasks]) map.set(t.id, t);
    let list = [...map.values()];
    if (phaseFilter !== 'ALL') {
      const phaseNode = nodes.find((n) => n.id === phaseFilter);
      if (phaseNode) {
        const prefix = `${phaseNode.materializedPath}/`;
        const allowed = new Set(
          nodes.filter((n) => n.materializedPath.startsWith(prefix)).map((n) => n.id),
        );
        list = list.filter((t) => allowed.has(t.id));
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.ownerText ?? '').toLowerCase().includes(q) ||
          (t.code ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [dashboardQuery.data, nodes, phaseFilter, search]);

  if (dashboardQuery.isLoading) {
    return <FullPageSpinner label="در حال بارگذاری داشبورد کنترل پروژه…" />;
  }
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="p-6">
        <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} />
      </div>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div
      data-testid="advanced-dashboard"
      className={cn(
        'mx-auto max-w-[1600px] space-y-4 p-3 md:p-5',
        (isFullscreen || isWallboard) && 'max-w-none',
      )}
    >
      <AdvancedDashboardHeader
        dashboard={data}
        projectId={projectId}
        isEditor={showEditorActions}
        projectCode={projectQuery.data?.projectCode}
        activeBaselineTitle={activeBaselineTitle}
        isFullscreen={isFullscreen}
        isWallboard={isWallboard}
        onToggleFullscreen={toggleFullscreen}
        onToggleWallboard={() => setIsWallboard((v) => !v)}
        onRefresh={handleRefresh}
      />

      {/* شاخص‌های کلیدی مدیریتی */}
      <Section icon={<Gauge className="h-[18px] w-[18px]" aria-hidden />} title="شاخص‌های کلیدی">
        <ExecutiveKpis kpis={data.executiveKpis} />
      </Section>

      {/* نمای فازها */}
      <Card
        title={<CardTitle icon={<LayoutGrid className="h-[18px] w-[18px]" aria-hidden />}>نمای کلی فازها</CardTitle>}
        headerTone="navy"
        className="border-t-2 border-t-accent-blue"
      >
        <PhaseOverview phases={data.phaseRollups} nodes={nodes} />
      </Card>

      {/* مقایسه فازها + منحنی S */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={<CardTitle icon={<BarChart3 className="h-[18px] w-[18px]" aria-hidden />}>مقایسه برنامه و عملکرد فازها</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-emerald"
        >
          <PhaseComparisonChart
            phases={data.phaseRollups}
            onSelect={(p) => setPhaseFilter(p.nodeId)}
          />
        </Card>
        <Card
          title={<CardTitle icon={<TrendingUp className="h-[18px] w-[18px]" aria-hidden />}>منحنی پیشرفت (S-Curve)</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-cyan"
        >
          <SCurveChart
            points={sCurveQuery.data ?? []}
            statusDate={data.controlPlan.statusDate}
          />
        </Card>
      </div>

      {/* EVM + Milestones */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={<CardTitle icon={<Gauge className="h-[18px] w-[18px]" aria-hidden />}>تحلیل ارزش کسب‌شده (EVM)</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-violet"
        >
          <EarnedValuePanel root={rootComputed} />
        </Card>
        <Card
          title={<CardTitle icon={<Diamond className="h-[18px] w-[18px]" aria-hidden />}>نقاط عطف</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-indigo"
        >
          <MilestonesPanel summary={data.milestoneSummary} nodes={nodes} />
        </Card>
      </div>

      {/* فعالیت‌های بحرانی/تأخیردار با فیلتر */}
      <Card
        title={<CardTitle icon={<TriangleAlert className="h-[18px] w-[18px]" aria-hidden />}>فعالیت‌های بحرانی و تأخیردار</CardTitle>}
        headerTone="navy"
        className="border-t-2 border-t-accent-red"
        headerAction={
          <div className="no-print flex items-center gap-2">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="rounded-md border-none bg-white/15 px-2 py-1 text-xs text-white outline-none"
              aria-label="فیلتر فاز"
            >
              <option value="ALL" className="text-navy-900">همه فازها</option>
              {data.phaseRollups.map((p) => (
                <option key={p.nodeId} value={p.nodeId} className="text-navy-900">
                  {p.title}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو…"
              className="w-28 rounded-md border-none bg-white/15 px-2 py-1 text-xs text-white placeholder:text-white/60 outline-none"
              aria-label="جستجو در فعالیت‌ها"
            />
          </div>
        }
        bodyClassName="p-0 sm:p-2"
      >
        <CriticalTasksTable tasks={criticalAndDelayed} />
      </Card>

      {/* بار کاری مسئولان + کیفیت داده */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={<CardTitle icon={<Users className="h-[18px] w-[18px]" aria-hidden />}>بار کاری مسئولان</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-sky"
          bodyClassName="p-0 sm:p-2"
        >
          <OwnerWorkloadTable rows={data.ownerWorkload} />
        </Card>
        <Card
          title={<CardTitle icon={<ShieldCheck className="h-[18px] w-[18px]" aria-hidden />}>کیفیت داده</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-violet"
        >
          <DashboardDataQuality report={data.dataQuality} />
        </Card>
      </div>

      {/* گانت (نمای فقط‌خواندنی) — در چاپ حذف می‌شود */}
      <Card
        title={<CardTitle icon={<CalendarRange className="h-[18px] w-[18px]" aria-hidden />}>گانت پروژه</CardTitle>}
        headerTone="navy"
        className="border-t-2 border-t-accent-indigo no-print"
      >
        <GanttChart projectId={projectId} mode="viewer" />
      </Card>

      {/* ریسک و تصمیم (حفظ‌شده) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={<CardTitle icon={<ClipboardCheck className="h-[18px] w-[18px]" aria-hidden />}>تصمیمات جلسات</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-violet"
          bodyClassName="p-0 sm:p-2"
        >
          <DecisionsTable decisions={(decisionsQuery.data as DecisionDto[]) ?? []} />
        </Card>
        <Card
          title={<CardTitle icon={<TriangleAlert className="h-[18px] w-[18px]" aria-hidden />}>ریسک‌های بحرانی</CardTitle>}
          headerTone="navy"
          className="border-t-2 border-t-accent-red"
          bodyClassName="p-0 sm:p-2"
        >
          <RisksTable risks={(risksQuery.data as RiskDto[]) ?? []} />
        </Card>
      </div>

      {showEditorActions ? (
        <p
          data-testid="editor-readonly-notice"
          className="no-print flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-grayx-header"
        >
          <span>این داشبورد نمای مدیریتی و فقط‌خواندنی است.</span>
          <Link
            href={`/admin/projects/${projectId}/control`}
            data-testid="edit-project-footer-link"
            className="font-medium text-accent-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-1"
          >
            ورود به ویرایش پروژه
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
        <span className="section-icon bg-navy-800 text-white">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function CardTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span className="section-icon bg-white/10 text-white">{icon}</span>
      {children}
    </span>
  );
}
