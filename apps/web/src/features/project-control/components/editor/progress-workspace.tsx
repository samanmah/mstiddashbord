'use client';

import { ClipboardCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { orDash } from '@/lib/utils';
import type { WbsNodeComputedDto } from '../../api/project-control-types';
import { CONTROL_NODE_STATUS_LABELS } from '../../api/project-control-types';
import { useProgressList } from '../../hooks/use-control-progress';
import { useWbsList } from '../../hooks/use-control-wbs';
import { statusTone } from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import { formatPercent } from '../../utils/progress-format';
import { Drawer } from '../common/drawer';
import { ProgressDrawer } from './progress-drawer';

export function ProgressWorkspace({
  projectId,
  isEditor,
}: {
  projectId: string;
  isEditor: boolean;
}): React.JSX.Element {
  const wbs = useWbsList(projectId);
  const progress = useProgressList(projectId);
  const [selectedId, setSelectedId] = useState('');
  const [open, setOpen] = useState(false);

  const nodeMap = useMemo(() => {
    const m = new Map<string, WbsNodeComputedDto>();
    for (const n of wbs.data ?? []) m.set(n.id, n);
    return m;
  }, [wbs.data]);

  if (wbs.isLoading || progress.isLoading) {
    return <FullPageSpinner label="در حال بارگذاری پیشرفت…" />;
  }
  if (progress.isError) {
    return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  }

  const leaves = (wbs.data ?? []).filter((n) => n.computed?.isLeaf !== false);
  const selectedNode = selectedId ? nodeMap.get(selectedId) : undefined;
  const history = (progress.data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-3">
      {isEditor ? (
        <div className="card flex flex-wrap items-end gap-2 p-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-grayx-header">انتخاب فعالیت</label>
            <Select
              options={[
                { value: '', label: 'یک فعالیت انتخاب کنید…' },
                ...leaves.map((n) => ({
                  value: n.id,
                  label: `${n.code ? `${n.code} — ` : ''}${n.title}`,
                })),
              ]}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            />
          </div>
          <Button onClick={() => setOpen(true)} disabled={!selectedNode}>
            <ClipboardCheck className="h-4 w-4" /> ثبت پیشرفت
          </Button>
        </div>
      ) : null}

      {history.length === 0 ? (
        <EmptyState title="گزارش پیشرفتی ثبت نشده است" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-navy-800 text-white">
              <tr>
                <th className="px-3 py-2 text-right">فعالیت</th>
                <th className="px-3 py-2">تاریخ گزارش</th>
                <th className="px-3 py-2">درصد واقعی</th>
                <th className="px-3 py-2">فیزیکی</th>
                <th className="px-3 py-2">مالی</th>
                <th className="px-3 py-2">وضعیت</th>
                <th className="px-3 py-2 text-right">توضیح</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id} className="border-b border-borderx hover:bg-page">
                  <td className="px-3 py-2 text-right">
                    {orDash(nodeMap.get(p.nodeId)?.title ?? p.nodeId)}
                  </td>
                  <td className="px-3 py-2 text-center">{jalaliFa(p.reportingDate)}</td>
                  <td className="px-3 py-2 text-center">{formatPercent(p.actualPercent, 1)}</td>
                  <td className="px-3 py-2 text-center">{formatPercent(p.physicalProgress, 1)}</td>
                  <td className="px-3 py-2 text-center">{formatPercent(p.financialProgress, 1)}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge
                      tone={statusTone(p.status)}
                      label={CONTROL_NODE_STATUS_LABELS[p.status]}
                      showDot={false}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{orDash(p.comment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && selectedNode ? (
        <Drawer
          open
          onClose={() => setOpen(false)}
          title={`ثبت پیشرفت: ${selectedNode.title}`}
          subtitle={selectedNode.code ?? undefined}
        >
          <ProgressDrawer projectId={projectId} node={selectedNode} onDone={() => setOpen(false)} />
        </Drawer>
      ) : null}
    </div>
  );
}
