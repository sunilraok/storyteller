/** Serialize an async iterable of events as a newline-delimited JSON streaming Response. */
export function ndjsonResponse<T>(events: AsyncIterable<T>, onError: (e: unknown) => T): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of events) controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      } catch (e) {
        controller.enqueue(encoder.encode(JSON.stringify(onError(e)) + "\n"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Parse a newline-delimited JSON stream on the client. */
export async function* readNdjson<T>(res: Response): AsyncGenerator<T> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as T;
    }
    if (done) break;
  }
  if (buf.trim()) yield JSON.parse(buf) as T;
}
