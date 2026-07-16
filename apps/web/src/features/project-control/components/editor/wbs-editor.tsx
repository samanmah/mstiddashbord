'use client';

import {
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  Copy,
  CornerDownLeft,
  FoldVertical,
  GitBranch,
  MoveDown,
  MoveUp,
  Pencil,
  Plus,
  Trash2,
  UnfoldVertical,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { cn, faNumber, isoToJalaliFa, orDash } from '@/lib/utils';
import {
  ControlNodeStatus,
  CONTROL_NODE_STATUS_LABELS,
  WBS_NODE_TYPE_LABELS,
  WbsNodeType,
  type WbsNodeComputedDto,
  type WbsNodeInput,
} from '../../api/project-control-types';
import {
  useCreateNode,
  useDeleteNode,
  useReorderNodes,
  useWbsList,
} from '../../hooks/use-control-wbs';
import { buildWbsTree } from '../../utils/build-wbs-tree';
import {
  collectExpandableIds,
  flattenVisibleTree,
  type FlatRow,
} from '../../utils/flatten-visible-tree';
import { formatDurationFa, jalaliFa } from '../../utils/date-format';
import { formatMoney, formatPercent, formatVariance } from '../../utils/progress-format';
import { statusTone, varianceTone } from '../../utils/control-status';
import { Drawer } from '../common/drawer';
import { NodeTypeIcon } from '../common/node-type-icon';
import { BulkProgressDrawer } from './bulk-progress-drawer';
import { InlineEditCell } from './inline-edit-cell';
import { ProgressDrawer } from './progress-drawer';
import { ReparentDialog } from './reparent-dialog';
import { WbsNodeDrawer, type DrawerMode } from './wbs-node-drawer';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'همهٔ انواع' },
  ...Object.values(WbsNodeType).map((t) => ({ value: t, label: WBS_NODE_TYPE_LABELS[t] })),
];
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'همهٔ وضعیت‌ها' },
  ...Object.values(ControlNodeStatus).map((s) => ({
    value: s,
    label: CONTROL_NODE_STATUS_LABELS[s],
  })),
];
const DQ_FILTER_OPTIONS = [
  { value: '', label: 'کیفیت داده: همه' },
  { value: 'no-date', label: 'بدون تاریخ' },
  { value: 'no-weight', label: 'بدون وزن' },
  { value: 'no-owner', label: 'بدون مسئول' },
  { value: 'no-dod', label: 'بدون DOD' },
];

function varianceTextClass(value: number | null | undefined): string {
  const tone = varianceTone(value);
  if (tone === 'green') return 'text-brand-green';
  if (tone === 'red') return 'text-brand-red';
  if (tone === 'orange') return 'text-brand-orange';
  return 'text-grayx-header';
}

function nodePayload(node: WbsNodeComputedDto): WbsNodeInput {
  return {
    title: node.title,
    code: node.code,
    nodeType: node.nodeType,
    description: node.description,
    plannedStart: node.plannedStart,
    plannedFinish: node.plannedFinish,
    deadline: node.deadline,
    plannedDurationMinutes: node.plannedDurationMinutes,
    weight: node.weight,
    weightSource: node.weightSource,
    budgetAmount: node.budgetAmount,
    ownerText: node.ownerText,
    definitionOfDone: node.definitionOfDone,
    notes: node.notes,
  };
}

export function WbsEditor({
  projectId,
  isEditor,
}: {
  projectId: string;
  isEditor: boolean;
}): React.JSX.Element {
  const wbs = useWbsList(projectId);
  const createNode = useCreateNode(projectId);
  const deleteNode = useDeleteNode(projectId);
  const reorder = useReorderNodes(projectId);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dqFilter, setDqFilter] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [progressNode, setProgressNode] = useState<WbsNodeComputedDto | null>(null);
  const [bulkProgress, setBulkProgress] = useState(false);
  const [reparentNode, setReparentNode] = useState<WbsNodeComputedDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WbsNodeComputedDto | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const nodes = useMemo(() => wbs.data ?? [], [wbs.data]);
  const tree = useMemo(() => buildWbsTree(nodes), [nodes]);

  useEffect(() => {
    if (!initialized && nodes.length > 0) {
      const ids = nodes.filter((n) => n.depth <= 1).map((n) => n.id);
      setExpanded(new Set(ids));
      setInitialized(true);
    }
  }, [initialized, nodes]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) if (n.ownerText?.trim()) set.add(n.ownerText.trim());
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'));
  }, [nodes]);

  const filterActive =
    search.trim() !== '' ||
    typeFilter !== '' ||
    statusFilter !== '' ||
    ownerFilter !== '' ||
    dqFilter !== '' ||
    criticalOnly;

  const match = useMemo(() => {
    if (!filterActive) return undefined;
    const q = search.trim().toLowerCase();
    return (n: WbsNodeComputedDto): boolean => {
      if (q) {
        const hay = `${n.title} ${n.code ?? ''} ${n.ownerText ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeFilter && n.nodeType !== typeFilter) return false;
      if (statusFilter && n.computed?.status !== statusFilter) return false;
      if (ownerFilter && (n.ownerText ?? '') !== ownerFilter) return false;
      if (criticalOnly && n.computed?.isCritical !== true) return false;
      if (dqFilter === 'no-date' && n.plannedStart && n.plannedFinish) return false;
      if (dqFilter === 'no-weight' && n.weight != null) return false;
      if (dqFilter === 'no-owner' && n.ownerText) return false;
      if (dqFilter === 'no-dod' && n.definitionOfDone) return false;
      return true;
    };
  }, [filterActive, search, typeFilter, statusFilter, ownerFilter, criticalOnly, dqFilter]);

  const rows = useMemo(
    () => flattenVisibleTree(tree, { expanded, match }),
    [tree, expanded, match],
  );

  const toggleExpand = (id: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = (): void => setExpanded(collectExpandableIds(tree));
  const collapseAll = (): void => setExpanded(new Set());

  const toggleSelect = (id: string): void =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const moveSibling = (node: WbsNodeComputedDto, dir: -1 | 1): void => {
    const siblings = nodes
      .filter((n) => n.parentId === node.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'fa'));
    const idx = siblings.findIndex((n) => n.id === node.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const reordered = [...siblings];
    const a = reordered[idx];
    const b = reordered[swapIdx];
    if (!a || !b) return;
    reordered[idx] = b;
    reordered[swapIdx] = a;
    reorder.mutate(
      { items: reordered.map((n, i) => ({ nodeId: n.id, sortOrder: i })) },
      { onError: (e) => toast.error(isApiError(e) ? e.message : 'تغییر ترتیب ناموفق بود') },
    );
  };

  const duplicate = (node: WbsNodeComputedDto): void => {
    createNode.mutate(
      { ...nodePayload(node), parentId: node.parentId, title: `${node.title} (کپی)` },
      {
        onSuccess: () => toast.success('نود تکراری ایجاد شد'),
        onError: (e) => toast.error(isApiError(e) ? e.message : 'تکراری‌سازی ناموفق بود'),
      },
    );
  };

  const bulkDelete = (): void => {
    const ids = [...selection];
    Promise.allSettled(ids.map((id) => deleteNode.mutateAsync(id)))
      .then((res) => {
        const ok = res.filter((r) => r.status === 'fulfilled').length;
        toast.success(`${ok} نود حذف شد`);
        setSelection(new Set());
        setBulkDeleteOpen(false);
      })
      .catch(() => toast.error('حذف گروهی ناموفق بود'));
  };

  const closeDrawer = (): void => setDrawerMode(null);

  if (wbs.isLoading) return <FullPageSpinner label="در حال بارگذاری ساختار شکست کار…" />;
  if (wbs.isError) return <ErrorState error={wbs.error} onRetry={() => void wbs.refetch()} />;

  const selectedNodes = nodes.filter((n) => selection.has(n.id));

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Input
          placeholder="جستجو در عنوان/کد/مسئول…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-56"
        />
        <Select
          className="h-9 w-40"
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
        <Select
          className="h-9 w-40"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Select
          className="h-9 w-40"
          options={[{ value: '', label: 'همهٔ مسئولان' }, ...owners.map((o) => ({ value: o, label: o }))]}
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        />
        <Select
          className="h-9 w-40"
          options={DQ_FILTER_OPTIONS}
          value={dqFilter}
          onChange={(e) => setDqFilter(e.target.value)}
        />
        <label className="flex items-center gap-1 text-xs text-grayx-header">
          <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
          فقط بحرانی
        </label>
        <div className="ms-auto flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={expandAll}>
            <UnfoldVertical className="h-4 w-4" /> باز کردن همه
          </Button>
          <Button variant="secondary" size="sm" onClick={collapseAll}>
            <FoldVertical className="h-4 w-4" /> بستن همه
          </Button>
          {isEditor ? (
            <Button
              size="sm"
              onClick={() => {
                const firstRoot = tree[0]?.node;
                if (firstRoot) setDrawerMode({ kind: 'create-child', parent: firstRoot });
                else toast.error('ریشهٔ WBS یافت نشد');
              }}
            >
              <Plus className="h-4 w-4" /> افزودن نود
            </Button>
          ) : null}
        </div>
      </div>

      {/* Bulk bar */}
      {isEditor && selection.size > 0 ? (
        <div className="card flex flex-wrap items-center gap-2 bg-surface p-3">
          <span className="text-sm font-medium text-navy-900">
            {faNumber(selection.size)} مورد انتخاب شده
          </span>
          <Button variant="secondary" size="sm" onClick={() => setBulkProgress(true)}>
            <ClipboardCheck className="h-4 w-4" /> ثبت پیشرفت گروهی
          </Button>
          <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> حذف گروهی
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelection(new Set())}>
            پاک‌کردن انتخاب
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="نودی برای نمایش وجود ندارد" description="فیلترها را تغییر دهید یا نود جدید بسازید." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-navy-800 text-white">
              <tr>
                {isEditor ? <th className="w-8 px-2 py-2"></th> : null}
                <th className="sticky right-0 z-30 min-w-[280px] bg-navy-800 px-2 py-2 text-right">
                  عنوان / WBS
                </th>
                <th className="px-2 py-2">نوع</th>
                <th className="px-2 py-2">شروع</th>
                <th className="px-2 py-2">پایان</th>
                <th className="px-2 py-2">مدت</th>
                <th className="px-2 py-2">شروع واقعی</th>
                <th className="px-2 py-2">پایان واقعی</th>
                <th className="px-2 py-2">باقی‌مانده</th>
                <th className="px-2 py-2">وزن</th>
                <th className="px-2 py-2">برنامه‌ای٪</th>
                <th className="px-2 py-2">واقعی٪</th>
                <th className="px-2 py-2">انحراف</th>
                <th className="px-2 py-2">بودجه</th>
                <th className="px-2 py-2">هزینه واقعی</th>
                <th className="px-2 py-2">مسئول</th>
                <th className="px-2 py-2">وضعیت</th>
                <th className="px-2 py-2">DOD</th>
                <th className="px-2 py-2">Deadline</th>
                <th className="px-2 py-2">بحرانی</th>
                <th className="px-2 py-2">نسخه</th>
                <th className="px-2 py-2">آخرین بروزرسانی</th>
                {isEditor ? <th className="px-2 py-2">عملیات</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <WbsRow
                  key={row.node.id}
                  projectId={projectId}
                  row={row}
                  isEditor={isEditor}
                  selected={selection.has(row.node.id)}
                  onToggleSelect={() => toggleSelect(row.node.id)}
                  onToggleExpand={() => toggleExpand(row.node.id)}
                  onEdit={() => setDrawerMode({ kind: 'edit', node: row.node })}
                  onAddChild={() => setDrawerMode({ kind: 'create-child', parent: row.node })}
                  onAddSibling={() => setDrawerMode({ kind: 'create-sibling', sibling: row.node })}
                  onDuplicate={() => duplicate(row.node)}
                  onMoveUp={() => moveSibling(row.node, -1)}
                  onMoveDown={() => moveSibling(row.node, 1)}
                  onReparent={() => setReparentNode(row.node)}
                  onProgress={() => setProgressNode(row.node)}
                  onDelete={() => setDeleteTarget(row.node)}
                  onConflict={() => void wbs.refetch()}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Node drawer */}
      {drawerMode ? (
        <Drawer
          open
          onClose={closeDrawer}
          width="xl"
          title={
            drawerMode.kind === 'edit'
              ? `ویرایش: ${drawerMode.node.title}`
              : drawerMode.kind === 'create-child'
                ? `افزودن فرزند به: ${drawerMode.parent.title}`
                : `افزودن هم‌رده با: ${drawerMode.sibling.title}`
          }
        >
          <WbsNodeDrawer
            projectId={projectId}
            mode={drawerMode}
            onSaved={() => {
              closeDrawer();
              void wbs.refetch();
            }}
          />
        </Drawer>
      ) : null}

      {/* Progress drawer */}
      {progressNode ? (
        <Drawer
          open
          onClose={() => setProgressNode(null)}
          title={`ثبت پیشرفت: ${progressNode.title}`}
          subtitle={progressNode.code ?? undefined}
        >
          <ProgressDrawer
            projectId={projectId}
            node={progressNode}
            onDone={() => setProgressNode(null)}
          />
        </Drawer>
      ) : null}

      {/* Bulk progress */}
      {bulkProgress ? (
        <Drawer open onClose={() => setBulkProgress(false)} title="ثبت پیشرفت گروهی">
          <BulkProgressDrawer
            projectId={projectId}
            nodes={selectedNodes}
            onDone={() => {
              setBulkProgress(false);
              setSelection(new Set());
            }}
          />
        </Drawer>
      ) : null}

      {/* Reparent */}
      {reparentNode ? (
        <ReparentDialog
          projectId={projectId}
          node={reparentNode}
          allNodes={nodes}
          onClose={() => setReparentNode(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف نود"
        message={`آیا از حذف «${deleteTarget?.title ?? ''}» و تمام نوادگانش مطمئن هستید؟ (حذف نرم)`}
        loading={deleteNode.isPending}
        onConfirm={() =>
          deleteTarget &&
          deleteNode.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success('نود حذف شد');
              setDeleteTarget(null);
            },
            onError: (e) => toast.error(isApiError(e) ? e.message : 'حذف ناموفق بود'),
          })
        }
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="حذف گروهی"
        message={`آیا از حذف ${faNumber(selection.size)} نود انتخاب‌شده مطمئن هستید؟`}
        loading={deleteNode.isPending}
        onConfirm={bulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

function WbsRow({
  projectId,
  row,
  isEditor,
  selected,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onAddChild,
  onAddSibling,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onReparent,
  onProgress,
  onDelete,
  onConflict,
}: {
  projectId: string;
  row: FlatRow;
  isEditor: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReparent: () => void;
  onProgress: () => void;
  onDelete: () => void;
  onConflict: () => void;
}): React.JSX.Element {
  const { node, depth, hasChildren, descendantCount, isExpanded } = row;
  const c = node.computed;
  const isPhase = node.nodeType === WbsNodeType.PHASE;
  const isSummary = hasChildren;

  return (
    <tr className={cn('border-b border-borderx hover:bg-page', isPhase && 'bg-surface')}>
      {isEditor ? (
        <td className="px-2 py-1 text-center">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="انتخاب" />
        </td>
      ) : null}
      <td
        className={cn(
          'sticky right-0 z-10 min-w-[280px] bg-white px-2 py-1',
          isPhase && 'bg-surface',
        )}
      >
        <div className="flex items-center gap-1" style={{ paddingRight: `${depth * 16}px` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="shrink-0 rounded p-0.5 hover:bg-page"
              aria-label={isExpanded ? 'بستن' : 'باز کردن'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-block w-5 shrink-0" />
          )}
          <NodeTypeIcon type={node.nodeType} className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            {isEditor ? (
              <InlineEditCell
                projectId={projectId}
                node={node}
                field="title"
                display={node.title}
                onConflict={onConflict}
              />
            ) : (
              <span className={cn('block truncate', isPhase && 'font-bold text-navy-900')}>
                {node.title}
              </span>
            )}
            {node.code ? <span className="block text-[10px] text-grayx-dot">{node.code}</span> : null}
          </div>
          {isSummary ? (
            <span className="shrink-0 rounded-full bg-grayx-dot/15 px-1.5 text-[10px] text-grayx-header">
              {faNumber(descendantCount)}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-1 text-center">{WBS_NODE_TYPE_LABELS[node.nodeType]}</td>
      <td className="px-2 py-1 text-center">{jalaliFa(node.plannedStart)}</td>
      <td className="px-2 py-1 text-center">{jalaliFa(node.plannedFinish)}</td>
      <td className="px-2 py-1 text-center">{formatDurationFa(node.plannedDurationMinutes)}</td>
      <td className="px-2 py-1 text-center">{jalaliFa(node.actualStart)}</td>
      <td className="px-2 py-1 text-center">{jalaliFa(node.actualFinish)}</td>
      <td className="px-2 py-1 text-center">{formatDurationFa(node.remainingDurationMinutes)}</td>
      <td className="px-2 py-1 text-center">
        {isEditor ? (
          <InlineEditCell
            projectId={projectId}
            node={node}
            field="weight"
            display={formatPercent(c?.normalizedWeight ?? node.weight, 1)}
            onConflict={onConflict}
          />
        ) : (
          formatPercent(c?.normalizedWeight ?? node.weight, 1)
        )}
      </td>
      <td className="px-2 py-1 text-center">{formatPercent(c?.plannedProgress, 1)}</td>
      <td className="px-2 py-1 text-center">
        {isEditor && c?.isLeaf ? (
          <InlineEditCell
            projectId={projectId}
            node={node}
            field="percentComplete"
            display={formatPercent(c?.actualProgress ?? node.percentComplete, 1)}
            onConflict={onConflict}
          />
        ) : (
          formatPercent(c?.actualProgress, 1)
        )}
      </td>
      <td className={cn('px-2 py-1 text-center', varianceTextClass(c?.scheduleVariancePercent))}>
        {formatVariance(c?.scheduleVariancePercent)}
      </td>
      <td className="px-2 py-1 text-center">{formatMoney(node.budgetAmount)}</td>
      <td className="px-2 py-1 text-center">{formatMoney(node.actualCost)}</td>
      <td className="px-2 py-1 text-center">{orDash(node.ownerText)}</td>
      <td className="px-2 py-1 text-center">
        <StatusBadge tone={statusTone(c?.status)} label={CONTROL_NODE_STATUS_LABELS[c?.status ?? 'UNKNOWN']} showDot={false} />
      </td>
      <td className="px-2 py-1 text-center">{node.definitionOfDone ? '✓' : '—'}</td>
      <td className="px-2 py-1 text-center">{jalaliFa(node.deadline)}</td>
      <td className="px-2 py-1 text-center">
        {c?.isCritical === true ? <StatusBadge tone="red" label="بحرانی" showDot={false} /> : '—'}
      </td>
      <td className="px-2 py-1 text-center">{faNumber(node.version)}</td>
      <td className="px-2 py-1 text-center">{isoToJalaliFa(node.updatedAt)}</td>
      {isEditor ? (
        <td className="px-2 py-1">
          <div className="flex items-center gap-0.5">
            <IconBtn label="افزودن فرزند" onClick={onAddChild}><Plus className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="افزودن هم‌رده" onClick={onAddSibling}><CornerDownLeft className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="ویرایش" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="ثبت پیشرفت" onClick={onProgress}><ClipboardCheck className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="تکراری‌سازی" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="انتقال به بالا" onClick={onMoveUp}><MoveUp className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="انتقال به پایین" onClick={onMoveDown}><MoveDown className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="تغییر والد" onClick={onReparent}><GitBranch className="h-3.5 w-3.5" /></IconBtn>
            <IconBtn label="حذف" onClick={onDelete} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'rounded p-1 hover:bg-page',
        danger ? 'text-brand-red' : 'text-navy-700',
      )}
    >
      {children}
    </button>
  );
}
