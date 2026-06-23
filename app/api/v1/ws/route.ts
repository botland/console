import { getStatus, subscribeWs } from '@/lib/mock/store';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let metricsTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({ channel: 'cluster.state', data: getStatus() });

      unsubscribe = subscribeWs((msg) => send(msg));

      metricsTimer = setInterval(() => {
        send({ channel: 'node.metrics', data: getStatus() });
      }, 3000);
    },
    cancel() {
      unsubscribe?.();
      if (metricsTimer) clearInterval(metricsTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}