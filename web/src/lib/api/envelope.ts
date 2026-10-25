/// One response shape for every Janus API route: `{ ok: true, data }` or
/// `{ ok: false, error: { code, message } }`. Bigints travel as decimal strings.
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly retryAfterSeconds?: number;
}

export type Envelope<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ApiError };

export const ok = <T>(data: T): Envelope<T> => ({ ok: true, data });

export const fail = (code: string, message: string, retryAfterSeconds?: number): Envelope<never> => ({
  ok: false,
  error: retryAfterSeconds === undefined ? { code, message } : { code, message, retryAfterSeconds },
});

const bigintAsString = (_key: string, value: unknown): unknown => (typeof value === "bigint" ? value.toString() : value);

export function jsonResponse(body: Envelope<unknown>, status: number): Response {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  if (!body.ok && body.error.retryAfterSeconds !== undefined) {
    headers.set("retry-after", String(body.error.retryAfterSeconds));
  }
  return new Response(JSON.stringify(body, bigintAsString), { status, headers });
}

const BAD_RESPONSE: Envelope<never> = fail("bad-response", "The server sent an unexpected reply. Try again.");

/// Checks the outer shape of a parsed reply; the caller still validates `data`.
export function readEnvelope<T>(value: unknown): Envelope<T> {
  if (typeof value !== "object" || value === null) return BAD_RESPONSE;
  const body = value as { readonly ok?: unknown; readonly data?: unknown; readonly error?: unknown };
  if (body.ok === true) return { ok: true, data: body.data as T };
  const error = body.error as { readonly code?: unknown; readonly message?: unknown } | undefined;
  if (body.ok === false && typeof error?.code === "string" && typeof error.message === "string") {
    return { ok: false, error: body.error as ApiError };
  }
  return BAD_RESPONSE;
}
