'use client';

import { CheckCircle2, Circle, Diamond, TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/badge';
import type { MilestoneSummary, WbsNodeComputedDto } from '../../api/project-control-types';
import { ControlNodeStatus, WbsNodeType } from '../../api/project-control-types';
import { statusLabel, statusTone } from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import { formatCount } from '../../utils/progress-format';

/** خلاصه و جدول زمانی نقاط عطف. */
export function MilestonesPanel({
  summary,
  nodes,
}: {
  summary: MilestoneSummary;
  nodes: WbsNodeComputedDto[];
}): React.JSX.Element {
  const milestones = nodes
    .filter((n) => n.nodeType === WbsNodeType.MILESTONE)
    .sort((a, b) => (a.plannedFinish ?? '').localeCompare(b.plannedFinish ?? ''));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <SummaryStat
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          label="تکمیل‌شده"
          value={summary.completed}
          tone="text-brand-green"
        />
        <SummaryStat
          icon={<Circle className="h-4 w-4" aria-hidden />}
          label="پیش‌رو"
          value={summary.upcoming}
          tone="text-brand-blue"
        />
        <SummaryStat
          icon={<TriangleAlert className="h-4 w-4" aria-hidden />}
          label="تأخیردار"
          value={summary.delayed}
          tone="text-brand-red"
        />
      </div>

      {milestones.length === 0 ? (
        <EmptyState title="نقطه عطفی ثبت نشده است" />
      ) : (
        <ul className="space-y-1.5">
          {milestones.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-card border border-borderx px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Diamond
                  className="h-3.5 w-3.5 shrink-0"
                  style={{
                    color:
                      m.computed?.status === ControlNodeStatus.COMPLETED ? '#16a34a' : '#7c3aed',
                  }}
                  aria-hidden
                />
                <span className="truncate text-sm">{m.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs tabular-nums text-grayx-header">
                  {jalaliFa(m.plannedFinish)}
                </span>
                <StatusBadge
                  tone={statusTone(m.computed?.status)}
                  label={statusLabel(m.computed?.status)}
                  showDot={false}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}): React.JSX.Element {
  return (
    <div className="rounded-card border border-borderx p-2">
      <div className={`flex items-center justify-center gap-1 ${tone}`}>{icon}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-navy-900">{formatCount(value)}</div>
      <div className="text-[11px] text-grayx-header">{label}</div>
    </div>
  );
}
