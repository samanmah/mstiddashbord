'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  DECISION_STATUS_META,
  DecisionStatus,
  decisionFormSchema,
  type DecisionDto,
  type DecisionFormInput,
} from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { decisionService } from '@/lib/services';
import { isoToJalaliFa, isoToJalaliInput, orDash } from '@/lib/utils';

const STATUS_OPTIONS = (Object.keys(DECISION_STATUS_META) as DecisionStatus[]).map((key) => ({
  value: key,
  label: DECISION_STATUS_META[key].label,
}));

export default function DecisionsPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DecisionDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DecisionDto | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.decisions(projectId),
    queryFn: () => decisionService.list(projectId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.decisions(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => decisionService.remove(projectId, id),
    onSuccess: () => {
      toast.success('تصمیم حذف شد');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'حذف ناموفق بود'),
  });

  if (isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const decisions = data ?? [];
  const nextRow = decisions.length > 0 ? Math.max(...decisions.map((d) => d.rowNumber)) + 1 : 1;

  return (
    <>
      <PageHeader
        title="مدیریت تصمیمات"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> افزودن تصمیم
          </Button>
        }
      />

      {decisions.length === 0 ? (
        <EmptyState title="تصمیمی ثبت نشده است" />
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-right">موضوع</th>
                <th className="text-right">شرح</th>
                <th className="w-24">مسئول</th>
                <th className="w-28">مهلت</th>
                <th className="w-28">وضعیت</th>
                <th className="w-24">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[...decisions]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((d) => (
                  <tr key={d.id}>
                    <td className="text-right">{orDash(d.subject)}</td>
                    <td className="text-right text-xs">{orDash(d.description)}</td>
                    <td>{orDash(d.owner)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        {d.isOverdue ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-brand-red" aria-label="سررسید گذشته" />
                        ) : null}
                        {d.dueDate ? isoToJalaliFa(d.dueDate) : '—'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        tone={DECISION_STATUS_META[d.status].tone}
                        label={DECISION_STATUS_META[d.status].label}
                      />
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded p-1.5 text-navy-700 hover:bg-page"
                          onClick={() => setEditing(d)}
                          aria-label="ویرایش"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-brand-red hover:bg-page"
                          onClick={() => setDeleteTarget(d)}
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
        <DecisionFormModal
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
        <DecisionFormModal
          projectId={projectId}
          decision={editing}
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
        title="حذف تصمیم"
        message="آیا از حذف این تصمیم مطمئن هستید؟"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function DecisionFormModal({
  projectId,
  decision,
  nextRow,
  onClose,
  onSaved,
}: {
  projectId: string;
  decision?: DecisionDto;
  nextRow: number;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const isEdit = Boolean(decision);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DecisionFormInput>({
    resolver: zodResolver(decisionFormSchema),
    defaultValues: {
      rowNumber: decision?.rowNumber ?? nextRow,
      subject: decision?.subject ?? '',
      description: decision?.description ?? '',
      owner: decision?.owner ?? '',
      dueDate: decision?.dueDate ? isoToJalaliInput(decision.dueDate) : null,
      status: decision?.status ?? DecisionStatus.NEW,
      displayOrder: decision?.displayOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: DecisionFormInput) =>
      isEdit && decision
        ? decisionService.update(projectId, decision.id, values)
        : decisionService.create(projectId, values),
    onSuccess: () => {
      toast.success(isEdit ? 'تصمیم ویرایش شد' : 'تصمیم افزوده شد');
      onSaved();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'ویرایش تصمیم' : 'افزودن تصمیم'}
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
        <Field label="موضوع دستور" error={errors.subject?.message}>
          <Input {...register('subject')} />
        </Field>
        <Field label="شرح دستور" error={errors.description?.message}>
          <Textarea rows={2} {...register('description')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="مسئول" error={errors.owner?.message}>
            <Input {...register('owner')} />
          </Field>
          <Field label="مهلت اجرا" error={errors.dueDate?.message}>
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
        <Field label="وضعیت" error={errors.status?.message}>
          <Select options={STATUS_OPTIONS} {...register('status')} />
        </Field>
      </form>
    </Modal>
  );
}
