import { getStatus } from '@/lib/mock/store';

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const status = getStatus();
        const data = `data: ${JSON.stringify(status)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };
      send();
      const interval = setInterval(send, 3000);
      const cleanup = () => clearInterval(interval);
      // @ts-expect-error cancel exists on ReadableStreamDefaultController in runtime
      controller.cancel = cleanup;
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