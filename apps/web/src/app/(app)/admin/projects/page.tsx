'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { projectFormSchema, type ProjectFormInput } from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, FileSpreadsheet, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import type { ProjectDto } from '@ppm/contracts';
import { apiDownload, triggerDownload } from '@/lib/api-client';
import { isApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';
import { faNumber, isoToJalaliFa } from '@/lib/utils';

export default function ProjectsListPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDto | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectService.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectService.remove(id),
    onSuccess: () => {
      toast.success('پروژه حذف شد');
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'حذف ناموفق بود'),
  });

  const exportMutation = useMutation({
    mutationFn: async (id: string) => apiDownload(`/projects/${id}/export/excel`),
    onSuccess: ({ blob, filename }) => {
      triggerDownload(blob, filename);
      toast.success('فایل Excel آماده شد');
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'خروجی ناموفق بود'),
  });

  if (isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const projects = data ?? [];

  return (
    <>
      <PageHeader
        title="پروژه‌ها"
        description="فهرست پروژه‌های ثبت‌شده در سامانه"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> پروژهٔ جدید
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="هنوز پروژه‌ای ثبت نشده است"
          description="پروژهٔ جدیدی بسازید یا از فایل Excel وارد کنید."
          action={
            <Link href="/admin/import" className="btn btn-secondary">
              <FileSpreadsheet className="h-4 w-4" /> ورود از Excel
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-navy-900">{p.titleFa}</h3>
                  {p.titleEn ? (
                    <p className="truncate text-xs text-grayx-header" dir="ltr">
                      {p.titleEn}
                    </p>
                  ) : null}
                </div>
                <span
                  className={
                    p.isActive
                      ? 'badge bg-brand-green/12 text-brand-green'
                      : 'badge bg-grayx-dot/15 text-grayx-header'
                  }
                >
                  {p.isActive ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-grayx-header">
                <div className="flex justify-between">
                  <dt>مسئول</dt>
                  <dd className="font-medium text-ink">{p.projectManager}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>بودجه</dt>
                  <dd className="font-medium text-ink">{faNumber(p.budgetBillionRial)} م.ریال</dd>
                </div>
                <div className="flex justify-between">
                  <dt>تاریخ گزارش</dt>
                  <dd className="font-medium text-ink">{isoToJalaliFa(p.reportDate)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/projects/${p.id}/general`}
                  className="btn btn-primary btn-sm px-3 py-1.5 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" /> ویرایش
                </Link>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> داشبورد
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportMutation.mutate(p.id)}
                  loading={exportMutation.isPending && exportMutation.variables === p.id}
                >
                  <Download className="h-3.5 w-3.5" /> Excel
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
                  <Trash2 className="h-3.5 w-3.5 text-brand-red" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating ? (
        <CreateProjectModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف پروژه"
        message={`آیا از حذف پروژهٔ «${deleteTarget?.titleFa ?? ''}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function CreateProjectModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      titleFa: '',
      titleEn: '',
      projectCode: '',
      projectManager: '',
      projectType: 'استراتژیک',
      budgetBillionRial: 0,
      description: '',
      startDate: '',
      plannedEndDate: '',
      reportDate: '',
      isActive: true,
      version: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProjectFormInput) => {
      const { version: _version, ...payload } = values;
      return projectService.create(payload);
    },
    onSuccess: (project) => {
      toast.success('پروژه ایجاد شد');
      onSaved();
      router.push(`/admin/projects/${project.id}/general`);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ایجاد ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="ایجاد پروژهٔ جدید"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            ایجاد پروژه
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="عنوان فارسی" required error={errors.titleFa?.message}>
            <Input hasError={Boolean(errors.titleFa)} {...register('titleFa')} />
          </Field>
          <Field label="عنوان انگلیسی" error={errors.titleEn?.message}>
            <Input dir="ltr" {...register('titleEn')} />
          </Field>
          <Field label="مسئول پروژه" required error={errors.projectManager?.message}>
            <Input hasError={Boolean(errors.projectManager)} {...register('projectManager')} />
          </Field>
          <Field label="نوع پروژه" required error={errors.projectType?.message}>
            <Input hasError={Boolean(errors.projectType)} {...register('projectType')} />
          </Field>
          <Field label="کد پروژه" error={errors.projectCode?.message}>
            <Input {...register('projectCode')} />
          </Field>
          <Field label="بودجه مصوب (میلیارد ریال)" required error={errors.budgetBillionRial?.message}>
            <Input
              type="number"
              step="any"
              dir="ltr"
              hasError={Boolean(errors.budgetBillionRial)}
              {...register('budgetBillionRial', { valueAsNumber: true })}
            />
          </Field>
        </div>
        <Field label="شرح پروژه" error={errors.description?.message}>
          <Textarea rows={2} {...register('description')} />
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="تاریخ شروع" required error={errors.startDate?.message}>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <JalaliDateInput value={field.value} onChange={field.onChange} hasError={Boolean(errors.startDate)} />
              )}
            />
          </Field>
          <Field label="تاریخ پایان برنامه‌ای" required error={errors.plannedEndDate?.message}>
            <Controller
              control={control}
              name="plannedEndDate"
              render={({ field }) => (
                <JalaliDateInput value={field.value} onChange={field.onChange} hasError={Boolean(errors.plannedEndDate)} />
              )}
            />
          </Field>
          <Field label="تاریخ گزارش" required error={errors.reportDate?.message}>
            <Controller
              control={control}
              name="reportDate"
              render={({ field }) => (
                <JalaliDateInput value={field.value} onChange={field.onChange} hasError={Boolean(errors.reportDate)} />
              )}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
