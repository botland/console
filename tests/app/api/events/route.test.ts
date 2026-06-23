import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { GET } from '@/app/api/events/route';

async function readFirstEvent(res: Response): Promise<Record<string, unknown>> {
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  const text = new TextDecoder().decode(value);
  const payload = text.replace(/^data: /, '').trim();
  return JSON.parse(payload) as Record<string, unknown>;
}

describe('GET /api/events', () => {
  beforeEach(() => resetStore());

  it('streams initial status as SSE', async () => {
    const res = await GET();
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const event = await readFirstEvent(res);
    expect(event.state).toBe('READY');
    expect(Array.isArray(event.events)).toBe(true);
  });

  it('cleans up interval when stream is cancelled', async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const res = await GET();
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(clearIntervalSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});