import { getStatus } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

function createEventsStream() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        const status = await getStatus();
        const data = `data: ${JSON.stringify(status)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };
      void send();
      interval = setInterval(() => {
        void send();
      }, 3000);
    },
    cancel() {
      if (interval) clearInterval(interval);
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
  return runWithHeadAuthority(req, async () => createEventsStream());
}