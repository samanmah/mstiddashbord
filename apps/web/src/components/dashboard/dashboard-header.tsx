'use client';

import type { ProjectDto } from '@ppm/contracts';
import {
  Building2,
  LogOut,
  Maximize2,
  Minimize2,
  Pencil,
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
    <header className="rounded-card bg-navy-900 px-4 py-3 text-white shadow-card md:px-6">
      <div className="flex flex-col gap-3 md:flex-row-reverse md:items-center md:justify-between">
        {/* سمت راست: عناوین */}
        <div className="min-w-0 text-right">
          <p className="text-xs text-white/70">پیشرفت پروژه استراتژیک</p>
          <h1 className="truncate text-lg font-bold text-brand-yellow md:text-xl">
            {project.titleFa}
          </h1>
          {project.titleEn ? (
            <p className="truncate text-sm text-white/80" dir="ltr">
              {project.titleEn}
            </p>
          ) : null}
        </div>

        {/* سمت چپ: لوگو و کارت‌ها */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
            <Building2 className="h-6 w-6 text-brand-yellow" aria-hidden />
          </div>
          <HeaderStat label="مسئول پروژه" value={orDash(project.projectManager)} />
          <HeaderStat label="کد پروژه" value={orDash(project.projectCode)} />
          <HeaderStat
            label="بودجه مصوب"
            value={`${faNumber(project.budgetBillionRial)} میلیارد ریال`}
          />
        </div>
      </div>

      {/* نوار ابزار */}
      <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarButton icon={<RefreshCw className="h-4 w-4" />} label="تازه‌سازی" onClick={onRefresh} />
          <ToolbarButton
            icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            label={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
            onClick={onToggleFullscreen}
          />
          <ToolbarButton
            icon={<Printer className="h-4 w-4" />}
            label="چاپ / PDF"
            onClick={() => window.print()}
          />
          {isEditor ? (
            <ToolbarButton
              icon={<Pencil className="h-4 w-4" />}
              label="ویرایش پروژه"
              onClick={() => router.push(`/admin/projects/${project.id}/general`)}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {lastSyncedAt ? (
            <span className="text-[11px] text-white/60">
              آخرین همگام‌سازی: {isoToJalaliFa(lastSyncedAt)} —{' '}
              {new Date(lastSyncedAt).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
          <ToolbarButton
            icon={<LogOut className="h-4 w-4" />}
            label="خروج"
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

function HeaderStat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-1.5 text-center">
      <p className="text-[10px] text-white/60">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
    >
      {icon}
      {label}
    </button>
  );
}
