'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import {
  DependencyType,
  type TaskDependencyDto,
  type WbsNodeComputedDto,
} from '../../api/project-control-types';
import {
  useCreateDependency,
  useDeleteDependency,
  useDependencies,
} from '../../hooks/use-control-dependencies';
import { useWbsList } from '../../hooks/use-control-wbs';
import { formatLagFa, lagDaysToMinutes, lagMinutesToDays } from '../../utils/date-format';

const TYPE_OPTIONS = Object.values(DependencyType).map((t) => ({ value: t, label: t }));

/** بررسی چرخه سمت Client: افزودن pred→succ اگر مسیری از succ به pred باشد چرخه می‌سازد. */
function createsCycle(
  deps: TaskDependencyDto[],
  predecessorId: string,
  successorId: string,
): boolean {
  if (predecessorId === successorId) return true;
  const adj = new Map<string, string[]>();
  for (const d of deps) {
    const arr = adj.get(d.predecessorNodeId) ?? [];
    arr.push(d.successorNodeId);
    adj.set(d.predecessorNodeId, arr);
  }
  // آیا از successor می‌توان به predecessor رسید؟
  const stack = [successorId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === predecessorId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

export function DependenciesEditor({
  projectId,
  isEditor,
}: {
  projectId: string;
  isEditor: boolean;
}): React.JSX.Element {
  const deps = useDependencies(projectId);
  const wbs = useWbsList(projectId);
  const createDep = useCreateDependency(projectId);
  const deleteDep = useDeleteDependency(projectId);

  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDependencyDto | null>(null);
  const [search, setSearch] = useState('');

  const nodeMap = useMemo(() => {
    const m = new Map<string, WbsNodeComputedDto>();
    for (const n of wbs.data ?? []) m.set(n.id, n);
    return m;
  }, [wbs.data]);

  const label = (id: string): string => {
    const n = nodeMap.get(id);
    if (!n) return id;
    return `${n.code ? `${n.code} — ` : ''}${n.title}`;
  };

  if (deps.isLoading || wbs.isLoading) return <FullPageSpinner label="در حال بارگذاری روابط…" />;
  if (deps.isError) return <ErrorState error={deps.error} onRetry={() => void deps.refetch()} />;

  const rows = (deps.data ?? []).filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${label(d.predecessorNodeId)} ${label(d.successorNodeId)}`.toLowerCase().includes(q);
  });
  const validIds = new Set((wbs.data ?? []).map((n) => n.id));

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Input
          placeholder="جستجو در روابط…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />
        {isEditor ? (
          <Button size="sm" className="ms-auto" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> افزودن رابطه
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="رابطه‌ای ثبت نشده است" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-navy-800 text-white">
              <tr>
                <th className="px-3 py-2 text-right">پیش‌نیاز</th>
                <th className="px-3 py-2 text-right">پس‌نیاز</th>
                <th className="px-3 py-2">نوع</th>
                <th className="px-3 py-2">تأخیر</th>
                <th className="px-3 py-2">منبع</th>
                <th className="px-3 py-2">اعتبار</th>
                {isEditor ? <th className="px-3 py-2">عملیات</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const invalid =
                  !validIds.has(d.predecessorNodeId) || !validIds.has(d.successorNodeId);
                const selfDep = d.predecessorNodeId === d.successorNodeId;
                return (
                  <tr key={d.id} className="border-b border-borderx hover:bg-page">
                    <td className="px-3 py-2 text-right">{label(d.predecessorNodeId)}</td>
                    <td className="px-3 py-2 text-right">{label(d.successorNodeId)}</td>
                    <td className="px-3 py-2 text-center">{d.type}</td>
                    <td className="px-3 py-2 text-center">{formatLagFa(d.lagMinutes)}</td>
                    <td className="px-3 py-2 text-center text-xs text-grayx-header">{d.source}</td>
                    <td className="px-3 py-2 text-center">
                      {invalid || selfDep ? (
                        <StatusBadge tone="red" label={selfDep ? 'خود-وابستگی' : 'نامعتبر'} showDot={false} />
                      ) : (
                        <StatusBadge tone="green" label="معتبر" showDot={false} />
                      )}
                    </td>
                    {isEditor ? (
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          className="rounded p-1.5 text-brand-red hover:bg-page"
                          onClick={() => setDeleteTarget(d)}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <CreateDependencyModal
          nodes={wbs.data ?? []}
          existing={deps.data ?? []}
          onClose={() => setCreating(false)}
          onCreate={(body, onOk) =>
            createDep.mutate(body, {
              onSuccess: () => {
                toast.success('رابطه ایجاد شد');
                onOk();
                setCreating(false);
              },
              onError: (e) => toast.error(isApiError(e) ? e.message : 'ایجاد رابطه ناموفق بود'),
            })
          }
          pending={createDep.isPending}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف رابطه"
        message="آیا از حذف این رابطه مطمئن هستید؟"
        loading={deleteDep.isPending}
        onConfirm={() =>
          deleteTarget &&
          deleteDep.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success('رابطه حذف شد');
              setDeleteTarget(null);
            },
            onError: (e) => toast.error(isApiError(e) ? e.message : 'حذف ناموفق بود'),
          })
        }
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function CreateDependencyModal({
  nodes,
  existing,
  onClose,
  onCreate,
  pending,
}: {
  nodes: WbsNodeComputedDto[];
  existing: TaskDependencyDto[];
  onClose: () => void;
  onCreate: (
    body: { predecessorNodeId: string; successorNodeId: string; type: DependencyType; lagMinutes: number },
    onOk: () => void,
  ) => void;
  pending: boolean;
}): React.JSX.Element {
  const [predecessor, setPredecessor] = useState('');
  const [successor, setSuccessor] = useState('');
  const [type, setType] = useState<DependencyType>(DependencyType.FS);
  const [lagDays, setLagDays] = useState('0');

  const options = [
    { value: '', label: 'انتخاب کنید…' },
    ...nodes.map((n) => ({ value: n.id, label: `${n.code ? `${n.code} — ` : ''}${n.title}` })),
  ];

  const warnings: string[] = [];
  if (predecessor && successor) {
    if (predecessor === successor) warnings.push('خود-وابستگی مجاز نیست.');
    const dup = existing.some(
      (d) => d.predecessorNodeId === predecessor && d.successorNodeId === successor,
    );
    if (dup) warnings.push('این رابطه از قبل وجود دارد.');
    if (createsCycle(existing, predecessor, successor)) warnings.push('این رابطه ایجاد چرخه می‌کند.');
  }

  const canSubmit = predecessor && successor && warnings.length === 0;

  const submit = (): void => {
    if (!canSubmit) return;
    onCreate(
      {
        predecessorNodeId: predecessor,
        successorNodeId: successor,
        type,
        lagMinutes: lagDaysToMinutes(Number(lagDays) || 0),
      },
      onClose,
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="افزودن رابطه"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={pending} disabled={!canSubmit}>
            ایجاد
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="پیش‌نیاز">
          <Select options={options} value={predecessor} onChange={(e) => setPredecessor(e.target.value)} />
        </Field>
        <Field label="پس‌نیاز">
          <Select options={options} value={successor} onChange={(e) => setSuccessor(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع رابطه">
            <Select options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value as DependencyType)} />
          </Field>
          <Field label="تأخیر (روز)">
            <Input type="number" value={lagDays} onChange={(e) => setLagDays(e.target.value)} />
          </Field>
        </div>
        {warnings.length > 0 ? (
          <div className="space-y-1 rounded bg-brand-red/8 p-2">
            {warnings.map((w) => (
              <p key={w} className="flex items-center gap-1 text-xs text-brand-red">
                <AlertTriangle className="h-3.5 w-3.5" /> {w}
              </p>
            ))}
          </div>
        ) : null}
        <p className="text-[11px] text-grayx-header">
          تأخیر در سرور به دقیقه ذخیره می‌شود (اکنون: {formatLagFa(lagDaysToMinutes(Number(lagDays) || 0))} ≈{' '}
          {lagMinutesToDays(lagDaysToMinutes(Number(lagDays) || 0))} روز).
        </p>
      </div>
    </Modal>
  );
}
