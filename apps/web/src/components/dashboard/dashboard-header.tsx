'use client';

import type { ProjectDto } from '@ppm/contracts';
import {
  BriefcaseBusiness,
  Hash,
  Landmark,
  LogOut,
  Maximize2,
  Minimize2,
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

interface Props {
  project: ProjectDto;
  isFullscreen: boolean;
  lastSyncedAt: string | null;
  onToggleFullscreen: () => void;
  onRefresh: () => void;
}

export function DashboardHeader({
  project,
  isFullscreen,
  lastSyncedAt,
  onToggleFullscreen,
  onRefresh,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { isEditor, clear } = useAuth();

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
      {/* Highlight بسیار ظریف آبی در گوشه بالا */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 h-48 w-[36rem] rounded-full bg-accent-blue/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 md:flex-row-reverse md:items-center md:justify-between">
        {/* سمت راست: عناوین */}
        <div className="min-w-0 text-right">
          <p className="text-xs font-medium tracking-wide text-white/70">
            پیشرفت پروژه استراتژیک
          </p>
          <h1
            data-testid="dashboard-project-title"
            className="truncate text-lg font-extrabold text-brand-yellow md:text-2xl"
          >
            {project.titleFa}
          </h1>
          {project.titleEn ? (
            <p className="truncate text-sm text-white/60" dir="ltr">
              {project.titleEn}
            </p>
          ) : null}
        </div>

        {/* سمت چپ: لوگو و کارت‌ها */}
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
            value={orDash(project.projectCode)}
          />
          <HeaderStat
            icon={<Landmark className="h-4 w-4" aria-hidden />}
            tone="text-accent-emerald"
            label="بودجه مصوب"
            value={`${faNumber(project.budgetBillionRial)} میلیارد ریال`}
          />
        </div>
      </div>

      {/* نوار ابزار */}
      <div className="no-print relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarButton
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
            label="تازه‌سازی"
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
            onClick={onToggleFullscreen}
          />
          <ToolbarButton
            icon={<Printer className="h-4 w-4" aria-hidden />}
            label="چاپ / PDF"
            onClick={() => window.print()}
          />
          {isEditor ? (
            <ToolbarButton
              variant="primary"
              icon={<PencilLine className="h-4 w-4" aria-hidden />}
              label="ویرایش پروژه"
              onClick={() => router.push(`/admin/projects/${project.id}/general`)}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {lastSyncedAt ? (
            <span className="text-[11px] text-white/55">
              آخرین همگام‌سازی: {isoToJalaliFa(lastSyncedAt)} —{' '}
              {new Date(lastSyncedAt).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
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

function HeaderStat({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-1.5 ring-1 ring-inset ring-white/10">
      <span className={`section-icon bg-white/10 ${tone}`}>{icon}</span>
      <div className="text-right">
        <p className="text-[10px] text-white/55">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
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
