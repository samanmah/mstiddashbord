import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import {
  assertImportBatchId,
  IMPORT_BATCH_ID_MISSING_MESSAGE,
  projectControlApi,
} from './project-control-api';
import type { UploadImportResult } from './project-control-types';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

const VALID_BATCH_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '3654a149-6fcc-406e-b97c-d0daf62ec502';

describe('assertImportBatchId', () => {
  it('می‌پذیرد UUID معتبر را', () => {
    expect(() => assertImportBatchId(VALID_BATCH_ID)).not.toThrow();
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    'not-a-uuid',
    '[object Object]',
    { id: VALID_BATCH_ID },
  ])('برای مقدار نامعتبر %j خطا می‌دهد', (value) => {
    expect(() => assertImportBatchId(value)).toThrow(ApiError);
    try {
      assertImportBatchId(value);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe(IMPORT_BATCH_ID_MISSING_MESSAGE);
    }
  });
});

describe('projectControlApi.uploadImport', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('پاسخ دارای importBatchId را به‌عنوان UploadImportResult می‌پذیرد', async () => {
    const payload: UploadImportResult = {
      importBatchId: VALID_BATCH_ID,
      sourceType: 'EXCEL',
    };
    vi.mocked(apiRequest).mockResolvedValue(payload);

    const file = new File(['xlsx'], 'fixture.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await projectControlApi.uploadImport(PROJECT_ID, file, 'EXCEL');

    expect(result).toEqual(payload);
    expect(result.importBatchId).toBe(VALID_BATCH_ID);
    expect(result).not.toHaveProperty('id');
    expect(apiRequest).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/control/imports/upload`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('projectControlApi preview/map/validate/commit guards', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('previewImport با UUID نامعتبر بدون Network Request Fail می‌شود', async () => {
    await expect(projectControlApi.previewImport(PROJECT_ID, 'undefined')).rejects.toThrow(
      IMPORT_BATCH_ID_MISSING_MESSAGE,
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('previewImport با UUID معتبر درخواست می‌فرستد', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ importBatchId: VALID_BATCH_ID });
    await projectControlApi.previewImport(PROJECT_ID, VALID_BATCH_ID, true);
    expect(apiRequest).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/control/imports/${VALID_BATCH_ID}/preview`,
      expect.objectContaining({ method: 'POST', body: { dryRun: true } }),
    );
  });

  it.each([
    ['mapImport', () => projectControlApi.mapImport(PROJECT_ID, '', [])],
    ['validateImport', () => projectControlApi.validateImport(PROJECT_ID, 'null')],
    ['commitImport', () => projectControlApi.commitImport(PROJECT_ID, undefined as unknown as string)],
  ] as const)('%s با شناسه نامعتبر Network نمی‌زند', async (_name, fn) => {
    await expect(fn()).rejects.toThrow(IMPORT_BATCH_ID_MISSING_MESSAGE);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
