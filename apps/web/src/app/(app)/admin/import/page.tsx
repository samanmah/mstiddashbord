'use client';

import type { ImportPreviewResult } from '@ppm/contracts';
import { VALIDATION, toPersianDigits } from '@ppm/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isApiError } from '@/lib/api-error';
import { importService } from '@/lib/services';
import { faNumber, faPercent } from '@/lib/utils';

const ACCEPTED = ['.xlsx', '.xlsm'];

export default function ImportPage(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const previewMutation = useMutation({
    mutationFn: (f: File) => importService.preview(f),
    onSuccess: (result) => {
      setPreview(result);
      if (result.isValid) {
        toast.success('فایل با موفقیت تحلیل شد');
      } else {
        toast.error('فایل دارای خطاست. جزئیات را بررسی کنید.');
      }
    },
    onError: (e) => {
      setPreview(null);
      toast.error(isApiError(e) ? e.message : 'تحلیل فایل ناموفق بود');
    },
  });

  const commitMutation = useMutation({
    mutationFn: (p: ImportPreviewResult) =>
      importService.commit({ storedFilename: p.storedFilename, fileHash: p.fileHash }),
    onSuccess: (res) => {
      toast.success('اطلاعات با موفقیت وارد شد');
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/dashboard/projects/${res.projectId}`);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ثبت نهایی ناموفق بود'),
  });

  const handleFile = (f: File): void => {
    const name = f.name.toLowerCase();
    if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
      toast.error('فقط فایل‌های XLSX یا XLSM مجاز هستند.');
      return;
    }
    if (f.size > VALIDATION.UPLOAD_MAX_BYTES) {
      toast.error('حجم فایل بیش از حد مجاز (۲۰ مگابایت) است.');
      return;
    }
    setFile(f);
    setPreview(null);
    previewMutation.mutate(f);
  };

  const reset = (): void => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <PageHeader
        title="ورود اطلاعات از Excel"
        description="فایل منشور پروژه را بارگذاری کنید. عملیات ورود، اتمیک است و در صورت خطا هیچ داده‌ای ذخیره نمی‌شود."
      />

      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-brand-blue bg-brand-blue/5' : 'border-borderx bg-white'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) handleFile(dropped);
        }}
      >
        <Upload className="h-10 w-10 text-grayx-dot" aria-hidden />
        <p className="text-sm text-ink">فایل را اینجا رها کنید یا از دکمهٔ زیر انتخاب کنید</p>
        <p className="text-xs text-grayx-header">قالب مجاز: XLSX یا XLSM — حداکثر ۲۰ مگابایت</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} loading={previewMutation.isPending}>
          <FileSpreadsheet className="h-4 w-4" /> انتخاب فایل
        </Button>
        {file ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-page px-3 py-1.5 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-navy-700" />
            {file.name}
            <button onClick={reset} aria-label="حذف فایل" className="text-brand-red">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-6 space-y-4">
          <Card
            title="پیش‌نمایش داده‌ها"
            headerTone={preview.isValid ? 'navy' : 'orange'}
          >
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="پروژه" value={faNumber(preview.counts.projects)} />
              <Metric label="ماه‌ها" value={faNumber(preview.counts.months)} />
              <Metric label="فعالیت‌ها" value={faNumber(preview.counts.activities)} />
              <Metric label="ریسک‌ها" value={faNumber(preview.counts.risks)} />
              <Metric label="تصمیمات" value={faNumber(preview.counts.decisions)} />
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-lg bg-page p-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-grayx-header">نام پروژه: </span>
                <span className="font-medium">{preview.project.titleFa}</span>
              </div>
              <div>
                <span className="text-grayx-header">مسئول: </span>
                <span className="font-medium">{preview.project.projectManager}</span>
              </div>
              <div>
                <span className="text-grayx-header">پیشرفت برنامه‌ای کل: </span>
                <span className="font-medium">{faPercent(preview.computed.plannedProjectProgress)}</span>
              </div>
              <div>
                <span className="text-grayx-header">پیشرفت واقعی کل: </span>
                <span className="font-medium">{faPercent(preview.computed.actualProjectProgress)}</span>
              </div>
            </div>
          </Card>

          {preview.errors.length > 0 ? (
            <Card title={`خطاها و هشدارها (${toPersianDigits(preview.errors.length)})`} headerTone="orange">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>شیت</th>
                      <th>سطر</th>
                      <th>ستون</th>
                      <th>مقدار</th>
                      <th className="text-right">پیام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((err, i) => (
                      <tr key={i}>
                        <td>{err.sheet ?? '—'}</td>
                        <td>{err.row !== undefined ? toPersianDigits(err.row) : '—'}</td>
                        <td>{err.column ?? '—'}</td>
                        <td>{err.value ?? '—'}</td>
                        <td className="text-right text-brand-red">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <div className="flex items-center justify-between rounded-card border border-borderx bg-white p-4">
            <div className="flex items-center gap-2 text-sm">
              {preview.isValid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-brand-green" />
                  <span className="text-brand-green">فایل معتبر است و آمادهٔ ثبت نهایی می‌باشد.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-brand-red" />
                  <span className="text-brand-red">
                    به‌دلیل وجود خطا، امکان ثبت نهایی وجود ندارد.
                  </span>
                </>
              )}
            </div>
            <Button
              disabled={!preview.isValid}
              loading={commitMutation.isPending}
              onClick={() => commitMutation.mutate(preview)}
            >
              تأیید و ثبت نهایی
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-borderx bg-white p-3 text-center">
      <p className="text-xs text-grayx-header">{label}</p>
      <p className="mt-1 text-xl font-bold text-navy-900">{value}</p>
    </div>
  );
}
