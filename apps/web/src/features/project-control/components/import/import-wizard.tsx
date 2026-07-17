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
  assertImportBatchId,
  IMPORT_BATCH_ID_MISSING_MESSAGE,
} from '../../api/project-control-api';
import {
  ImportCommitMode,
  ImportIssueLevel,
  type ControlImportCommitResult,
  type ControlImportPreview,
  type ImportCommitModeType,
} from '../../api/project-control-types';
import {
  useActivateControlPlan,
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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ControlImportPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ConflictDecision>>({});
  const [allowWarnings, setAllowWarnings] = useState(false);
  const [commitMode, setCommitMode] = useState<ImportCommitModeType | null>(null);
  const [result, setResult] = useState<ControlImportCommitResult | null>(null);

  const upload = useUploadImport(projectId);
  const previewMut = usePreviewImport(projectId);
  const mapMut = useMapImport(projectId);
  const validateMut = useValidateImport(projectId);
  const commitMut = useCommitImport(projectId);
  const activatePlanMut = useActivateControlPlan(projectId);
  const mppCheck = useMppCheck(projectId);

  const resolvedCommitMode: ImportCommitModeType =
    commitMode ??
    preview?.suggestedCommitMode ??
    (preview?.existingCommittedImport
      ? ImportCommitMode.REUSE_EXISTING
      : ImportCommitMode.CREATE_NEW_VERSION);

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
        onSuccess: (uploadResult) => {
          const importBatchId = uploadResult.importBatchId;
          try {
            assertImportBatchId(importBatchId);
          } catch (e) {
            toast.error(isApiError(e) ? e.message : IMPORT_BATCH_ID_MISSING_MESSAGE);
            return;
          }
          setBatchId(importBatchId);
          previewMut.mutate(
            { id: importBatchId, dryRun: true },
            {
              onSuccess: (p) => {
                setPreview(p);
                setCommitMode(p.suggestedCommitMode);
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

  const goToDataQuality = (): void => {
    setStep(4);
  };

  const conflictsReady =
    !preview ||
    preview.conflicts.length === 0 ||
    preview.conflicts.every((c) => decisions[c.sourceRow] != null);

  const applyMapping = (): void => {
    if (!preview) return;
    // بدون تعارض: درخواست Mapping ارسال نمی‌شود.
    if (preview.conflicts.length === 0) {
      goToDataQuality();
      return;
    }
    if (!batchId || !conflictsReady) return;
    const mappings = decisionsToMappings(preview.conflicts, decisions);
    mapMut.mutate(
      { id: batchId, mappings },
      {
        onSuccess: () => {
          // پاسخ map فقط { updated } است — Preview را خراب نکن.
          toast.success('تصمیم‌های تطبیق اعمال شد');
          goToDataQuality();
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'اعمال تطبیق ناموفق بود'),
      },
    );
  };

  const runDryRun = (): void => {
    if (!batchId) return;
    validateMut.mutate(batchId, {
      onSuccess: (p) => {
        setPreview(p);
        setStep(5);
      },
      onError: (e) => toast.error(isApiError(e) ? e.message : 'اجرای آزمایشی ناموفق بود'),
    });
  };

  const runCommit = (): void => {
    if (!batchId) return;
    commitMut.mutate(
      { id: batchId, allowWarnings, mode: resolvedCommitMode },
      {
        onSuccess: (r) => {
          setResult(r);
          setStep(7);
          toast.success(
            r.reusedExisting
              ? 'از نسخهٔ موجود Import استفاده شد'
              : 'نسخهٔ جدید برنامه کنترل با موفقیت ثبت شد',
          );
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'ثبت نهایی ناموفق بود'),
      },
    );
  };

  const runRollback = (): void => {
    if (!result?.previousControlPlanId || !result.rollbackAvailable) return;
    const ok = window.confirm(
      'آیا از بازگشت به نسخهٔ قبلی برنامه کنترل مطمئن هستید؟ نسخهٔ فعلی غیرفعال می‌شود ولی حذف نمی‌گردد.',
    );
    if (!ok) return;
    activatePlanMut.mutate(result.previousControlPlanId, {
      onSuccess: () => toast.success('بازگشت به نسخهٔ قبلی انجام شد'),
      onError: (e) => toast.error(isApiError(e) ? e.message : 'بازگشت ناموفق بود'),
    });
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
                  tone={
                    mppCheck.data.javaAvailable && mppCheck.data.mpxjAvailable
                      ? 'green'
                      : 'orange'
                  }
                  label={
                    mppCheck.data.javaAvailable && mppCheck.data.mpxjAvailable
                      ? 'MPP آماده است'
                      : 'MPP در دسترس نیست'
                  }
                  showDot={false}
                />
              ) : null}
            </div>
            <Button onClick={startUpload} disabled={!file} loading={upload.isPending || previewMut.isPending}>
              بارگذاری و تحلیل
            </Button>
          </div>

          {mppCheck.data && !(mppCheck.data.javaAvailable && mppCheck.data.mpxjAvailable) ? (
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
            nextLabel={
              step === 3
                ? preview.conflicts.length === 0
                  ? 'مرحلهٔ بعد'
                  : 'اعمال تطبیق'
                : step === 4
                  ? 'اجرای آزمایشی'
                  : 'مرحلهٔ بعد'
            }
            nextLoading={mapMut.isPending || validateMut.isPending}
            nextDisabled={step === 3 && preview.conflicts.length > 0 && !conflictsReady}
          />
        </div>
      ) : null}

      {/* Step 6: Commit */}
      {step === 6 && preview ? (
        <div className="card space-y-4 p-4">
          <h3 className="text-sm font-bold text-navy-900">ثبت نهایی (اتمیک و نسخه‌دار)</h3>
          <p className="rounded bg-brand-blue/8 p-3 text-sm text-navy-900">
            ثبت نهایی یک نسخه جدید از برنامه کنترل پروژه ایجاد می‌کند و نسخه فعلی را برای بازگشت حفظ
            می‌کند.
          </p>
          <PeriodMatrixPanel preview={preview} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="نودهای جدید" value={preview.counts.totalNodes} />
            <SummaryStat label="نسخهٔ فعلی" value={preview.currentPlanVersion ?? 0} />
            <SummaryStat label="نسخهٔ جدید" value={preview.nextPlanVersion ?? 1} />
            <SummaryStat label="خطاهای بحرانی" value={preview.criticalCount} tone="red" />
          </div>
          <p className="text-xs text-grayx-header" dir="ltr">
            File hash: {preview.fileHash}
          </p>
          {preview.existingCommittedImport ? (
            <div className="space-y-2 rounded border border-borderx p-3">
              <p className="text-sm font-medium text-navy-900">
                همین فایل قبلاً Commit شده است (نسخه{' '}
                {toPersianDigits(String(preview.existingCommittedImport.planVersion))}).
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="commit-mode"
                  checked={resolvedCommitMode === ImportCommitMode.REUSE_EXISTING}
                  onChange={() => setCommitMode(ImportCommitMode.REUSE_EXISTING)}
                />
                استفاده از نسخهٔ موجود (پیش‌فرض امن)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="commit-mode"
                  checked={resolvedCommitMode === ImportCommitMode.CREATE_NEW_VERSION}
                  onChange={() => setCommitMode(ImportCommitMode.CREATE_NEW_VERSION)}
                />
                ایجاد نسخهٔ جدید از همان فایل
              </label>
            </div>
          ) : null}
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
          <h3 className="text-base font-bold text-navy-900">
            {result.reusedExisting
              ? 'از نسخهٔ موجود Import استفاده شد'
              : 'ورود نسخه‌ای با موفقیت انجام شد'}
          </h3>
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <SummaryStat label="نودهای ایجادشده" value={result.createdNodes} />
            <SummaryStat label="Snapshot دوره‌ای" value={result.periodSnapshotsCreated} />
            <SummaryStat label="انتساب‌ها" value={result.assignmentsCreated} />
            <SummaryStat label="وابستگی‌ها" value={result.dependenciesCreated} />
            <SummaryStat label="نسخهٔ جدید" value={result.newPlanVersion} />
            <SummaryStat label="نسخهٔ قبلی" value={result.previousPlanVersion ?? 0} />
          </div>
          <div className="space-y-1 text-xs text-grayx-header">
            <p>شناسهٔ دسته: {result.importBatchId}</p>
            <p>Control Plan: {result.controlPlanId}</p>
            <p dir="ltr">fileHash: {result.fileHash}</p>
            <p>
              active plan switched={String(result.activePlanSwitched)} — rollback available=
              {String(result.rollbackAvailable)} — duration={faNumber(result.durationMs)}ms
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href={`/admin/projects/${projectId}/control/wbs`}>
              <Button variant="secondary">مشاهده ساختار شکست کار</Button>
            </Link>
            <Link href={`/admin/projects/${projectId}/control/gantt`}>
              <Button variant="secondary">مشاهده گانت</Button>
            </Link>
            <Link href={`/admin/projects/${projectId}/control/progress`}>
              <Button variant="secondary">مشاهده پیشرفت</Button>
            </Link>
            <Link href={`/admin/projects/${projectId}/control/data-quality`}>
              <Button variant="secondary">مشاهده کیفیت داده</Button>
            </Link>
            {result.rollbackAvailable && result.previousControlPlanId ? (
              <Button
                variant="ghost"
                loading={activatePlanMut.isPending}
                onClick={runRollback}
              >
                بازگشت به نسخه قبلی
              </Button>
            ) : null}
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
      <PeriodMatrixPanel preview={preview} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryStat label="نسخهٔ Plan فعلی" value={preview.currentPlanVersion ?? 0} />
        <SummaryStat label="نسخهٔ Plan جدید" value={preview.nextPlanVersion ?? 1} />
        <SummaryStat
          label="Import موجود"
          value={preview.existingCommittedImport ? 1 : 0}
          tone={preview.existingCommittedImport ? 'orange' : 'neutral'}
        />
      </div>
      <p className="text-xs text-grayx-header">
        حالت پیشنهادی: {preview.suggestedCommitMode} — اجرای آزمایشی هیچ تغییری در پایگاه‌داده ایجاد
        نمی‌کند.
      </p>
    </div>
  );
}

function PeriodMatrixPanel({ preview }: { preview: ControlImportPreview }): React.JSX.Element {
  const s = preview.periodMatrixStats;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-navy-900">ماتریس دوره‌ای</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <SummaryStat label="ستون‌های دوره‌ای" value={s.periodColumnCount} />
        <SummaryStat label="مقدار Parse‌شده" value={s.periodSnapshotsParsed} />
        <SummaryStat label="Planned" value={s.plannedCount} />
        <SummaryStat label="Actual" value={s.actualCount} />
        <SummaryStat label="Unknown" value={s.unknownCount} />
        <SummaryStat label="صفر صریح" value={s.explicitZeroCount} />
        <SummaryStat label="فرمول" value={s.formulaCount} />
        <SummaryStat label="فرمول بدون cache" value={s.formulaWithoutCachedResultCount} tone="orange" />
        <SummaryStat label="Snapshot قابل‌ثبت" value={s.periodSnapshotsParsed} tone="green" />
      </div>
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
