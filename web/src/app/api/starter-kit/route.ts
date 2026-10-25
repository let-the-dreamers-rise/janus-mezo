import { fail, jsonResponse } from "@/lib/api/envelope";
import { kitChainFromEnv } from "@/lib/starter-kit/chain";
import { clientIp } from "@/lib/starter-kit/request";
import { createKitService } from "@/lib/starter-kit/service";

/// GET: whether the starter kit is on and how many kits are left.
/// POST { address }: sends that wallet whatever part of the kit it is missing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/// A full kit is up to six confirmed transactions.
export const maxDuration = 60;

/// A kit request is one address; anything much longer is not one.
const MAX_BODY_CHARS = 1_024;

const service = createKitService({ chain: kitChainFromEnv() });

export async function GET(): Promise<Response> {
  const { status, body } = await service.status();
  return jsonResponse(body, status);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return undefined;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (body === undefined) return jsonResponse(fail("invalid-request", "That request is too large."), 413);
  const { status, body: reply } = await service.claim({ body, ip: clientIp(request.headers), now: Date.now() });
  return jsonResponse(reply, status);
}
