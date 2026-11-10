import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@eco/identidad";
import {
  obtenerClavePublicaVapid,
  obtenerSuscripcionesPushUsuario,
  guardarSuscripcionPushUsuario,
  eliminarSuscripcionPushUsuario,
  enviarWebPushAUsuario,
} from "../../../../lib/web-push-vapid";

export async function GET() {
  try {
    const publicKey = obtenerClavePublicaVapid();
    const perfil = await obtenerPerfilActual().catch(() => null);
    if (!perfil) {
      return NextResponse.json({
        ok: true,
        publicKey,
        autenticado: false,
        suscripcionesCount: 0,
      });
    }

    const suscripciones = await obtenerSuscripcionesPushUsuario(perfil.usu_id);
    return NextResponse.json({
      ok: true,
      publicKey,
      autenticado: true,
      suscripcionesCount: suscripciones.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error consultando suscripción PWA" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ ok: false, error: "Debes iniciar sesión para activar notificaciones push." }, { status: 401 });
    }

    const body = await req.json();
    const accion = body.accion || "suscribir";

    if (accion === "suscribir") {
      const sub = body.subscription;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return NextResponse.json({ ok: false, error: "Suscripción Web Push incompleta." }, { status: 400 });
      }

      const guardadas = await guardarSuscripcionPushUsuario(perfil.usu_id, {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        userAgent: req.headers.get("user-agent") || undefined,
      });

      // Enviar notificación de confirmación inmediata si se solicitó
      if (body.enviarConfirmacion !== false) {
        const nombre = [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || "Usuario";
        await enviarWebPushAUsuario(perfil.usu_id, {
          title: "🔔 Notificaciones Push activadas en tranqi",
          body: `Hola ${nombre}, recibirás alertas legales y de tus citas incluso con el navegador cerrado.`,
          url: "/panel",
          tag: "tranqi-push-welcome",
        }).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        suscripcionesCount: guardadas.length,
      });
    }

    if (accion === "probar") {
      const nombre = [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || "Usuario";
      const resultado = await enviarWebPushAUsuario(perfil.usu_id, {
        title: "⚡ Prueba Push de tranqi",
        body: `${nombre}, las notificaciones en segundo plano están operativas en este dispositivo.`,
        url: "/panel",
        tag: "tranqi-push-test-" + Date.now(),
      });

      return NextResponse.json({
        ok: resultado.enviados > 0,
        enviados: resultado.enviados,
        fallidos: resultado.fallidos,
        mensaje:
          resultado.enviados > 0
            ? `Notificación enviada a ${resultado.enviados} dispositivo(s).`
            : "No se encontraron dispositivos suscritos activos. Activa las alertas primero.",
      });
    }

    return NextResponse.json({ ok: false, error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error procesando suscripción Push" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body?.endpoint) {
      return NextResponse.json({ ok: false, error: "Endpoint requerido" }, { status: 400 });
    }

    const restantes = await eliminarSuscripcionPushUsuario(perfil.usu_id, body.endpoint);
    return NextResponse.json({ ok: true, suscripcionesCount: restantes.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error eliminando suscripción" },
      { status: 500 }
    );
  }
}
