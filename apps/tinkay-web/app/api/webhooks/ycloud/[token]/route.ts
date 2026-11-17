import { NextRequest, NextResponse } from "next/server";
import { procesarWebhookYcloudOmnicanalAction } from "@eco/comercio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Contexto = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { token } = await params;
  return NextResponse.json({
    ok: true,
    servicio: "tinkay-ycloud-whatsapp-webhook",
    tokenConfigurado: Boolean(token && token.length >= 12),
  });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { token } = await params;
  const cuerpoRaw = await req.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = cuerpoRaw ? (JSON.parse(cuerpoRaw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const firmaHeader =
    req.headers.get("ycloud-signature") ?? req.headers.get("YCloud-Signature") ?? null;
  const origenTiendaUrl = (
    req.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://tinkay-web.vercel.app"
  ).replace(/\/+$/, "");

  const res = await procesarWebhookYcloudOmnicanalAction({
    token,
    firmaHeader,
    cuerpoRaw,
    payload,
    origenTiendaUrl,
  });

  return NextResponse.json(
    { ok: res.ok, accion: res.accion, error: res.error },
    { status: res.status }
  );
}
