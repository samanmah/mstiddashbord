'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { projectFormSchema, type ProjectFormInput } from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Textarea } from '@/components/ui/input';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';
import { faPercent, isoToJalaliInput } from '@/lib/utils';

export default function GeneralPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const queryClient = useQueryClient();
  const [conflictOpen, setConflictOpen] = useState(false);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectService.get(projectId),
  });
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(projectId),
    queryFn: () => projectService.dashboard(projectId),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      titleFa: '',
      titleEn: '',
      projectCode: '',
      projectManager: '',
      projectType: '',
      budgetBillionRial: 0,
      description: '',
      startDate: '',
      plannedEndDate: '',
      reportDate: '',
      isActive: true,
      version: 0,
    },
  });

  useEffect(() => {
    const p = projectQuery.data;
    if (p) {
      reset({
        titleFa: p.titleFa,
        titleEn: p.titleEn ?? '',
        projectCode: p.projectCode ?? '',
        projectManager: p.projectManager,
        projectType: p.projectType,
        budgetBillionRial: p.budgetBillionRial,
        description: p.description ?? '',
        startDate: isoToJalaliInput(p.startDate),
        plannedEndDate: isoToJalaliInput(p.plannedEndDate),
        reportDate: isoToJalaliInput(p.reportDate),
        isActive: p.isActive,
        version: p.version,
      });
    }
  }, [projectQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: ProjectFormInput) => projectService.update(projectId, values),
    onSuccess: (updated) => {
      toast.success('اطلاعات پروژه ذخیره شد');
      queryClient.setQueryData(queryKeys.project(projectId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
      setValue('version', updated.version, { shouldDirty: false });
      reset(undefined, { keepValues: true });
    },
    onError: (error) => {
      if (isApiError(error) && error.isConflict) {
        setConflictOpen(true);
        return;
      }
      toast.error(isApiError(error) ? error.message : 'ذخیره‌سازی ناموفق بود');
    },
  });

  if (projectQuery.isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (projectQuery.isError) {
    return <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />;
  }

  const summary = dashboardQuery.data?.summary;

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="max-w-4xl space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="عنوان فارسی" htmlFor="titleFa" required error={errors.titleFa?.message}>
            <Input id="titleFa" hasError={Boolean(errors.titleFa)} {...register('titleFa')} />
          </Field>
          <Field label="عنوان انگلیسی" htmlFor="titleEn" error={errors.titleEn?.message}>
            <Input id="titleEn" dir="ltr" {...register('titleEn')} />
          </Field>
          <Field label="کد پروژه" htmlFor="projectCode" error={errors.projectCode?.message}>
            <Input id="projectCode" {...register('projectCode')} />
          </Field>
          <Field
            label="مسئول پروژه"
            htmlFor="projectManager"
            required
            error={errors.projectManager?.message}
          >
            <Input
              id="projectManager"
              hasError={Boolean(errors.projectManager)}
              {...register('projectManager')}
            />
          </Field>
          <Field label="نوع پروژه" htmlFor="projectType" required error={errors.projectType?.message}>
            <Input
              id="projectType"
              hasError={Boolean(errors.projectType)}
              {...register('projectType')}
            />
          </Field>
          <Field
            label="بودجه مصوب (میلیارد ریال)"
            htmlFor="budgetBillionRial"
            required
            error={errors.budgetBillionRial?.message}
          >
            <Input
              id="budgetBillionRial"
              type="number"
              step="any"
              dir="ltr"
              hasError={Boolean(errors.budgetBillionRial)}
              {...register('budgetBillionRial', { valueAsNumber: true })}
            />
          </Field>
        </div>

        <Field label="شرح پروژه" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" rows={3} {...register('description')} />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="تاریخ شروع" required error={errors.startDate?.message}>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <JalaliDateInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.startDate)}
                />
              )}
            />
          </Field>
          <Field label="تاریخ پایان برنامه‌ای" required error={errors.plannedEndDate?.message}>
            <Controller
              control={control}
              name="plannedEndDate"
              render={({ field }) => (
                <JalaliDateInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.plannedEndDate)}
                />
              )}
            />
          </Field>
          <Field label="تاریخ گزارش" required error={errors.reportDate?.message}>
            <Controller
              control={control}
              name="reportDate"
              render={({ field }) => (
                <JalaliDateInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.reportDate)}
                />
              )}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-page px-4 py-3 text-sm">
            <span className="text-grayx-header">پیشرفت برنامه‌ای کل (محاسباتی): </span>
            <span className="font-bold text-navy-900">
              {summary ? faPercent(summary.plannedProjectProgress) : '…'}
            </span>
          </div>
          <div className="rounded-lg bg-page px-4 py-3 text-sm">
            <span className="text-grayx-header">پیشرفت واقعی کل (محاسباتی): </span>
            <span className="font-bold text-navy-900">
              {summary ? faPercent(summary.actualProjectProgress) : '…'}
            </span>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register('isActive')} />
          پروژه فعال است
        </label>

        <div className="flex items-center gap-2 border-t border-borderx pt-4">
          <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
            ذخیره تغییرات
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={conflictOpen}
        title="تعارض در ویرایش"
        variant="primary"
        confirmLabel="بارگذاری مجدد اطلاعات"
        cancelLabel="بستن"
        message="این پروژه توسط کاربر دیگری تغییر کرده است. برای جلوگیری از بازنویسی، اطلاعات را دوباره بارگذاری کنید."
        onConfirm={() => {
          setConflictOpen(false);
          void projectQuery.refetch();
        }}
        onCancel={() => setConflictOpen(false)}
      />
    </>
  );
}
