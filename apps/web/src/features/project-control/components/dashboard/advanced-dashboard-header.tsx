'use client';

import {
  BriefcaseBusiness,
  CalendarCheck,
  GitBranch,
  Hash,
  Landmark,
  LogOut,
  Maximize2,
  Minimize2,
  MonitorPlay,
  PencilLine,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/lib/services';
import { faNumber, isoToJalaliFa, orDash } from '@/lib/utils';
import type { ControlDashboard } from '../../api/project-control-types';
import { jalaliFa } from '../../utils/date-format';

interface Props {
  dashboard: ControlDashboard;
  projectId: string;
  isEditor: boolean;
  projectCode?: string | null;
  activeBaselineTitle?: string | null;
  isFullscreen: boolean;
  isWallboard: boolean;
  onToggleFullscreen: () => void;
  onToggleWallboard: () => void;
  onRefresh: () => void;
}

/** هدر داشبورد مدیریتی «کنترل پروژه» (Read-only). */
export function AdvancedDashboardHeader({
  dashboard,
  projectId,
  isEditor,
  projectCode,
  activeBaselineTitle,
  isFullscreen,
  isWallboard,
  onToggleFullscreen,
  onToggleWallboard,
  onRefresh,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { clear } = useAuth();
  const { project, controlPlan, lastUpdatedAt } = dashboard;

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      clear();
      router.replace('/login');
    },
    onError: () => {
      clear();
      router.replace('/login');
    },
  });

  return (
    <header className="relative overflow-hidden rounded-card bg-gradient-to-bl from-navy-950 via-navy-900 to-navy-800 px-4 py-4 text-white shadow-card ring-1 ring-inset ring-white/10 md:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 h-48 w-[36rem] rounded-full bg-accent-blue/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 md:flex-row-reverse md:items-center md:justify-between">
        <div className="min-w-0 flex-1 text-right">
          <p className="text-xs font-medium tracking-wide text-white/70">
            داشبورد کنترل پروژهٔ پیشرفته
          </p>
          <h1
            data-testid="dashboard-project-title"
            dir="auto"
            className="line-clamp-2 text-[clamp(1rem,2.6vw,1.5rem)] font-extrabold leading-snug text-brand-yellow [overflow-wrap:anywhere]"
          >
            {project.titleFa}
          </h1>
          {project.titleEn ? (
            <p
              data-testid="dashboard-project-title-en"
              dir="ltr"
              className="mt-0.5 line-clamp-2 text-left text-[clamp(0.75rem,1.8vw,0.875rem)] leading-snug text-white/60 [overflow-wrap:anywhere]"
            >
              {project.titleEn}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-12 items-center justify-center rounded-xl bg-white px-3 shadow-sm">
            <img
              src="/logo-mobarakeh.png"
              alt="فولاد مبارکه اصفهان"
              className="h-8 w-auto object-contain"
            />
          </div>
          <HeaderStat
            icon={<BriefcaseBusiness className="h-4 w-4" aria-hidden />}
            tone="text-accent-sky"
            label="مسئول پروژه"
            value={orDash(project.projectManager)}
          />
          <HeaderStat
            icon={<Hash className="h-4 w-4" aria-hidden />}
            tone="text-accent-violet"
            label="کد پروژه"
            value={orDash(projectCode)}
          />
          <HeaderStat
            icon={<Landmark className="h-4 w-4" aria-hidden />}
            tone="text-accent-emerald"
            label="بودجه مصوب پروژه"
            value={`${faNumber(project.budgetBillionRial ?? 0)} میلیارد ریال`}
            title={`بودجه مصوب پروژه: ${faNumber(project.budgetBillionRial ?? 0)} میلیارد ریال`}
          />
        </div>
      </div>

      {/* نوار وضعیت + ابزار */}
      <div className="no-print relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isEditor ? (
            <ToolbarButton
              icon={<PencilLine className="h-4 w-4" aria-hidden />}
              label="ویرایش پروژه"
              variant="primary"
              testId="edit-project-button"
              onClick={() => {
                router.push(`/admin/projects/${projectId}/control`);
              }}
            />
          ) : null}
          <ToolbarButton
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
            label="تازه‌سازی"
            testId="refresh-dashboard-button"
            onClick={onRefresh}
          />
          <ToolbarButton
            icon={
              isFullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden />
              )
            }
            label={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
            testId="fullscreen-dashboard-button"
            onClick={onToggleFullscreen}
          />
          <ToolbarButton
            icon={<MonitorPlay className="h-4 w-4" aria-hidden />}
            label={isWallboard ? 'حالت عادی' : 'حالت نمایشگر'}
            testId="wallboard-dashboard-button"
            onClick={onToggleWallboard}
            variant={isWallboard ? 'primary' : 'ghost'}
          />
          <ToolbarButton
            icon={<Printer className="h-4 w-4" aria-hidden />}
            label="چاپ / PDF"
            testId="print-dashboard-button"
            onClick={() => window.print()}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70">
          <MetaChip
            icon={<CalendarCheck className="h-3.5 w-3.5" aria-hidden />}
            label="تاریخ وضعیت"
            value={jalaliFa(controlPlan.statusDate)}
          />
          <MetaChip
            icon={<GitBranch className="h-3.5 w-3.5" aria-hidden />}
            label="خط مبنای فعال"
            value={activeBaselineTitle ?? '—'}
          />
          {lastUpdatedAt ? (
            <span className="text-white/55">
              آخرین به‌روزرسانی: {isoToJalaliFa(lastUpdatedAt)}
            </span>
          ) : null}
          <ToolbarButton
            icon={<LogOut className="h-4 w-4" aria-hidden />}
            label="خروج"
            testId="logout-button"
            onClick={() => {
              toast.info('در حال خروج…');
              logoutMutation.mutate();
            }}
          />
        </div>
      </div>
    </header>
  );
}

function MetaChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1 rounded-lg bg-white/[0.08] px-2 py-1 ring-1 ring-inset ring-white/10">
      {icon}
      <span className="text-white/55">{label}:</span>
      <span className="font-bold text-white">{value}</span>
    </span>
  );
}

function HeaderStat({
  icon,
  tone,
  label,
  value,
  title,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  title?: string;
}): React.JSX.Element {
  return (
    <div
      title={title ?? `${label}: ${value}`}
      className="flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-1.5 ring-1 ring-inset ring-white/10"
    >
      <span className={`section-icon shrink-0 bg-white/10 ${tone}`}>{icon}</span>
      <div className="min-w-0 text-right">
        <p className="text-[10px] text-white/55">{label}</p>
        <p className="truncate text-[clamp(0.7rem,1.6vw,0.875rem)] font-bold tabular-nums text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  variant = 'ghost',
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'primary';
  testId?: string;
}): React.JSX.Element {
  const base =
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-1 focus-visible:ring-offset-navy-900';
  const styles =
    variant === 'primary'
      ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
      : 'bg-white/10 text-white hover:bg-white/20';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      className={`${base} ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}
