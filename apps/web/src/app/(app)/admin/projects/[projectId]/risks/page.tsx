'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  PROBABILITY_META,
  Probability,
  RISK_LEVEL_META,
  RiskLevel,
  riskFormSchema,
  type RiskDto,
  type RiskFormInput,
} from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { riskService } from '@/lib/services';
import { isoToJalaliInput, orDash } from '@/lib/utils';

const PROBABILITY_OPTIONS = [
  { value: Probability.LOW, label: PROBABILITY_META.LOW.label },
  { value: Probability.MEDIUM, label: PROBABILITY_META.MEDIUM.label },
  { value: Probability.HIGH, label: PROBABILITY_META.HIGH.label },
];
const RISK_LEVEL_OPTIONS = [
  { value: RiskLevel.LOW, label: RISK_LEVEL_META.LOW.label },
  { value: RiskLevel.MEDIUM, label: RISK_LEVEL_META.MEDIUM.label },
  { value: RiskLevel.HIGH, label: RISK_LEVEL_META.HIGH.label },
];

export default function RisksPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RiskDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RiskDto | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.risks(projectId),
    queryFn: () => riskService.list(projectId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.risks(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => riskService.remove(projectId, id),
    onSuccess: () => {
      toast.success('ریسک حذف شد');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'حذف ناموفق بود'),
  });

  if (isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const risks = data ?? [];
  const nextRow = risks.length > 0 ? Math.max(...risks.map((r) => r.rowNumber)) + 1 : 1;

  return (
    <>
      <PageHeader
        title="مدیریت ریسک‌ها"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> افزودن ریسک
          </Button>
        }
      />

      {risks.length === 0 ? (
        <EmptyState title="ریسکی ثبت نشده است" />
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-right">ریسک / چالش</th>
                <th className="w-24">احتمال</th>
                <th className="w-24">سطح ریسک</th>
                <th className="w-24">مسئول</th>
                <th className="text-right">اقدام مقابله</th>
                <th className="w-24">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[...risks]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((r) => (
                  <tr key={r.id}>
                    <td className="text-right">{r.title}</td>
                    <td>
                      <StatusBadge
                        tone={PROBABILITY_META[r.probability].tone}
                        label={PROBABILITY_META[r.probability].label}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        tone={RISK_LEVEL_META[r.riskLevel].tone}
                        label={RISK_LEVEL_META[r.riskLevel].label}
                      />
                    </td>
                    <td>{orDash(r.owner)}</td>
                    <td className="text-right text-xs">{orDash(r.mitigationAction)}</td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded p-1.5 text-navy-700 hover:bg-page"
                          onClick={() => setEditing(r)}
                          aria-label="ویرایش"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-brand-red hover:bg-page"
                          onClick={() => setDeleteTarget(r)}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <RiskFormModal
          projectId={projectId}
          nextRow={nextRow}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}
      {editing ? (
        <RiskFormModal
          projectId={projectId}
          risk={editing}
          nextRow={editing.rowNumber}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف ریسک"
        message={`آیا از حذف ریسک «${deleteTarget?.title ?? ''}» مطمئن هستید؟`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function RiskFormModal({
  projectId,
  risk,
  nextRow,
  onClose,
  onSaved,
}: {
  projectId: string;
  risk?: RiskDto;
  nextRow: number;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const isEdit = Boolean(risk);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RiskFormInput>({
    resolver: zodResolver(riskFormSchema),
    defaultValues: {
      rowNumber: risk?.rowNumber ?? nextRow,
      title: risk?.title ?? '',
      probability: risk?.probability ?? Probability.MEDIUM,
      riskLevel: risk?.riskLevel ?? RiskLevel.MEDIUM,
      mitigationAction: risk?.mitigationAction ?? '',
      owner: risk?.owner ?? '',
      dueDate: risk?.dueDate ? isoToJalaliInput(risk.dueDate) : null,
      status: risk?.status ?? null,
      displayOrder: risk?.displayOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: RiskFormInput) =>
      isEdit && risk
        ? riskService.update(projectId, risk.id, values)
        : riskService.create(projectId, values),
    onSuccess: () => {
      toast.success(isEdit ? 'ریسک ویرایش شد' : 'ریسک افزوده شد');
      onSaved();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'ویرایش ریسک' : 'افزودن ریسک'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            ذخیره
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Field label="عنوان ریسک / چالش" required error={errors.title?.message}>
          <Input hasError={Boolean(errors.title)} {...register('title')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="احتمال" error={errors.probability?.message}>
            <Select options={PROBABILITY_OPTIONS} {...register('probability')} />
          </Field>
          <Field label="سطح ریسک" error={errors.riskLevel?.message}>
            <Select options={RISK_LEVEL_OPTIONS} {...register('riskLevel')} />
          </Field>
        </div>
        <Field label="اقدام / برنامهٔ مقابله" error={errors.mitigationAction?.message}>
          <Textarea rows={2} {...register('mitigationAction')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="مسئول" error={errors.owner?.message}>
            <Input {...register('owner')} />
          </Field>
          <Field label="تاریخ اقدام" error={errors.dueDate?.message}>
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <JalaliDateInput
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(v === '' ? null : v)}
                  hasError={Boolean(errors.dueDate)}
                />
              )}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
