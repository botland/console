import { getStatus, isInferedgeRuntime, proxyWsStream, subscribeWs } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

function createMockWsStream() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let metricsTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      void getStatus().then((status) => {
        send({ channel: 'cluster.state', data: status });
      });

      unsubscribe = subscribeWs((msg) => send(msg));

      metricsTimer = setInterval(() => {
        void getStatus().then((status) => {
          send({ channel: 'node.metrics', data: status });
        });
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

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => {
    if (isInferedgeRuntime()) {
      return proxyWsStream();
    }
    return createMockWsStream();
  });
}