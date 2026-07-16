'use client';

import { EmptyState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/badge';
import type { WbsNodeComputedDto } from '../../api/project-control-types';
import { statusLabel, statusTone } from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import { formatDelayDays, formatPercent } from '../../utils/progress-format';

/** جدول فعالیت‌های بحرانی و تأخیردار. */
export function CriticalTasksTable({
  tasks,
}: {
  tasks: WbsNodeComputedDto[];
}): React.JSX.Element {
  if (tasks.length === 0) {
    return <EmptyState title="فعالیت بحرانی یا تأخیرداری وجود ندارد" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-borderx text-xs text-grayx-header">
            <Th>WBS</Th>
            <Th className="text-right">فعالیت</Th>
            <Th>مسئول</Th>
            <Th>پایان برنامه</Th>
            <Th>پایان پیش‌بینی</Th>
            <Th>تأخیر (روز)</Th>
            <Th>برنامه</Th>
            <Th>واقعی</Th>
            <Th>وضعیت</Th>
            <Th>بحرانی</Th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-borderx/60 hover:bg-surface">
              <Td className="tabular-nums text-grayx-header">{t.code ?? t.outlineNumber ?? '—'}</Td>
              <Td className="max-w-[220px] truncate text-right font-medium">{t.title}</Td>
              <Td>{t.ownerText ?? '—'}</Td>
              <Td className="tabular-nums">{jalaliFa(t.plannedFinish)}</Td>
              <Td className="tabular-nums">{jalaliFa(t.forecastFinish)}</Td>
              <Td className="tabular-nums text-brand-red">
                {formatDelayDays(t.computed?.finishVarianceDays)}
              </Td>
              <Td className="tabular-nums">{formatPercent(t.computed?.plannedProgress)}</Td>
              <Td className="tabular-nums">{formatPercent(t.computed?.actualProgress)}</Td>
              <Td>
                <StatusBadge
                  tone={statusTone(t.computed?.status)}
                  label={statusLabel(t.computed?.status)}
                  showDot={false}
                />
              </Td>
              <Td>{t.computed?.isCritical ? '●' : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <th className={`px-2 py-2 text-center font-medium ${className ?? ''}`}>{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <td className={`px-2 py-1.5 text-center ${className ?? ''}`}>{children}</td>;
}
