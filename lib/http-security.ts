export class HttpInputError extends Error {
  constructor(public readonly status: 400 | 413, message: string) {
    super(message);
  }
}

export function isSameOriginRequest(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export async function readJsonWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new HttpInputError(413, 'PAYLOAD_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpInputError(400, 'INVALID_INPUT');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new HttpInputError(413, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpInputError(400, 'INVALID_INPUT');
  }
}
