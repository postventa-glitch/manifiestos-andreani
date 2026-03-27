import { getAll } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  let lastVersion = -1;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(': connected\n\n'));

      const poll = async () => {
        if (closed) return;

        try {
          const data = await getAll();
          const currentVersion = data._version || 0;

          if (currentVersion !== lastVersion) {
            const isInitial = lastVersion === -1;
            lastVersion = currentVersion;

            const event = {
              manifiestos: data.manifiestos,
              pending: data.pending,
              auditLog: data.auditLog,
              _version: currentVersion,
            };

            const eventType = isInitial ? 'init' : 'update';
            const msg = `id: ${currentVersion}\nevent: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(msg));
          } else {
            // Heartbeat to keep connection alive
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          }
        } catch (e) {
          controller.enqueue(encoder.encode(': error\n\n'));
        }

        // Schedule next poll (1.5 seconds for near-real-time)
        if (!closed) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          await poll();
        }
      };

      await poll();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
