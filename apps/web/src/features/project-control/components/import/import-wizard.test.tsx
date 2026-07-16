import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_BATCH_ID_MISSING_MESSAGE } from '../../api/project-control-api';
import type { ControlImportPreview, UploadImportResult } from '../../api/project-control-types';
import { ImportWizard } from './import-wizard';

const VALID_BATCH_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '3654a149-6fcc-406e-b97c-d0daf62ec502';

const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const uploadImport = vi.fn();
const previewImport = vi.fn();
const mapImport = vi.fn();
const validateImport = vi.fn();
const commitImport = vi.fn();
const mppCheck = vi.fn();

vi.mock('../../api/project-control-api', async () => {
  const actual = await vi.importActual('../../api/project-control-api');
  return {
    ...(actual as Record<string, unknown>),
    projectControlApi: {
      uploadImport: (...args: unknown[]) => uploadImport(...args),
      previewImport: (...args: unknown[]) => previewImport(...args),
      mapImport: (...args: unknown[]) => mapImport(...args),
      validateImport: (...args: unknown[]) => validateImport(...args),
      commitImport: (...args: unknown[]) => commitImport(...args),
      mppCheck: (...args: unknown[]) => mppCheck(...args),
    },
  };
});

function previewFixture(batchId: string): ControlImportPreview {
  return {
    importBatchId: batchId,
    sourceType: 'EXCEL',
    fileHash: 'abc',
    parserVersion: 'excel-gantt-1.0.0',
    dryRun: true,
    manifest: {
      phaseCount: 7,
      break1Count: 24,
      sourceRowCount: 142,
      perPhaseCounts: [13, 18, 12, 13, 65, 10, 11],
      periodCount: 147,
      totalDays: 620,
      totalMonths: 21,
      budgetRowCount: 5,
      budgetTotal: 1,
      ownerCount: 65,
      dodCount: 48,
      progressCount: 104,
      startNonEmpty: 65,
      startValid: 60,
      finishNonEmpty: 65,
      finishValid: 60,
      dateMin: '1404/09/01',
      dateMax: '1406/12/10',
    },
    manifestChecks: [
      { key: 'phaseCount', expected: '7', actual: '7', ok: true },
    ],
    manifestValid: true,
    counts: { phases: 7, break1: 24, tasks: 100, totalNodes: 131 },
    conflicts: [],
    issues: [],
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    canCommit: true,
  };
}

function renderWizard(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ImportWizard projectId={PROJECT_ID} />
    </QueryClientProvider>,
  );
}

async function selectExcelAndUpload(): Promise<void> {
  const user = userEvent.setup();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['PK\u0003\u0004'], 'fixture.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await user.upload(input, file);
  await user.click(screen.getByRole('button', { name: 'بارگذاری و تحلیل' }));
}

describe('ImportWizard upload → preview', () => {
  beforeEach(() => {
    toastError.mockReset();
    uploadImport.mockReset();
    previewImport.mockReset();
    mapImport.mockReset();
    validateImport.mockReset();
    commitImport.mockReset();
    mppCheck.mockReset();
    mppCheck.mockResolvedValue({
      javaAvailable: false,
      javaVersion: null,
      adapterPresent: true,
      adapterVersion: '1',
      mpxjAvailable: false,
      message: 'MPP در دسترس نیست',
    });
  });

  it('پس از Upload موفق، Preview را با همان importBatchId فراخوانی می‌کند', async () => {
    const uploadResult: UploadImportResult = {
      importBatchId: VALID_BATCH_ID,
      sourceType: 'EXCEL',
    };
    uploadImport.mockResolvedValue(uploadResult);
    previewImport.mockResolvedValue(previewFixture(VALID_BATCH_ID));

    renderWizard();
    await selectExcelAndUpload();

    await waitFor(() => {
      expect(uploadImport).toHaveBeenCalledTimes(1);
      expect(previewImport).toHaveBeenCalledWith(PROJECT_ID, VALID_BATCH_ID, true);
    });

    const previewArgs = previewImport.mock.calls[0] as unknown[];
    expect(String(previewArgs[1])).not.toBe('undefined');
    expect(String(previewArgs.join('/'))).not.toContain('/undefined/');

    await waitFor(() => {
      expect(screen.getByText('Manifest')).toBeInTheDocument();
      expect(screen.getByText('Manifest معتبر است')).toBeInTheDocument();
    });
  });

  it('بدون importBatchId معتبر، Preview را صدا نمی‌زند و پیام فارسی نشان می‌دهد', async () => {
    uploadImport.mockResolvedValue({ sourceType: 'EXCEL' });

    renderWizard();
    await selectExcelAndUpload();

    await waitFor(() => {
      expect(uploadImport).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(IMPORT_BATCH_ID_MISSING_MESSAGE);
    });
    expect(previewImport).not.toHaveBeenCalled();
  });

  it('با UUID نامعتبر، Preview را صدا نمی‌زند', async () => {
    uploadImport.mockResolvedValue({
      importBatchId: 'not-a-uuid',
      sourceType: 'EXCEL',
    });

    renderWizard();
    await selectExcelAndUpload();

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(IMPORT_BATCH_ID_MISSING_MESSAGE);
    });
    expect(previewImport).not.toHaveBeenCalled();
  });
});
