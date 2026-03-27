import { getAll } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const encoder = new TextEncoder();
  let lastVersion = -1;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      const poll = async () => {
        if (closed) return;

        try {
          const data = await getAll();
          const currentVersion = data._version || 0;

          if (currentVersion !== lastVersion) {
            const isInitial = lastVersion === -1;
            lastVersion = currentVersion;

            const msg = `id: ${currentVersion}\nevent: ${isInitial ? 'init' : 'update'}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(msg));

            // ── Recursive AI loop: push analytics alongside state ──
            // On every state change, compute fresh predictions and push them
            if (!isInitial) {
              try {
                const analyticsRes = await fetch(
                  `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/analytics`,
                  { cache: 'no-store' }
                );
                if (analyticsRes.ok) {
                  const analytics = await analyticsRes.json();
                  const analyticsMsg = `event: analytics\ndata: ${JSON.stringify(analytics)}\n\n`;
                  controller.enqueue(encoder.encode(analyticsMsg));
                }
              } catch {
                // analytics push is best-effort
              }
            }
          } else {
            controller.enqueue(encoder.encode(': hb\n\n'));
          }
        } catch {
          controller.enqueue(encoder.encode(': err\n\n'));
        }

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
