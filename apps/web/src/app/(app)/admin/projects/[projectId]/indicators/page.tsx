'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { IndicatorDto } from '@ppm/contracts';
import { indicatorFormSchema, type IndicatorFormInput } from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { indicatorService } from '@/lib/services';
import { faNumber, orDash } from '@/lib/utils';

export default function IndicatorsPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<IndicatorDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IndicatorDto | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.indicators(projectId),
    queryFn: () => indicatorService.list(projectId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.indicators(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => indicatorService.remove(projectId, id),
    onSuccess: () => {
      toast.success('شاخص حذف شد');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'حذف ناموفق بود'),
  });

  const primaryMutation = useMutation({
    mutationFn: (item: IndicatorDto) =>
      indicatorService.update(projectId, item.id, { isPrimary: true }),
    onSuccess: () => {
      toast.success('شاخص اصلی تعیین شد');
      invalidate();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'عملیات ناموفق بود'),
  });

  if (isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const indicators = data ?? [];

  return (
    <>
      <PageHeader
        title="مدیریت شاخص‌ها"
        description="شاخص‌های اثربخشی پروژه را مدیریت کنید. تنها یک شاخص می‌تواند اصلی باشد."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> افزودن شاخص
          </Button>
        }
      />

      {indicators.length === 0 ? (
        <EmptyState title="شاخصی تعریف نشده است" />
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-right">عنوان</th>
                <th className="w-24">واحد</th>
                <th className="w-24">برنامه‌ای</th>
                <th className="w-24">واقعی</th>
                <th className="w-20">اصلی</th>
                <th className="w-28">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((item) => (
                <tr key={item.id}>
                  <td className="text-right">{item.title}</td>
                  <td>{orDash(item.unit)}</td>
                  <td>{faNumber(item.plannedValue)}</td>
                  <td>{faNumber(item.actualValue)}</td>
                  <td>
                    {item.isPrimary ? (
                      <span className="inline-flex items-center gap-1 text-brand-orange">
                        <Star className="h-4 w-4 fill-brand-orange" /> اصلی
                      </span>
                    ) : (
                      <button
                        className="text-xs text-brand-blue hover:underline"
                        onClick={() => primaryMutation.mutate(item)}
                      >
                        تعیین به‌عنوان اصلی
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="rounded p-1.5 text-navy-700 hover:bg-page"
                        onClick={() => setEditing(item)}
                        aria-label="ویرایش"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded p-1.5 text-brand-red hover:bg-page"
                        onClick={() => setDeleteTarget(item)}
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
        <IndicatorFormModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <IndicatorFormModal
          projectId={projectId}
          indicator={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف شاخص"
        message={`آیا از حذف شاخص «${deleteTarget?.title ?? ''}» مطمئن هستید؟`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function IndicatorFormModal({
  projectId,
  indicator,
  onClose,
  onSaved,
}: {
  projectId: string;
  indicator?: IndicatorDto;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const isEdit = Boolean(indicator);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IndicatorFormInput>({
    resolver: zodResolver(indicatorFormSchema),
    defaultValues: {
      title: indicator?.title ?? '',
      unit: indicator?.unit ?? '',
      plannedValue: indicator?.plannedValue ?? 0,
      actualValue: indicator?.actualValue ?? 0,
      isPrimary: indicator?.isPrimary ?? false,
      displayOrder: indicator?.displayOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: IndicatorFormInput) =>
      isEdit && indicator
        ? indicatorService.update(projectId, indicator.id, values)
        : indicatorService.create(projectId, values),
    onSuccess: () => {
      toast.success(isEdit ? 'شاخص ویرایش شد' : 'شاخص افزوده شد');
      onSaved();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'ویرایش شاخص' : 'افزودن شاخص'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button
            onClick={handleSubmit((values) => mutation.mutate(values))}
            loading={mutation.isPending}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Field label="عنوان شاخص" required error={errors.title?.message}>
          <Input hasError={Boolean(errors.title)} {...register('title')} />
        </Field>
        <Field label="واحد" error={errors.unit?.message}>
          <Input {...register('unit')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="مقدار برنامه‌ای" required error={errors.plannedValue?.message}>
            <Input
              type="number"
              step="any"
              dir="ltr"
              hasError={Boolean(errors.plannedValue)}
              {...register('plannedValue', { valueAsNumber: true })}
            />
          </Field>
          <Field label="مقدار واقعی" required error={errors.actualValue?.message}>
            <Input
              type="number"
              step="any"
              dir="ltr"
              hasError={Boolean(errors.actualValue)}
              {...register('actualValue', { valueAsNumber: true })}
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register('isPrimary')} />
          شاخص اصلی پروژه
        </label>
      </form>
    </Modal>
  );
}
