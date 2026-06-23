import { getStatus } from '@/lib/mock/store';
import { runWithHeadAuthority } from '@/lib/mock/gateway';

function createEventsStream() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const status = getStatus();
        const data = `data: ${JSON.stringify(status)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };
      send();
      interval = setInterval(send, 3000);
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