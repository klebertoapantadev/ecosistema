import { NextRequest, NextResponse } from "next/server";
import { llamarConsola, resolverConsolaDesdeEntorno } from "@eco/agentes-ia";
import { obtenerMembresia, obtenerPerfilActual } from "@eco/identidad";
import { obtenerNivelAal } from "../../../../modulos/mfa/consultas";

// Proxy de la consola de agentes. La pantalla /panel/agentes habla SOLO con
// esta ruta; la key de tenant vive aqui y nunca sale al navegador.
//
// Tres puertas antes de reenviar nada:
//   1. sesion valida,
//   2. administrador de tranqi (o superadmin de plataforma),
//   3. MFA aal2 -- editar el prompt de un agente cambia lo que se le dice a
//      todos los afiliados; merece el mismo segundo factor que Socios.
// Y una cuarta sobre QUE se puede pedir: la lista blanca de abajo.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo que la pantalla puede pedirle a ARIA.
 *
 * Lista blanca, no lista negra: si mañana ARIA añade un endpoint nuevo, este
 * proxy no lo expone hasta que alguien lo escriba aqui a proposito. Con una
 * lista negra, el endpoint nuevo quedaria abierto por omision.
 *
 * Fuera a proposito, aunque la key de tenant SI los alcanza:
 *   - /v1/keys — crear una api key de agente desde una pantalla web deja un
 *     secreto invocable en un portapapeles. Que siga siendo una operacion
 *     deliberada de consola.
 *   - /v1/users — la gestion de usuarios de tranqi es de comun_seguridad, no
 *     de ARIA; dos sitios para lo mismo es como se desincronizan.
 *   - /v1/tenants* y /v1/auth* — la key de tenant ya los rechaza, pero no se
 *     listan para que eso quede escrito y no dependa solo del backend.
 */
const RUTAS_PERMITIDAS: Array<{ metodos: string[]; patron: RegExp }> = [
  { metodos: ["GET"], patron: /^\/v1\/me$/ },

  { metodos: ["GET", "POST"], patron: /^\/v1\/agents$/ },
  { metodos: ["GET", "PATCH"], patron: /^\/v1\/agents\/[\w-]+$/ },
  {
    metodos: ["GET"],
    patron: /^\/v1\/agents\/[\w-]+\/(skills|mcp-servers|http-tools)$/,
  },
  {
    metodos: ["POST", "DELETE"],
    patron: /^\/v1\/agents\/[\w-]+\/(skills|mcp-servers|http-tools)\/[\w-]+$/,
  },

  { metodos: ["GET", "POST"], patron: /^\/v1\/(mcp-servers|http-tools|skills)$/ },
  { metodos: ["GET", "PATCH", "DELETE"], patron: /^\/v1\/(mcp-servers|http-tools|skills)\/[\w-]+$/ },

  { metodos: ["GET"], patron: /^\/v1\/runs$/ },
  { metodos: ["GET"], patron: /^\/v1\/runs\/[\w-]+(\/messages)?$/ },

  { metodos: ["GET"], patron: /^\/v1\/documents$/ },
  { metodos: ["GET", "DELETE"], patron: /^\/v1\/documents\/[\w-]+$/ },
  { metodos: ["GET"], patron: /^\/v1\/documents\/[\w-]+\/chunks$/ },
  { metodos: ["POST"], patron: /^\/v1\/documents\/[\w-]+\/reprocess$/ },

  { metodos: ["GET"], patron: /^\/v1\/providers$/ },
  { metodos: ["GET", "PUT"], patron: /^\/v1\/settings$/ },
];

function estaPermitida(metodo: string, ruta: string): boolean {
  return RUTAS_PERMITIDAS.some((r) => r.metodos.includes(metodo) && r.patron.test(ruta));
}

async function autorizar(): Promise<NextResponse | null> {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });

  const membresia = await obtenerMembresia(perfil.usu_id, "tranqi");
  const esAdmin = perfil.usu_superadmin_plataforma || membresia?.mem_rol === "ADMINISTRADOR";
  if (!esAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { currentLevel } = await obtenerNivelAal();
  if (currentLevel !== "aal2") {
    return NextResponse.json({ error: "Requiere verificacion en dos pasos" }, { status: 403 });
  }
  return null;
}

async function reenviar(peticion: NextRequest, segmentos: string[]): Promise<NextResponse> {
  const negado = await autorizar();
  if (negado) return negado;

  const config = resolverConsolaDesdeEntorno("ARIA");
  if (!config) {
    return NextResponse.json(
      { error: "Faltan ARIA_BASE, ARIA_TENANT_KEY o ARIA_GATE_KEY" },
      { status: 503 },
    );
  }

  const ruta = `/${segmentos.join("/")}`;
  if (!estaPermitida(peticion.method, ruta)) {
    return NextResponse.json(
      { error: `Ruta no permitida por la consola: ${peticion.method} ${ruta}` },
      { status: 403 },
    );
  }

  // El query string se reenvia solo para lo que lo usa (paginacion de runs) y
  // se reconstruye a partir de parametros conocidos: pasarlo tal cual dejaria
  // que la pantalla inyectara cualquier cosa en la URL de ARIA.
  const limite = peticion.nextUrl.searchParams.get("limit");
  const consulta = limite && /^\d{1,4}$/.test(limite) ? `?limit=${limite}` : "";

  let cuerpo: unknown;
  if (peticion.method !== "GET" && peticion.method !== "DELETE") {
    try {
      cuerpo = await peticion.json();
    } catch {
      cuerpo = {};
    }
  }

  try {
    const { estado, datos } = await llamarConsola(config, peticion.method, ruta + consulta, cuerpo);
    return NextResponse.json(datos, { status: estado });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}

type Contexto = { params: Promise<{ ruta: string[] }> };

export async function GET(peticion: NextRequest, { params }: Contexto) {
  return reenviar(peticion, (await params).ruta);
}
export async function POST(peticion: NextRequest, { params }: Contexto) {
  return reenviar(peticion, (await params).ruta);
}
export async function PATCH(peticion: NextRequest, { params }: Contexto) {
  return reenviar(peticion, (await params).ruta);
}
export async function PUT(peticion: NextRequest, { params }: Contexto) {
  return reenviar(peticion, (await params).ruta);
}
export async function DELETE(peticion: NextRequest, { params }: Contexto) {
  return reenviar(peticion, (await params).ruta);
}
