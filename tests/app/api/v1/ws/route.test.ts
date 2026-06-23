import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStore } from '@/tests/helpers/store';
import { addEvent } from '@/lib/mock/store';

import { GET } from '@/app/api/v1/ws/route';

async function readFirstEvent(res: Response): Promise<{ channel: string; data: unknown }> {
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  const text = new TextDecoder().decode(value);
  const payload = text.replace(/^data: /, '').trim();
  return JSON.parse(payload) as { channel: string; data: unknown };
}

describe('GET /api/v1/ws', () => {
  beforeEach(() => {
    resetStore();
    vi.useRealTimers();
  });

  it('streams cluster.state on connect', async () => {
    const res = await GET();
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const event = await readFirstEvent(res);
    expect(event.channel).toBe('cluster.state');
    expect((event.data as { state: string }).state).toBe('READY');
  });

  it('emits periodic node metrics', async () => {
    vi.useFakeTimers();
    const res = await GET();
    const reader = res.body!.getReader();
    await reader.read();
    vi.advanceTimersByTime(3000);
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('node.metrics');
    await reader.cancel();
    vi.useRealTimers();
  });

  it('forwards broadcast events to subscribers', async () => {
    const res = await GET();
    const reader = res.body!.getReader();
    await reader.read();

    addEvent('broadcast test');
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('broadcast test');
    await reader.cancel();
  });
});