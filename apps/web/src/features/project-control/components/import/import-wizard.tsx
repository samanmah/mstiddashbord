'use client';

import { toPersianDigits } from '@ppm/contracts';
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Info,
  ShieldQuestion,
  Trash2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { cn, faNumber } from '@/lib/utils';
import {
  ImportIssueLevel,
  type ControlImportCommitResult,
  type ControlImportPreview,
  type ImportBatchDto,
} from '../../api/project-control-types';
import {
  useCommitImport,
  useMapImport,
  useMppCheck,
  usePreviewImport,
  useUploadImport,
  useValidateImport,
} from '../../hooks/use-control-imports';
import { ConflictResolver, decisionsToMappings, type ConflictDecision } from './conflict-resolver';
import { ManifestTable } from './manifest-table';
import { StructurePreview } from './structure-preview';

const STEPS = [
  'بارگذاری',
  'Manifest',
  'ساختار',
  'تعارض‌ها',
  'کیفیت داده',
  'اجرای آزمایشی',
  'ثبت نهایی',
  'نتیجه',
];

const MAX_BYTES = 25 * 1024 * 1024;

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export function ImportWizard({ projectId }: { projectId: string }): React.JSX.Element {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [batch, setBatch] = useState<ImportBatchDto | null>(null);
  const [preview, setPreview] = useState<ControlImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ConflictDecision>>({});
  const [allowWarnings, setAllowWarnings] = useState(false);
  const [result, setResult] = useState<ControlImportCommitResult | null>(null);

  const upload = useUploadImport(projectId);
  const previewMut = usePreviewImport(projectId);
  const mapMut = useMapImport(projectId);
  const validateMut = useValidateImport(projectId);
  const commitMut = useCommitImport(projectId);
  const mppCheck = useMppCheck(projectId);

  const onSelectFile = (f: File | null): void => {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.mpp')) {
      toast.error('فقط فایل‌های xlsx/xlsm/mpp پذیرفته می‌شوند');
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error('حجم فایل بیش از حد مجاز است');
      return;
    }
    setFile(f);
    setHash(null);
    void sha256Hex(f).then(setHash);
  };

  const startUpload = (): void => {
    if (!file) return;
    const isMpp = file.name.toLowerCase().endsWith('.mpp');
    upload.mutate(
      { file, sourceType: isMpp ? 'MPP' : 'EXCEL' },
      {
        onSuccess: (b) => {
          setBatch(b);
          previewMut.mutate(
            { id: b.id, dryRun: true },
            {
              onSuccess: (p) => {
                setPreview(p);
                setStep(1);
              },
              onError: (e) =>
                toast.error(
                  isApiError(e)
                    ? e.message
                    : 'تحلیل فایل ناموفق بود. برای فایل MPP، محیط Java لازم است.',
                ),
            },
          );
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'بارگذاری ناموفق بود'),
      },
    );
  };

  const applyMapping = (): void => {
    if (!batch || !preview) return;
    const mappings = decisionsToMappings(preview.conflicts, decisions);
    mapMut.mutate(
      { id: batch.id, mappings },
      {
        onSuccess: (p) => {
          setPreview(p);
          toast.success('تصمیم‌های تطبیق اعمال شد');
          setStep(4);
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'اعمال تطبیق ناموفق بود'),
      },
    );
  };

  const runDryRun = (): void => {
    if (!batch) return;
    validateMut.mutate(batch.id, {
      onSuccess: (p) => {
        setPreview(p);
        setStep(5);
      },
      onError: (e) => toast.error(isApiError(e) ? e.message : 'اجرای آزمایشی ناموفق بود'),
    });
  };

  const runCommit = (): void => {
    if (!batch) return;
    commitMut.mutate(
      { id: batch.id, allowWarnings },
      {
        onSuccess: (r) => {
          setResult(r);
          setStep(7);
          toast.success('ورود اطلاعات با موفقیت ثبت شد');
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'ثبت نهایی ناموفق بود'),
      },
    );
  };

  const criticalBlock = preview ? preview.criticalCount > 0 || !preview.canCommit : true;

  return (
    <div data-testid="import-wizard" className="space-y-4">
      <Stepper step={step} />

      {/* Step 0: Upload */}
      {step === 0 ? (
        <div className="card space-y-4 p-4">
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-borderx p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onSelectFile(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <FileUp className="h-8 w-8 text-brand-blue" aria-hidden />
            <p className="text-sm text-grayx-header">فایل Excel (xlsx/xlsm) یا MPP را اینجا رها کنید</p>
            <label className="cursor-pointer text-sm font-medium text-brand-blue hover:underline">
              انتخاب فایل
              <input
                type="file"
                accept=".xlsx,.xlsm,.mpp"
                className="hidden"
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {file ? (
            <div className="flex items-center justify-between rounded border border-borderx p-3">
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-grayx-header">
                  {faNumber(Math.round(file.size / 1024))} کیلوبایت
                  {hash ? ` — Hash: ${hash.slice(0, 12)}…` : ' — در حال محاسبهٔ Hash…'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setHash(null);
                }}
                className="rounded p-1.5 text-brand-red hover:bg-page"
                aria-label="حذف فایل"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <p className="rounded bg-brand-blue/8 p-2 text-xs text-brand-blue">
            فایل خام شما فقط برای پردازش به سرور ارسال می‌شود و در مرورگر ذخیره نمی‌گردد. این فایل‌ها
            محرمانه تلقی می‌شوند.
          </p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void mppCheck.refetch()}>
                <ShieldQuestion className="h-4 w-4" /> بررسی محیط MPP
              </Button>
              {mppCheck.isFetchedAfterMount && mppCheck.data ? (
                <StatusBadge
                  tone={mppCheck.data.mpxjAvailable ? 'green' : 'orange'}
                  label={mppCheck.data.mpxjAvailable ? 'MPP آماده است' : 'MPP در دسترس نیست'}
                  showDot={false}
                />
              ) : null}
            </div>
            <Button onClick={startUpload} disabled={!file} loading={upload.isPending || previewMut.isPending}>
              بارگذاری و تحلیل
            </Button>
          </div>

          {mppCheck.data && !mppCheck.data.mpxjAvailable ? (
            <p className="text-xs text-grayx-header">{mppCheck.data.message}</p>
          ) : null}
        </div>
      ) : null}

      {/* Steps 1..5 require preview */}
      {step >= 1 && step <= 5 && preview ? (
        <div className="card space-y-4 p-4">
          {step === 1 ? <ManifestTable preview={preview} /> : null}
          {step === 2 ? <StructurePreview preview={preview} /> : null}
          {step === 3 ? (
            <ConflictResolver
              conflicts={preview.conflicts}
              decisions={decisions}
              onChange={(row, d) => setDecisions((prev) => ({ ...prev, [row]: d }))}
            />
          ) : null}
          {step === 4 ? <IssuesPanel preview={preview} /> : null}
          {step === 5 ? <DryRunPanel preview={preview} /> : null}

          <WizardNav
            step={step}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            onNext={() => {
              if (step === 3) applyMapping();
              else if (step === 4) runDryRun();
              else setStep((s) => s + 1);
            }}
            nextLabel={step === 3 ? 'اعمال تطبیق' : step === 4 ? 'اجرای آزمایشی' : 'مرحلهٔ بعد'}
            nextLoading={mapMut.isPending || validateMut.isPending}
          />
        </div>
      ) : null}

      {/* Step 6: Commit */}
      {step === 6 && preview ? (
        <div className="card space-y-4 p-4">
          <h3 className="text-sm font-bold text-navy-900">ثبت نهایی (اتمیک)</h3>
          <p className="text-sm text-grayx-header">
            این عملیات به‌صورت اتمیک انجام می‌شود؛ در صورت بروز خطا هیچ تغییری اعمال نمی‌شود (Rollback
            کامل).
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="نودهای جدید" value={preview.counts.totalNodes} />
            <SummaryStat label="تعارض‌ها" value={preview.conflicts.length} />
            <SummaryStat label="هشدارها" value={preview.warningCount} />
            <SummaryStat label="خطاهای بحرانی" value={preview.criticalCount} tone="red" />
          </div>
          {preview.warningCount > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowWarnings}
                onChange={(e) => setAllowWarnings(e.target.checked)}
              />
              با وجود هشدارها ادامه بده
            </label>
          ) : null}
          {criticalBlock ? (
            <p className="flex items-center gap-1 rounded bg-brand-red/8 p-2 text-xs text-brand-red">
              <AlertTriangle className="h-4 w-4" /> به‌دلیل وجود خطای بحرانی، امکان ثبت نهایی وجود ندارد.
            </p>
          ) : null}
          <WizardNav
            step={step}
            onBack={() => setStep(5)}
            onNext={runCommit}
            nextLabel="ثبت نهایی"
            nextLoading={commitMut.isPending}
            nextDisabled={criticalBlock}
            nextVariant="primary"
          />
        </div>
      ) : null}

      {/* Step 7: Result */}
      {step === 7 && result ? (
        <div className="card space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-green" aria-hidden />
          <h3 className="text-base font-bold text-navy-900">ورود اطلاعات با موفقیت انجام شد</h3>
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3 text-sm">
            <SummaryStat label="نودهای ایجادشده" value={result.createdNodes} />
            <SummaryStat label="نودهای به‌روزشده" value={result.updatedNodes} />
          </div>
          <p className="text-xs text-grayx-header">شناسهٔ دسته: {result.importBatchId}</p>
          <div className="flex items-center justify-center gap-2">
            <Link href={`/admin/projects/${projectId}/control/wbs`}>
              <Button variant="secondary">مشاهدهٔ WBS</Button>
            </Link>
            <Link href={`/admin/projects/${projectId}/control/overview`}>
              <Button>نمای کلی</Button>
            </Link>
          </div>
        </div>
      ) : null}

      {step >= 6 && !preview && !result ? (
        <EmptyState title="ابتدا فایل را بارگذاری و تحلیل کنید" />
      ) : null}
    </div>
  );
}

function Stepper({ step }: { step: number }): React.JSX.Element {
  return (
    <div className="card flex items-center gap-1 overflow-x-auto p-3">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
              i < step
                ? 'bg-brand-green text-white'
                : i === step
                  ? 'bg-navy-800 text-white'
                  : 'bg-grayx-dot/20 text-grayx-header',
            )}
          >
            {toPersianDigits(String(i + 1))}
          </span>
          <span
            className={cn(
              'whitespace-nowrap text-xs',
              i === step ? 'font-bold text-navy-900' : 'text-grayx-header',
            )}
          >
            {label}
          </span>
          {i < STEPS.length - 1 ? <span className="mx-1 text-grayx-dot">—</span> : null}
        </div>
      ))}
    </div>
  );
}

function WizardNav({
  step,
  onBack,
  onNext,
  nextLabel,
  nextLoading,
  nextDisabled,
  nextVariant = 'primary',
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextLoading?: boolean;
  nextDisabled?: boolean;
  nextVariant?: 'primary' | 'secondary';
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-t border-borderx pt-3">
      <Button variant="secondary" onClick={onBack} disabled={step === 0}>
        مرحلهٔ قبل
      </Button>
      <Button variant={nextVariant} onClick={onNext} loading={nextLoading} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

function IssuesPanel({ preview }: { preview: ControlImportPreview }): React.JSX.Element {
  const groups = [
    { level: ImportIssueLevel.CRITICAL, tone: 'red' as const, icon: XCircle, label: 'بحرانی' },
    { level: ImportIssueLevel.WARNING, tone: 'orange' as const, icon: AlertTriangle, label: 'هشدار' },
    { level: ImportIssueLevel.INFO, tone: 'blue' as const, icon: Info, label: 'اطلاع' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="red" label={`بحرانی: ${faNumber(preview.criticalCount)}`} showDot={false} />
        <StatusBadge tone="orange" label={`هشدار: ${faNumber(preview.warningCount)}`} showDot={false} />
        <StatusBadge tone="blue" label={`اطلاع: ${faNumber(preview.infoCount)}`} showDot={false} />
      </div>
      {groups.map((g) => {
        const items = preview.issues.filter((i) => i.level === g.level);
        if (items.length === 0) return null;
        return (
          <div key={g.level}>
            <h4 className="mb-1 flex items-center gap-1 text-xs font-bold text-navy-900">
              <g.icon className="h-4 w-4" /> {g.label}
            </h4>
            <ul className="space-y-1 text-xs">
              {items.slice(0, 50).map((it, idx) => (
                <li key={idx} className="rounded bg-page p-2">
                  {it.row ? `سطر ${toPersianDigits(String(it.row))}: ` : ''}
                  {it.message}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {preview.issues.length === 0 ? (
        <p className="text-sm text-brand-green">مسئله‌ای شناسایی نشد.</p>
      ) : null}
    </div>
  );
}

function DryRunPanel({ preview }: { preview: ControlImportPreview }): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryStat label="نودهای جدید" value={preview.counts.totalNodes} tone="green" />
        <SummaryStat label="تعارض‌ها" value={preview.conflicts.length} tone="orange" />
        <SummaryStat label="هشدارها" value={preview.warningCount} tone="orange" />
        <SummaryStat label="بحرانی" value={preview.criticalCount} tone="red" />
        <SummaryStat label="اطلاع" value={preview.infoCount} />
      </div>
      <p className="text-xs text-grayx-header">
        اجرای آزمایشی هیچ تغییری در پایگاه‌داده ایجاد نمی‌کند. برای ثبت نهایی به مرحلهٔ بعد بروید.
      </p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'green' | 'orange' | 'red';
}): React.JSX.Element {
  const color =
    tone === 'green'
      ? 'text-brand-green'
      : tone === 'orange'
        ? 'text-brand-orange'
        : tone === 'red'
          ? 'text-brand-red'
          : 'text-navy-900';
  return (
    <div className="rounded border border-borderx p-3 text-center">
      <div className={cn('text-lg font-bold', color)}>{faNumber(value)}</div>
      <div className="text-[11px] text-grayx-header">{label}</div>
    </div>
  );
}
