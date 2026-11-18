import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { generarParClavesVapid } from "@eco/notificaciones/web-push-nativo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEGOCIO_DEFECTO = "tinkay";

async function asegurarPublicKeyVapid(negocio: string): Promise<string | null> {
  const pubEnv = (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    ""
  ).trim();
  const privEnv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (pubEnv && privEnv) {
    return pubEnv;
  }

  const supabase: any = crearClienteAdmin() ?? (await crearClienteServidor());
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  // 1. Consultar si ya existe en Vault / cfg_negocio
  const consulta = await esquemaComercio.rpc("com_fn_push_asegurar_claves_vapid", {
    p_negocio: negocio,
    p_public_key_propuesta: null,
    p_private_key_propuesta: null,
  });

  if (!consulta.error && consulta.data?.ok && consulta.data?.publicKey) {
    return String(consulta.data.publicKey);
  }

  if (!consulta.error && consulta.data?.requiereGenerar) {
    const nuevas = generarParClavesVapid();
    const guardado = await esquemaComercio.rpc("com_fn_push_asegurar_claves_vapid", {
      p_negocio: negocio,
      p_public_key_propuesta: nuevas.publicKey,
      p_private_key_propuesta: nuevas.privateKey,
    });
    if (!guardado.error && guardado.data?.ok && guardado.data?.publicKey) {
      return String(guardado.data.publicKey);
    }
  }

  return pubEnv || null;
}

export async function GET(req: NextRequest) {
  try {
    const negocio = (req.nextUrl.searchParams.get("negocio") || NEGOCIO_DEFECTO)
      .trim()
      .toLowerCase();
    const publicKey = await asegurarPublicKeyVapid(negocio);
    return NextResponse.json({
      ok: true,
      publicKey,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        publicKey: null,
        error: err instanceof Error ? err.message : "No se pudo obtener configuración Push",
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Sesión requerida" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      negocio?: string;
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    } | null;

    const negocio = (body?.negocio || NEGOCIO_DEFECTO).trim().toLowerCase();
    const endpoint = (body?.endpoint || "").trim();
    const p256dh = (body?.keys?.p256dh || "").trim();
    const auth = (body?.keys?.auth || "").trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "Suscripción Web Push incompleta" },
        { status: 400 }
      );
    }

    const ua = req.headers.get("user-agent") || "";
    const esquemaComercio = (supabase as any).schema("comun_comercio");
    const { data, error } = await esquemaComercio.rpc("com_fn_push_registrar_suscripcion", {
      p_negocio: negocio,
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: ua,
    });

    if (!error && data?.ok) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({
      ok: false,
      migracionPendiente: true,
      error: error?.message || data?.error || "Ejecuta la migración 20261117000006 en Supabase.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error registrando suscripción Push",
      },
      { status: 500 }
    );
  }
}
