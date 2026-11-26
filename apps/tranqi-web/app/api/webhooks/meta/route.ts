import { NextRequest, NextResponse } from "next/server";
import {
  procesarWebhookMetaOmnicanalAction,
  verificarWebhookMetaOmnicanalAction,
} from "@eco/comercio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const verifyToken = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const token = req.nextUrl.searchParams.get("token");

  if (!mode && !verifyToken && !challenge) {
    return NextResponse.json({
      ok: true,
      servicio: "tranqi-meta-messenger-instagram-webhook",
    });
  }

  const res = await verificarWebhookMetaOmnicanalAction({
    token,
    mode,
    verifyToken,
    challenge,
  });

  if (res.ok && res.challenge) {
    return new NextResponse(res.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const cuerpoRaw = await req.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = cuerpoRaw ? (JSON.parse(cuerpoRaw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const firmaSha256 =
    req.headers.get("x-hub-signature-256") ?? req.headers.get("X-Hub-Signature-256") ?? null;
  const origenTiendaUrl = (
    req.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://tranqi-web.vercel.app"
  ).replace(/\/+$/, "");

  const res = await procesarWebhookMetaOmnicanalAction({
    token,
    firmaSha256,
    cuerpoRaw,
    payload,
    origenTiendaUrl,
  });

  return NextResponse.json(
    { ok: res.ok, accion: res.accion, procesados: res.procesados, error: res.error },
    { status: res.status }
  );
}
