'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isApiError } from '@/lib/api-error';
import { isoToJalaliFa, orDash } from '@/lib/utils';
import {
  ControlNodeStatus,
  CONTROL_NODE_STATUS_LABELS,
  WBS_NODE_TYPE_LABELS,
  WbsNodeType,
  WeightSource,
  WEIGHT_SOURCE_LABELS,
  type WbsNodeComputedDto,
  type WbsNodeInput,
} from '../../api/project-control-types';
import { useProgressHistory } from '../../hooks/use-control-progress';
import { useCreateNode, useUpdateNode } from '../../hooks/use-control-wbs';
import { daysToMinutes, jalaliFa, minutesToDays } from '../../utils/date-format';
import { formatPercent } from '../../utils/progress-format';
import { ConflictDialog } from '../common/conflict-dialog';

export type DrawerMode =
  | { kind: 'edit'; node: WbsNodeComputedDto }
  | { kind: 'create-child'; parent: WbsNodeComputedDto }
  | { kind: 'create-sibling'; sibling: WbsNodeComputedDto };

interface FormState {
  title: string;
  code: string;
  nodeType: WbsNodeType;
  description: string;
  plannedStart: string;
  plannedFinish: string;
  actualStart: string;
  actualFinish: string;
  deadline: string;
  durationDays: string;
  percentComplete: string;
  physicalProgress: string;
  plannedProgressOverride: string;
  statusOverride: string;
  budgetAmount: string;
  weight: string;
  weightSource: WeightSource;
  ownerText: string;
  definitionOfDone: string;
  notes: string;
}

const TYPE_OPTIONS = Object.values(WbsNodeType).map((t) => ({
  value: t,
  label: WBS_NODE_TYPE_LABELS[t],
}));
const STATUS_OPTIONS = [
  { value: '', label: 'خودکار (بر اساس محاسبه)' },
  ...Object.values(ControlNodeStatus).map((s) => ({
    value: s,
    label: CONTROL_NODE_STATUS_LABELS[s],
  })),
];
const WEIGHT_SOURCE_OPTIONS = Object.values(WeightSource).map((w) => ({
  value: w,
  label: WEIGHT_SOURCE_LABELS[w],
}));

function emptyForm(nodeType: WbsNodeType): FormState {
  return {
    title: '',
    code: '',
    nodeType,
    description: '',
    plannedStart: '',
    plannedFinish: '',
    actualStart: '',
    actualFinish: '',
    deadline: '',
    durationDays: '',
    percentComplete: '',
    physicalProgress: '',
    plannedProgressOverride: '',
    statusOverride: '',
    budgetAmount: '',
    weight: '',
    weightSource: WeightSource.EXPLICIT,
    ownerText: '',
    definitionOfDone: '',
    notes: '',
  };
}

function formFromNode(node: WbsNodeComputedDto): FormState {
  const days = minutesToDays(node.plannedDurationMinutes);
  return {
    title: node.title,
    code: node.code ?? '',
    nodeType: node.nodeType,
    description: node.description ?? '',
    plannedStart: node.plannedStart ?? '',
    plannedFinish: node.plannedFinish ?? '',
    actualStart: node.actualStart ?? '',
    actualFinish: node.actualFinish ?? '',
    deadline: node.deadline ?? '',
    durationDays: days == null ? '' : String(Math.round(days * 10) / 10),
    percentComplete: node.percentComplete == null ? '' : String(node.percentComplete),
    physicalProgress: node.physicalProgress == null ? '' : String(node.physicalProgress),
    plannedProgressOverride:
      node.plannedProgressOverride == null ? '' : String(node.plannedProgressOverride),
    statusOverride: node.statusOverride ?? '',
    budgetAmount: node.budgetAmount ?? '',
    weight: node.weight == null ? '' : String(node.weight),
    weightSource: node.weightSource ?? WeightSource.EXPLICIT,
    ownerText: node.ownerText ?? '',
    definitionOfDone: node.definitionOfDone ?? '',
    notes: node.notes ?? '',
  };
}

function numOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function strOrNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="rounded-card border border-borderx p-3">
      <legend className="px-1 text-xs font-bold text-navy-900">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

export function WbsNodeDrawer({
  projectId,
  mode,
  onSaved,
}: {
  projectId: string;
  mode: DrawerMode;
  onSaved: (nodeId?: string) => void;
}): React.JSX.Element {
  const isEdit = mode.kind === 'edit';
  const initial = useMemo<FormState>(() => {
    if (mode.kind === 'edit') return formFromNode(mode.node);
    if (mode.kind === 'create-child') return emptyForm(WbsNodeType.TASK);
    return emptyForm(mode.sibling.nodeType);
  }, [mode]);

  const [form, setForm] = useState<FormState>(initial);
  const [conflictOpen, setConflictOpen] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((f) => ({ ...f, [key]: value }));

  const create = useCreateNode(projectId);
  const update = useUpdateNode(projectId);
  const historyNodeId = isEdit ? mode.node.id : null;
  const history = useProgressHistory(projectId, historyNodeId);

  const buildPayload = (): WbsNodeInput => ({
    title: form.title.trim(),
    code: strOrNull(form.code),
    nodeType: form.nodeType,
    description: strOrNull(form.description),
    plannedStart: strOrNull(form.plannedStart),
    plannedFinish: strOrNull(form.plannedFinish),
    actualStart: strOrNull(form.actualStart),
    actualFinish: strOrNull(form.actualFinish),
    deadline: strOrNull(form.deadline),
    plannedDurationMinutes:
      form.durationDays.trim() === '' ? null : daysToMinutes(Number(form.durationDays)),
    percentComplete: numOrNull(form.percentComplete),
    physicalProgress: numOrNull(form.physicalProgress),
    plannedProgressOverride: numOrNull(form.plannedProgressOverride),
    statusOverride: (strOrNull(form.statusOverride) as ControlNodeStatus | null) ?? null,
    budgetAmount: strOrNull(form.budgetAmount),
    weight: numOrNull(form.weight),
    weightSource: form.weightSource,
    ownerText: strOrNull(form.ownerText),
    definitionOfDone: strOrNull(form.definitionOfDone),
    notes: strOrNull(form.notes),
  });

  const submit = (): void => {
    if (!form.title.trim()) {
      toast.error('عنوان الزامی است');
      return;
    }
    if (mode.kind === 'edit') {
      update.mutate(
        { nodeId: mode.node.id, body: { ...buildPayload(), version: mode.node.version } },
        {
          onSuccess: () => {
            toast.success('نود به‌روزرسانی شد');
            onSaved(mode.node.id);
          },
          onError: (e) => {
            if (isApiError(e) && e.isConflict) {
              setConflictOpen(true);
              return;
            }
            toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود');
          },
        },
      );
      return;
    }
    const parentId = mode.kind === 'create-child' ? mode.parent.id : mode.sibling.parentId;
    create.mutate(
      { ...buildPayload(), parentId },
      {
        onSuccess: (node) => {
          toast.success('نود ایجاد شد');
          onSaved(node.id);
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'ایجاد ناموفق بود'),
      },
    );
  };

  const pending = create.isPending || update.isPending;
  const sourceNode = mode.kind === 'edit' ? mode.node : null;

  return (
    <>
      <div className="space-y-4">
        <Section title="اطلاعات عمومی">
          <Field label="عنوان" required>
            <Input value={form.title} onChange={(e) => setField('title', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="کد">
              <Input value={form.code} onChange={(e) => setField('code', e.target.value)} />
            </Field>
            <Field label="نوع">
              <Select
                options={TYPE_OPTIONS}
                value={form.nodeType}
                onChange={(e) => setField('nodeType', e.target.value as WbsNodeType)}
              />
            </Field>
          </div>
          <Field label="توضیحات">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </Field>
        </Section>

        <Section title="زمان‌بندی">
          <div className="grid grid-cols-2 gap-3">
            <Field label="شروع برنامه‌ای">
              <JalaliDateInput
                value={form.plannedStart}
                onChange={(v) => setField('plannedStart', v)}
              />
            </Field>
            <Field label="پایان برنامه‌ای">
              <JalaliDateInput
                value={form.plannedFinish}
                onChange={(v) => setField('plannedFinish', v)}
              />
            </Field>
            <Field label="شروع واقعی">
              <JalaliDateInput
                value={form.actualStart}
                onChange={(v) => setField('actualStart', v)}
              />
            </Field>
            <Field label="پایان واقعی">
              <JalaliDateInput
                value={form.actualFinish}
                onChange={(v) => setField('actualFinish', v)}
              />
            </Field>
            <Field label="مهلت (Deadline)">
              <JalaliDateInput value={form.deadline} onChange={(v) => setField('deadline', v)} />
            </Field>
            <Field label="مدت (روز)">
              <Input
                type="number"
                min={0}
                value={form.durationDays}
                onChange={(e) => setField('durationDays', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="پیشرفت">
          <div className="grid grid-cols-2 gap-3">
            <Field label="درصد پیشرفت">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.percentComplete}
                onChange={(e) => setField('percentComplete', e.target.value)}
              />
            </Field>
            <Field label="پیشرفت فیزیکی">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.physicalProgress}
                onChange={(e) => setField('physicalProgress', e.target.value)}
              />
            </Field>
            <Field label="بازنویسی پیشرفت برنامه‌ای">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.plannedProgressOverride}
                onChange={(e) => setField('plannedProgressOverride', e.target.value)}
              />
            </Field>
            <Field label="وضعیت (بازنویسی)">
              <Select
                options={STATUS_OPTIONS}
                value={form.statusOverride}
                onChange={(e) => setField('statusOverride', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Section title="هزینه و بودجه">
            <Field label="بودجه (مبلغ)">
              <Input
                value={form.budgetAmount}
                onChange={(e) => setField('budgetAmount', e.target.value)}
                inputMode="numeric"
              />
            </Field>
          </Section>
          <Section title="وزن">
            <Field label="وزن (٪)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.weight}
                onChange={(e) => setField('weight', e.target.value)}
              />
            </Field>
            <Field label="منبع وزن">
              <Select
                options={WEIGHT_SOURCE_OPTIONS}
                value={form.weightSource}
                onChange={(e) => setField('weightSource', e.target.value as WeightSource)}
              />
            </Field>
          </Section>
        </div>

        <Section title="مسئولیت‌ها">
          <Field label="مسئول">
            <Input value={form.ownerText} onChange={(e) => setField('ownerText', e.target.value)} />
          </Field>
        </Section>

        <Section title="تعریف تحویل (DOD)">
          <Textarea
            rows={2}
            value={form.definitionOfDone}
            onChange={(e) => setField('definitionOfDone', e.target.value)}
          />
        </Section>

        <Section title="یادداشت">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </Section>

        {sourceNode ? (
          <>
            <Section title="منبع داده">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-grayx-header">نوع فایل منبع</dt>
                <dd>{orDash(sourceNode.sourceFileType)}</dd>
                <dt className="text-grayx-header">سطر منبع</dt>
                <dd>{sourceNode.sourceRow ?? '—'}</dd>
                <dt className="text-grayx-header">مسیر WBS</dt>
                <dd className="truncate">{orDash(sourceNode.materializedPath)}</dd>
                <dt className="text-grayx-header">آخرین بروزرسانی</dt>
                <dd>{isoToJalaliFa(sourceNode.updatedAt)}</dd>
                <dt className="text-grayx-header">نسخه</dt>
                <dd>{sourceNode.version}</dd>
              </dl>
            </Section>

            <Section title="تاریخچهٔ پیشرفت">
              {history.isLoading ? (
                <p className="text-xs text-grayx-header">در حال بارگذاری…</p>
              ) : (history.data ?? []).length === 0 ? (
                <p className="text-xs text-grayx-header">گزارشی ثبت نشده است.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {(history.data ?? []).map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span>{jalaliFa(h.reportingDate)}</span>
                      <StatusBadge tone="blue" label={formatPercent(h.actualPercent, 1)} showDot={false} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-borderx pt-3">
        <Button variant="secondary" onClick={() => onSaved()}>
          انصراف
        </Button>
        <Button onClick={submit} loading={pending}>
          {isEdit ? 'ذخیره تغییرات' : 'ایجاد'}
        </Button>
      </div>

      <ConflictDialog
        open={conflictOpen}
        onReload={() => {
          setConflictOpen(false);
          onSaved(isEdit ? mode.node.id : undefined);
        }}
        onCancel={() => setConflictOpen(false)}
      />
    </>
  );
}
