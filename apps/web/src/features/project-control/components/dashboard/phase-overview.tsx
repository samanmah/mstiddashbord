'use client';

import { ChevronLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PhaseRollupDto, WbsNodeComputedDto } from '../../api/project-control-types';
import { PHASE_COLORS, WbsNodeType } from '../../api/project-control-types';
import { statusLabel, statusTone } from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import {
  formatCount,
  formatMoney,
  formatPercent,
  formatVariance,
} from '../../utils/progress-format';
import { Drawer } from '../common/drawer';

/** رنگ ثابت فاز بر اساس ترتیب (۱..۷)، با چرخش برای فازهای بیشتر. */
function phaseColor(order: number): string {
  return PHASE_COLORS[(order - 1) % PHASE_COLORS.length] ?? PHASE_COLORS[0]!;
}

/** نمای کلی فازها به‌همراه Drill-down. */
export function PhaseOverview({
  phases,
  nodes,
}: {
  phases: PhaseRollupDto[];
  nodes: WbsNodeComputedDto[];
}): React.JSX.Element {
  const [selected, setSelected] = useState<PhaseRollupDto | null>(null);

  if (phases.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-grayx-header">فازی برای نمایش وجود ندارد.</p>
    );
  }

  return (
    <>
      <div
        data-testid="phase-overview"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {phases.map((phase) => (
          <PhaseCard
            key={phase.nodeId}
            phase={phase}
            color={phaseColor(phase.order)}
            onDrill={() => setSelected(phase)}
          />
        ))}
      </div>

      <Drawer
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? `جزئیات ${selected.title}` : ''}
        subtitle={selected?.code ?? undefined}
        width="lg"
      >
        {selected ? <PhaseDrillDown phase={selected} nodes={nodes} /> : null}
      </Drawer>
    </>
  );
}

function PhaseCard({
  phase,
  color,
  onDrill,
}: {
  phase: PhaseRollupDto;
  color: string;
  onDrill: () => void;
}): React.JSX.Element {
  const planned = phase.plannedProgress ?? 0;
  const actual = phase.actualProgress ?? 0;
  return (
    <button
      type="button"
      data-testid="phase-card"
      onClick={onDrill}
      className="card group flex flex-col gap-3 p-4 text-right transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {formatCount(phase.order)}
          </span>
          <h3 className="mt-1 truncate text-sm font-bold text-navy-900">{phase.title}</h3>
        </div>
        <StatusBadge tone={statusTone(phase.status)} label={statusLabel(phase.status)} />
      </div>

      {/* نوار پیشرفت دوگانه */}
      <div className="space-y-1">
        <ProgressBar label="برنامه" value={planned} color="#2D9CDB" />
        <ProgressBar label="واقعی" value={actual} color={color} />
      </div>

      <div className="grid grid-cols-3 gap-1 text-center text-[11px] text-grayx-header">
        <Metric label="انحراف" value={formatVariance(phase.variancePercent)} />
        <Metric label="وزن" value={formatPercent(phase.weight)} />
        <Metric label="فعالیت" value={formatCount(phase.taskCount)} />
        <Metric label="تکمیل" value={formatCount(phase.completedCount)} />
        <Metric label="تأخیر" value={formatCount(phase.delayedCount)} />
        <Metric label="بودجه" value={formatMoney(phase.budgetAmount)} />
      </div>

      <span className="flex items-center justify-center gap-1 text-[11px] font-medium text-brand-blue opacity-0 transition-opacity group-hover:opacity-100">
        مشاهده جزئیات <ChevronLeft className="h-3 w-3" aria-hidden />
      </span>
    </button>
  );
}

function ProgressBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[10px] text-grayx-header">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 shrink-0 text-[10px] tabular-nums text-navy-900">
        {formatPercent(value)}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded bg-surface px-1 py-0.5">
      <div className="text-[9px]">{label}</div>
      <div className="font-bold tabular-nums text-navy-900">{value}</div>
    </div>
  );
}

function PhaseDrillDown({
  phase,
  nodes,
}: {
  phase: PhaseRollupDto;
  nodes: WbsNodeComputedDto[];
}): React.JSX.Element {
  const detail = useMemo(() => {
    const phaseNode = nodes.find((n) => n.id === phase.nodeId);
    if (!phaseNode) return { breaks: [], critical: [], milestones: [], owners: [] };
    const prefix = `${phaseNode.materializedPath}/`;
    const desc = nodes.filter((n) => n.materializedPath.startsWith(prefix));
    const breaks = desc.filter((n) => n.nodeType === WbsNodeType.BREAK1);
    const critical = desc.filter((n) => n.computed?.isCritical === true);
    const milestones = desc.filter((n) => n.nodeType === WbsNodeType.MILESTONE);
    const owners = [...new Set(desc.map((n) => n.ownerText?.trim()).filter(Boolean))] as string[];
    return { breaks, critical, milestones, owners };
  }, [phase, nodes]);

  return (
    <div className="space-y-5 text-sm">
      <Section title={`شکست‌های سطح دوم (${formatCount(detail.breaks.length)})`}>
        {detail.breaks.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {detail.breaks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 rounded bg-surface px-2 py-1"
              >
                <span className="truncate">{b.title}</span>
                <StatusBadge
                  tone={statusTone(b.computed?.status)}
                  label={formatPercent(b.computed?.actualProgress)}
                  showDot={false}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`فعالیت‌های بحرانی (${formatCount(detail.critical.length)})`}>
        {detail.critical.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {detail.critical.slice(0, 20).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-grayx-header">
                  {jalaliFa(t.plannedFinish)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`نقاط عطف (${formatCount(detail.milestones.length)})`}>
        {detail.milestones.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {detail.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="truncate">◆ {m.title}</span>
                <span className="shrink-0 text-xs text-grayx-header">
                  {jalaliFa(m.plannedFinish)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`مسئولان (${formatCount(detail.owners.length)})`}>
        {detail.owners.length === 0 ? (
          <Empty />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {detail.owners.map((o) => (
              <span key={o} className="rounded-full bg-surface px-2 py-0.5 text-xs">
                {o}
              </span>
            ))}
          </div>
        )}
      </Section>

      <div className="rounded-card border border-borderx p-3">
        <span className="text-xs text-grayx-header">بودجه فاز</span>
        <p className="text-lg font-bold tabular-nums text-navy-900">
          {formatMoney(phase.budgetAmount)} <span className="text-xs font-normal">ریال</span>
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <h4 className={cn('mb-2 text-xs font-bold text-navy-800')}>{title}</h4>
      {children}
    </div>
  );
}

function Empty(): React.JSX.Element {
  return <p className="px-2 text-xs text-grayx-header">موردی وجود ندارد.</p>;
}
