'use client';

import { dateToJalaliString } from '@ppm/contracts';
import {
  ChevronDown,
  ChevronLeft,
  Link2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Search,
  Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import type {
  TaskDependencyDto,
  WbsNodeComputedDto,
} from '../../api/project-control-types';
import { DependencyType, WbsNodeType } from '../../api/project-control-types';
import { useCreateDependency, useDependencies } from '../../hooks/use-control-dependencies';
import { useControlGantt } from '../../hooks/use-control-gantt';
import { useUpdateNode } from '../../hooks/use-control-wbs';
import { buildWbsTree } from '../../utils/build-wbs-tree';
import {
  collectExpandableIds,
  flattenVisibleTree,
} from '../../utils/flatten-visible-tree';
import {
  computeDateRange,
  createScale,
  dateToX,
  generateTicks,
  type GanttZoom,
  isWeekend,
  jalaliToMs,
  rangeWidth,
  tickLabelFa,
} from '../../utils/gantt-scale';
import { NodeTypeIcon } from '../common/node-type-icon';

const ROW_H = 34;
const HEADER_H = 52;
const WBS_WIDTH = 300;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OVERSCAN = 6;

type Mode = 'viewer' | 'editor';

interface DraftEntry {
  plannedStart: string | null;
  plannedFinish: string | null;
}

/** نمودار گانت تعاملی (Viewer/Editor). */
export function GanttChart({
  projectId,
  mode = 'viewer',
}: {
  projectId: string;
  mode?: Mode;
}): React.JSX.Element {
  const ganttQuery = useControlGantt(projectId);
  const depsQuery = useDependencies(projectId);
  const updateNode = useUpdateNode(projectId);
  const createDependency = useCreateDependency(projectId);

  const [zoom, setZoom] = useState<GanttZoom>('week');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wbsCollapsed, setWbsCollapsed] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);
  const [draft, setDraft] = useState<Map<string, DraftEntry>>(new Map());
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const nodes = ganttQuery.data;

  // مقداردهی اولیهٔ Expand (فقط یک بار پس از بارگذاری): بازکردن سطوح بالا.
  useEffect(() => {
    if (!nodes || nodes.length === 0) return;
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const tree = buildWbsTree(nodes);
      return collectExpandableIds(tree);
    });
  }, [nodes]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onResize = (): void => setViewportH(el.clientHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [nodes, isFullscreen]);

  useEffect(() => {
    const onFsChange = (): void => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = (): void => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!isFullscreen && el.requestFullscreen) {
      void el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => undefined);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
    }
  };

  const matchFn = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return undefined;
    return (n: WbsNodeComputedDto): boolean =>
      n.title.toLowerCase().includes(q) ||
      (n.code ?? '').toLowerCase().includes(q) ||
      (n.ownerText ?? '').toLowerCase().includes(q);
  }, [search]);

  const tree = useMemo(() => (nodes ? buildWbsTree(nodes) : []), [nodes]);
  const rows = useMemo(
    () => flattenVisibleTree(tree, { expanded, match: matchFn }),
    [tree, expanded, matchFn],
  );

  // مقیاس زمانی: از تمام تاریخ‌های موجود (با اعمال Draft).
  const scale = useMemo(() => {
    if (!nodes) return null;
    const dates: (string | null)[] = [];
    for (const n of nodes) {
      const d = draft.get(n.id);
      dates.push(d?.plannedStart ?? n.plannedStart);
      dates.push(d?.plannedFinish ?? n.plannedFinish);
      dates.push(n.actualStart, n.actualFinish, n.forecastFinish, n.baselineStart, n.baselineFinish);
    }
    const range = computeDateRange(dates);
    if (!range) return null;
    // حاشیه: ۳ روز قبل و بعد
    return createScale(range.minMs - 3 * MS_PER_DAY, range.maxMs + 3 * MS_PER_DAY, zoom);
  }, [nodes, zoom, draft]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => map.set(r.node.id, i));
    return map;
  }, [rows]);

  if (ganttQuery.isLoading) return <FullPageSpinner label="در حال بارگذاری گانت…" />;
  if (ganttQuery.isError)
    return <ErrorState error={ganttQuery.error} onRetry={() => void ganttQuery.refetch()} />;
  if (!nodes || nodes.length === 0 || !scale) {
    return (
      <EmptyState
        title="داده‌ای برای نمایش گانت وجود ندارد"
        description="ابتدا ساختار شکست کار و تاریخ‌ها را وارد کنید."
      />
    );
  }

  const totalRowsHeight = rows.length * ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(rows.length, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN);
  const visible = rows.slice(startIdx, endIdx);
  const ticks = generateTicks(scale);
  const nowMs = Date.now();

  const effectiveWbsWidth = wbsCollapsed ? 44 : WBS_WIDTH;

  const getDates = (n: WbsNodeComputedDto): { start: string | null; finish: string | null } => {
    const d = draft.get(n.id);
    return {
      start: d?.plannedStart ?? n.plannedStart,
      finish: d?.plannedFinish ?? n.plannedFinish,
    };
  };

  const toggle = (id: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setDraftDates = (id: string, start: string | null, finish: string | null): void =>
    setDraft((prev) => {
      const next = new Map(prev);
      next.set(id, { plannedStart: start, plannedFinish: finish });
      return next;
    });

  const undoLast = (): void =>
    setDraft((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      const lastKey = [...next.keys()].pop();
      if (lastKey) next.delete(lastKey);
      return next;
    });

  const resetDraft = (): void => setDraft(new Map());

  const validateDraft = (): boolean => {
    for (const [id, d] of draft) {
      const s = jalaliToMs(d.plannedStart);
      const f = jalaliToMs(d.plannedFinish);
      if (s != null && f != null && s > f) {
        const node = nodes.find((n) => n.id === id);
        toast.error(`تاریخ شروع بعد از پایان است: ${node?.title ?? id}`);
        return false;
      }
    }
    toast.success('پیش‌نویس معتبر است.');
    return true;
  };

  const saveDraft = async (): Promise<void> => {
    if (draft.size === 0) return;
    if (!validateDraft()) return;
    let ok = 0;
    let failed = 0;
    for (const [id, d] of draft) {
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;
      try {
        await updateNode.mutateAsync({
          nodeId: id,
          body: {
            plannedStart: d.plannedStart,
            plannedFinish: d.plannedFinish,
            version: node.version,
          },
        });
        ok += 1;
      } catch (e) {
        failed += 1;
        if (isApiError(e) && e.isConflict) {
          toast.error(`تعارض نسخه در «${node.title}». لطفاً صفحه را تازه کنید.`);
        }
      }
    }
    if (failed === 0) {
      toast.success(`${ok} فعالیت ذخیره شد.`);
      resetDraft();
    } else {
      toast.error(`${ok} ذخیره شد، ${failed} ناموفق بود.`);
      void ganttQuery.refetch();
    }
  };

  const handleBarClickConnect = (nodeId: string): void => {
    if (!connectMode) return;
    if (!connectFrom) {
      setConnectFrom(nodeId);
      toast.info('فعالیت پیش‌نیاز انتخاب شد. اکنون فعالیت پس‌نیاز را انتخاب کنید.');
      return;
    }
    if (connectFrom === nodeId) {
      toast.error('یک فعالیت نمی‌تواند به خودش وابسته باشد.');
      return;
    }
    const predecessor = connectFrom;
    const successor = nodeId;
    createDependency.mutate(
      { predecessorNodeId: predecessor, successorNodeId: successor, type: DependencyType.FS },
      {
        onSuccess: () => toast.success('وابستگی ایجاد شد.'),
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : 'ایجاد وابستگی ناموفق بود.'),
      },
    );
    setConnectFrom(null);
    setConnectMode(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={cn('flex flex-col gap-2 bg-white', isFullscreen && 'h-screen p-3')}
    >
      {/* راهنمای موبایل */}
      <p className="no-print rounded-md border border-borderx bg-surface px-3 py-1.5 text-[11px] text-grayx-header sm:hidden">
        برای مشاهدهٔ بهتر گانت، از حالت تمام‌صفحه استفاده کنید و افقی پیمایش کنید.
      </p>

      {/* نوار ابزار */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ZoomButtons zoom={zoom} onChange={setZoom} />
          <button
            type="button"
            onClick={() => setWbsCollapsed((v) => !v)}
            className="rounded-md border border-borderx px-2 py-1 text-xs hover:bg-surface"
          >
            {wbsCollapsed ? 'نمایش درخت' : 'جمع‌کردن درخت'}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-grayx-header" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو…"
              className="w-36 rounded-md border border-borderx py-1 pr-7 pl-2 text-xs outline-none focus:border-brand-blue"
              aria-label="جستجو در فعالیت‌ها"
            />
          </div>
          {mode === 'editor' ? (
            <button
              type="button"
              onClick={() => {
                setConnectMode((v) => !v);
                setConnectFrom(null);
              }}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                connectMode
                  ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                  : 'border-borderx hover:bg-surface',
              )}
              aria-pressed={connectMode}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              اتصال وابستگی
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1 rounded-md border border-borderx px-2 py-1 text-xs hover:bg-surface"
            aria-label={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* نوار پیش‌نویس Editor */}
      {mode === 'editor' && draft.size > 0 ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-xs">
          <span className="font-medium text-brand-orange">
            {draft.size} تغییر ذخیره‌نشده در پیش‌نویس
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={undoLast}>
              <Undo2 className="h-3.5 w-3.5" /> واگرد
            </Button>
            <Button variant="ghost" size="sm" onClick={resetDraft}>
              <RotateCcw className="h-3.5 w-3.5" /> بازنشانی
            </Button>
            <Button variant="secondary" size="sm" onClick={validateDraft}>
              اعتبارسنجی
            </Button>
            <Button
              size="sm"
              onClick={() => void saveDraft()}
              disabled={updateNode.isPending}
            >
              <Save className="h-3.5 w-3.5" /> ذخیره
            </Button>
          </div>
        </div>
      ) : null}

      {/* بدنهٔ گانت */}
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative overflow-auto rounded-card border border-borderx"
        style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '70vh' }}
        dir="rtl"
      >
        <div style={{ width: effectiveWbsWidth + scale.totalWidth, position: 'relative' }}>
          {/* هدر Sticky */}
          <div
            className="sticky top-0 z-30 flex bg-navy-800 text-white"
            style={{ height: HEADER_H }}
          >
            <div
              className="sticky right-0 z-40 flex items-center border-l border-white/10 bg-navy-800 px-2 text-xs font-bold"
              style={{ width: effectiveWbsWidth }}
            >
              {wbsCollapsed ? '' : 'ساختار شکست کار'}
            </div>
            <div className="relative" style={{ width: scale.totalWidth }}>
              {ticks.map((t) => (
                <div
                  key={t.ms}
                  className="absolute top-0 flex h-full flex-col justify-center border-r border-white/10 pr-1 text-[10px] text-white/80"
                  style={{ right: t.x }}
                >
                  {tickLabelFa(t.ms, zoom)}
                </div>
              ))}
            </div>
          </div>

          {/* Spacer بالا */}
          <div style={{ height: startIdx * ROW_H }} />

          {/* ردیف‌های قابل‌مشاهده */}
          {visible.map((row) => {
            const n = row.node;
            const { start, finish } = getDates(n);
            const isDraft = draft.has(n.id);
            return (
              <div
                key={n.id}
                className={cn(
                  'flex border-b border-borderx/50',
                  row.depth === 0 && 'bg-surface',
                )}
                style={{ height: ROW_H }}
              >
                {/* ستون WBS Sticky */}
                <div
                  className="sticky right-0 z-20 flex items-center gap-1 border-l border-borderx bg-white px-2"
                  style={{ width: effectiveWbsWidth, paddingRight: wbsCollapsed ? 8 : row.depth * 14 + 8 }}
                >
                  {!wbsCollapsed ? (
                    <>
                      {row.hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggle(n.id)}
                          className="shrink-0 rounded p-0.5 hover:bg-surface"
                          aria-label={expanded.has(n.id) ? 'بستن' : 'بازکردن'}
                        >
                          {expanded.has(n.id) ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronLeft className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <NodeTypeIcon type={n.nodeType} className="h-3.5 w-3.5 shrink-0" />
                      <span
                        className={cn(
                          'truncate text-xs',
                          n.isSummary ? 'font-bold text-navy-900' : 'text-ink',
                        )}
                        title={n.title}
                      >
                        {n.title}
                      </span>
                    </>
                  ) : (
                    <NodeTypeIcon type={n.nodeType} className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* تایم‌لاین ردیف */}
                <div className="relative" style={{ width: scale.totalWidth }}>
                  <GanttBar
                    node={n}
                    start={start}
                    finish={finish}
                    scale={scale}
                    mode={mode}
                    isDraft={isDraft}
                    connectMode={connectMode}
                    connectActive={connectFrom === n.id}
                    onConnectClick={() => handleBarClickConnect(n.id)}
                    onDraftChange={(s, f) => setDraftDates(n.id, s, f)}
                  />
                </div>
              </div>
            );
          })}

          {/* Spacer پایین */}
          <div style={{ height: Math.max(0, totalRowsHeight - endIdx * ROW_H) }} />

          {/* پس‌زمینهٔ آخر هفته (فقط در Zoom روز) */}
          {zoom === 'day' ? (
            <WeekendLayer
              scale={scale}
              wbsWidth={effectiveWbsWidth}
              totalRowsHeight={totalRowsHeight}
            />
          ) : null}

          {/* خطوط راهنما: امروز و تاریخ وضعیت */}
          <VerticalMarkers
            scale={scale}
            nowMs={nowMs}
            wbsWidth={effectiveWbsWidth}
            totalRowsHeight={totalRowsHeight}
          />

          {/* خطوط وابستگی */}
          <DependencyLayer
            deps={depsQuery.data ?? []}
            rows={rows}
            rowIndexById={rowIndexById}
            getDates={getDates}
            scale={scale}
            wbsWidth={effectiveWbsWidth}
            startIdx={startIdx}
            endIdx={endIdx}
            totalRowsHeight={totalRowsHeight}
          />
        </div>
      </div>

      <GanttLegend />
    </div>
  );
}

/* ------------------------------- Bar ------------------------------- */

function GanttBar({
  node,
  start,
  finish,
  scale,
  mode,
  isDraft,
  connectMode,
  connectActive,
  onConnectClick,
  onDraftChange,
}: {
  node: WbsNodeComputedDto;
  start: string | null;
  finish: string | null;
  scale: ReturnType<typeof createScale>;
  mode: Mode;
  isDraft: boolean;
  connectMode: boolean;
  connectActive: boolean;
  onConnectClick: () => void;
  onDraftChange: (start: string | null, finish: string | null) => void;
}): React.JSX.Element | null {
  const startMs = jalaliToMs(start);
  const finishMs = jalaliToMs(finish);
  const isMilestone = node.nodeType === WbsNodeType.MILESTONE;

  const dragState = useRef<{
    kind: 'move' | 'resize-start' | 'resize-end';
    originX: number;
    startMs: number;
    finishMs: number;
  } | null>(null);

  if (isMilestone) {
    const ms = finishMs ?? startMs;
    if (ms == null) return null;
    const x = dateToX(scale, ms);
    const critical = node.computed?.isCritical === true;
    return (
      <button
        type="button"
        onClick={connectMode ? onConnectClick : undefined}
        className="absolute top-1/2 -translate-y-1/2"
        style={{ right: x - 7 }}
        title={node.title}
        aria-label={`نقطه عطف ${node.title}`}
      >
        <span
          className="block h-3.5 w-3.5 rotate-45"
          style={{
            backgroundColor: critical ? '#dc2626' : '#7c3aed',
            outline: connectActive ? '2px solid #2563EB' : undefined,
          }}
        />
      </button>
    );
  }

  if (startMs == null || finishMs == null) return null;

  const x = dateToX(scale, startMs);
  const w = rangeWidth(scale, startMs, finishMs);
  const progress = node.computed?.actualProgress ?? 0;
  const critical = node.computed?.isCritical === true;
  const isSummary = node.isSummary;

  // Forecast extension
  const forecastMs = jalaliToMs(node.forecastFinish);
  const forecastW =
    forecastMs != null && forecastMs > finishMs ? rangeWidth(scale, finishMs, forecastMs) : 0;

  // Baseline bar
  const bStart = jalaliToMs(node.baselineStart);
  const bFinish = jalaliToMs(node.baselineFinish);

  // Actual bar
  const aStart = jalaliToMs(node.actualStart);
  const aFinish = jalaliToMs(node.actualFinish);

  const onPointerDown =
    (kind: 'move' | 'resize-start' | 'resize-end') =>
    (e: React.PointerEvent): void => {
      if (mode !== 'editor' || connectMode) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { kind, originX: e.clientX, startMs, finishMs };
    };

  const onPointerMove = (e: React.PointerEvent): void => {
    const st = dragState.current;
    if (!st) return;
    // RTL: حرکت به چپ = افزایش زمان. dx مثبت به راست.
    const dxDays = ((st.originX - e.clientX) / scale.pxPerDay);
    const deltaMs = Math.round(dxDays) * MS_PER_DAY;
    let newStart = st.startMs;
    let newFinish = st.finishMs;
    if (st.kind === 'move') {
      newStart = st.startMs + deltaMs;
      newFinish = st.finishMs + deltaMs;
    } else if (st.kind === 'resize-start') {
      newStart = Math.min(st.startMs + deltaMs, st.finishMs - MS_PER_DAY);
    } else {
      newFinish = Math.max(st.finishMs + deltaMs, st.startMs + MS_PER_DAY);
    }
    onDraftChange(
      dateToJalaliString(new Date(newStart)),
      dateToJalaliString(new Date(newFinish)),
    );
  };

  const onPointerUp = (e: React.PointerEvent): void => {
    if (dragState.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragState.current = null;
    }
  };

  const editable = mode === 'editor' && !connectMode && !isSummary;

  return (
    <>
      {/* Baseline */}
      {bStart != null && bFinish != null ? (
        <div
          className="absolute rounded-sm bg-grayx-dot/40"
          style={{ right: dateToX(scale, bStart), width: rangeWidth(scale, bStart, bFinish), top: 3, height: 4 }}
          aria-hidden
        />
      ) : null}

      {/* Forecast extension */}
      {forecastW > 0 ? (
        <div
          className="absolute rounded-sm border border-dashed border-brand-orange"
          style={{ right: dateToX(scale, finishMs), width: forecastW, top: 10, height: 12 }}
          aria-hidden
        />
      ) : null}

      {/* Planned bar */}
      <div
        role={connectMode ? 'button' : undefined}
        onClick={connectMode ? onConnectClick : undefined}
        onPointerDown={editable ? onPointerDown('move') : undefined}
        onPointerMove={editable ? onPointerMove : undefined}
        onPointerUp={editable ? onPointerUp : undefined}
        className={cn(
          'absolute overflow-hidden rounded',
          isSummary ? 'top-[13px] h-2' : 'top-[9px] h-4',
          editable && 'cursor-grab active:cursor-grabbing',
          connectMode && 'cursor-crosshair',
        )}
        style={{
          right: x,
          width: w,
          backgroundColor: isSummary ? '#334155' : '#93c5fd',
          outline: critical ? '2px solid #dc2626' : connectActive ? '2px solid #2563EB' : undefined,
          boxShadow: isDraft ? '0 0 0 2px #f59e0b' : undefined,
        }}
        title={`${node.title}`}
      >
        {/* Progress fill */}
        {!isSummary ? (
          <div
            className="h-full"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: '#2563EB' }}
          />
        ) : null}
        {/* Resize handles */}
        {editable ? (
          <>
            <span
              onPointerDown={onPointerDown('resize-end')}
              className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/40"
              aria-hidden
            />
            <span
              onPointerDown={onPointerDown('resize-start')}
              className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/40"
              aria-hidden
            />
          </>
        ) : null}
      </div>

      {/* Actual bar */}
      {aStart != null && aFinish != null ? (
        <div
          className="absolute rounded-sm bg-brand-green"
          style={{ right: dateToX(scale, aStart), width: rangeWidth(scale, aStart, aFinish), top: 25, height: 4 }}
          aria-hidden
        />
      ) : null}
    </>
  );
}

/* --------------------------- Markers --------------------------- */

function VerticalMarkers({
  scale,
  nowMs,
  wbsWidth,
  totalRowsHeight,
}: {
  scale: ReturnType<typeof createScale>;
  nowMs: number;
  wbsWidth: number;
  totalRowsHeight: number;
}): React.JSX.Element | null {
  if (nowMs < scale.minMs || nowMs > scale.maxMs) return null;
  const x = dateToX(scale, nowMs);
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{ right: wbsWidth + x, top: HEADER_H, height: totalRowsHeight, width: 0 }}
    >
      <div className="h-full border-r-2 border-brand-red/70" />
      <span className="absolute -top-0 right-1 rounded bg-brand-red px-1 text-[9px] text-white">
        امروز
      </span>
    </div>
  );
}

function WeekendLayer({
  scale,
  wbsWidth,
  totalRowsHeight,
}: {
  scale: ReturnType<typeof createScale>;
  wbsWidth: number;
  totalRowsHeight: number;
}): React.JSX.Element {
  const stripes: number[] = [];
  for (let ms = scale.minMs; ms <= scale.maxMs; ms += MS_PER_DAY) {
    if (isWeekend(ms)) stripes.push(dateToX(scale, ms));
  }
  return (
    <div
      className="pointer-events-none absolute z-0"
      style={{ right: wbsWidth, top: HEADER_H, height: totalRowsHeight, width: scale.totalWidth }}
    >
      {stripes.map((x) => (
        <div
          key={x}
          className="absolute top-0 h-full bg-navy-900/[0.04]"
          style={{ right: x, width: scale.pxPerDay }}
        />
      ))}
    </div>
  );
}

/* ------------------------ Dependency layer ------------------------ */

function DependencyLayer({
  deps,
  rows,
  rowIndexById,
  getDates,
  scale,
  wbsWidth,
  startIdx,
  endIdx,
  totalRowsHeight,
}: {
  deps: TaskDependencyDto[];
  rows: ReturnType<typeof flattenVisibleTree>;
  rowIndexById: Map<string, number>;
  getDates: (n: WbsNodeComputedDto) => { start: string | null; finish: string | null };
  scale: ReturnType<typeof createScale>;
  wbsWidth: number;
  startIdx: number;
  endIdx: number;
  totalRowsHeight: number;
}): React.JSX.Element {
  const lines = useMemo(() => {
    const out: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const dep of deps) {
      const pi = rowIndexById.get(dep.predecessorNodeId);
      const si = rowIndexById.get(dep.successorNodeId);
      if (pi == null || si == null) continue;
      // فقط بازهٔ قابل‌مشاهده (± overscan) برای کارایی
      const inView =
        (pi >= startIdx - OVERSCAN && pi <= endIdx + OVERSCAN) ||
        (si >= startIdx - OVERSCAN && si <= endIdx + OVERSCAN);
      if (!inView) continue;
      const pRow = rows[pi];
      const sRow = rows[si];
      if (!pRow || !sRow) continue;
      const pd = getDates(pRow.node);
      const sd = getDates(sRow.node);
      const pFinish = jalaliToMs(pd.finish) ?? jalaliToMs(pd.start);
      const sStart = jalaliToMs(sd.start) ?? jalaliToMs(sd.finish);
      if (pFinish == null || sStart == null) continue;
      const x1 = dateToX(scale, pFinish);
      const x2 = dateToX(scale, sStart);
      const y1 = HEADER_H + pi * ROW_H + ROW_H / 2;
      const y2 = HEADER_H + si * ROW_H + ROW_H / 2;
      out.push({ key: dep.id, x1, y1, x2, y2 });
    }
    return out;
  }, [deps, rows, rowIndexById, getDates, scale, startIdx, endIdx]);

  return (
    <svg
      className="pointer-events-none absolute top-0 z-[5]"
      style={{ right: wbsWidth, width: scale.totalWidth, height: HEADER_H + totalRowsHeight }}
      aria-hidden
    >
      <defs>
        <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
        </marker>
      </defs>
      {lines.map((l) => {
        // مختصات SVG از چپ محاسبه می‌شود؛ چون کانتینر RTL است، x را از راست به left تبدیل می‌کنیم.
        const X1 = scale.totalWidth - l.x1;
        const X2 = scale.totalWidth - l.x2;
        const midX = (X1 + X2) / 2;
        return (
          <path
            key={l.key}
            d={`M ${X1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${X2} ${l.y2}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.2}
            markerEnd="url(#gantt-arrow)"
          />
        );
      })}
    </svg>
  );
}

/* ----------------------------- Toolbar ----------------------------- */

function ZoomButtons({
  zoom,
  onChange,
}: {
  zoom: GanttZoom;
  onChange: (z: GanttZoom) => void;
}): React.JSX.Element {
  const options: { value: GanttZoom; label: string }[] = [
    { value: 'day', label: 'روز' },
    { value: 'week', label: 'هفته' },
    { value: 'month', label: 'ماه' },
    { value: 'quarter', label: 'فصل' },
  ];
  return (
    <div className="flex overflow-hidden rounded-md border border-borderx text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2.5 py-1 transition-colors',
            zoom === o.value ? 'bg-navy-800 text-white' : 'hover:bg-surface',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GanttLegend(): React.JSX.Element {
  const items = [
    { color: '#93c5fd', label: 'برنامه' },
    { color: '#2563EB', label: 'پیشرفت' },
    { color: '#16a34a', label: 'واقعی' },
    { color: '#94a3b8', label: 'خط مبنا' },
    { color: '#7c3aed', label: 'نقطه عطف' },
    { color: '#dc2626', label: 'بحرانی / امروز' },
    { color: '#f59e0b', label: 'پیش‌بینی' },
  ];
  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-borderx bg-card px-3 py-2 text-[11px] text-grayx-header">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
