/**
 * Lightweight liveness endpoint.
 *
 * It deliberately does not read journal storage or call an external service,
 * so Render can use it for health checks and the keep-alive cron job without
 * creating journal files or doing unnecessary work.
 */
export function GET(): Response {
  return new Response("ok\n", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
