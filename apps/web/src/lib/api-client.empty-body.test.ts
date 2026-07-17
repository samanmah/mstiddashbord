import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';

describe('apiRequest empty / 204 body', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('پاسخ 204 → null بدون crash', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 204, statusText: 'No Content' }),
    );
    await expect(apiRequest<{ updated: number }>('/x', { method: 'POST', body: {} })).resolves.toBeNull();
  });

  it('پاسخ 200 با Content-Length=0 → null', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Length': '0' },
      }),
    );
    await expect(apiRequest('/y')).resolves.toBeNull();
  });

  it('پاسخ 200 JSON معتبر → object', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ updated: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(apiRequest<{ updated: number }>('/z', { method: 'POST', body: {} })).resolves.toEqual({
      updated: 2,
    });
  });
});
