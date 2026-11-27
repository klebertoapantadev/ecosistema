import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { FichaAgendaCruda, TipoTelefonoAgenda } from "./depurador-agenda";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

function normalizarNegocioComercio(negocio: string): string {
  return normalizarIdentificadorNegocio(negocio).principal;
}

export const COOKIE_ESTADO_GOOGLE_CONTACTS = "eco_gcontacts_oauth_state";

export const GOOGLE_CONTACTS_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export interface ConexionGoogleContactsInfo {
  id: string;
  correoGoogle: string;
  nombreGoogle: string | null;
  fotoUrl: string | null;
  usuarioId: string;
  usuarioNombre: string | null;
  lineaWhatsappId: string | null;
  lineaWhatsappNombre: string | null;
  scopes: string;
  estado: string;
  tieneRefreshToken: boolean;
  ultimaLecturaEn: string | null;
  ultimaEscrituraEn: string | null;
  totalContactosLeidos: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface OperacionEscrituraGoogleContacts {
  tipo: "ACTUALIZAR" | "ASIGNAR_ETIQUETA" | "ETIQUETAR_DUPLICADO" | "ELIMINAR_DUPLICADO";
  resourceName: string;
  etag?: string | null;
  nombreLimpio?: string;
  telefonos?: Array<{ valorFormateado: string; tipo: TipoTelefonoAgenda }>;
  correos?: string[];
  empresa?: string | null;
  cargo?: string | null;
  notas?: string | null;
  etiquetaGrupo?: string | null;
}

function obtenerClaveFirmaEstado(clientSecret: string): string {
  const base =
    process.env.GOOGLE_CONTACTS_STATE_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    clientSecret ||
    "ecosistema-gcontacts-state-v1";
  return crypto.createHash("sha256").update(base).digest("hex");
}

function firmarEstado(payload: Record<string, unknown>, clientSecret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", obtenerClaveFirmaEstado(clientSecret))
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verificarEstado(
  token: string,
  clientSecret: string
): Record<string, unknown> | null {
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [encoded, sig] = partes;
  if (!encoded || !sig) return null;

  const esperado = crypto
    .createHmac("sha256", obtenerClaveFirmaEstado(clientSecret))
    .update(encoded)
    .digest("base64url");

  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(esperado);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const ts = Number(data.ts || 0);
    // Expiración estricta de 15 minutos
    if (!ts || Date.now() - ts > 15 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function obtenerCredencialesEnvGoogleContacts(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = (
    process.env.GOOGLE_CONTACTS_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ""
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_CONTACTS_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ""
  ).trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function resolverCredencialesAppGoogleContacts(
  supabase: any,
  negocio: string
): Promise<
  | { ok: true; clientId: string; clientSecret: string; origen: "env" | "vault" }
  | { ok: false; error: string }
> {
  const envCreds = obtenerCredencialesEnvGoogleContacts();
  if (envCreds) {
    return { ok: true, ...envCreds, origen: "env" };
  }

  const neg = normalizarNegocioComercio(negocio);
  const { data, error } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_omnicanal_google_contacts_obtener_app_oauth", { p_negocio: neg });

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.ok || !data.clientId || !data.clientSecret) {
    return {
      ok: false,
      error:
        String(data?.error || "") ||
        "Configura primero el Client ID y Client Secret de Google Cloud en esta sección.",
    };
  }

  return {
    ok: true,
    clientId: String(data.clientId).trim(),
    clientSecret: String(data.clientSecret).trim(),
    origen: "vault",
  };
}

function obtenerOrigenSeguro(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

/**
 * Route Handler GET `/api/omnicanal/google-contacts/conectar`:
 * Inicia OAuth 2.0 independiente contra Google Contacts SIN alterar la sesión de Supabase.
 */
export async function manejarInicioOauthGoogleContacts(
  req: NextRequest,
  negocio: string
): Promise<NextResponse> {
  const neg = normalizarNegocioComercio(negocio);
  const origen = obtenerOrigenSeguro(req);
  const urlDestinoError = (msg: string) =>
    NextResponse.redirect(
      `${origen}/panel/contactos?tab=depurador&google_error=${encodeURIComponent(msg)}`
    );

  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origen}/ingresar?siguiente=/panel/contactos`);
    }

    const creds = await resolverCredencialesAppGoogleContacts(supabase, neg);
    if (!creds.ok) {
      return urlDestinoError(creds.error);
    }

    const lineaWhatsappId = req.nextUrl.searchParams.get("lineaId") || null;
    const nonce = crypto.randomBytes(16).toString("hex");
    const stateToken = firmarEstado(
      {
        negocio: neg,
        usuarioId: user.id,
        lineaWhatsappId,
        nonce,
        ts: Date.now(),
      },
      creds.clientSecret
    );

    const redirectUri = `${origen}/api/omnicanal/google-contacts/callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", creds.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_CONTACTS_SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent select_account");
    authUrl.searchParams.set("state", stateToken);

    const resp = NextResponse.redirect(authUrl.toString());
    resp.cookies.set(COOKIE_ESTADO_GOOGLE_CONTACTS, stateToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: origen.startsWith("https://"),
      maxAge: 900,
      path: "/",
    });
    return resp;
  } catch (err) {
    return urlDestinoError(
      err instanceof Error ? err.message : "No se pudo iniciar la conexión con Google Contacts."
    );
  }
}

/**
 * Route Handler GET `/api/omnicanal/google-contacts/callback`:
 * Intercambia el código OAuth por refresh_token y lo almacena cifrado en Supabase Vault.
 */
export async function manejarCallbackOauthGoogleContacts(
  req: NextRequest,
  negocio: string
): Promise<NextResponse> {
  const neg = normalizarNegocioComercio(negocio);
  const origen = obtenerOrigenSeguro(req);
  const redirigirError = (msg: string) => {
    const resp = NextResponse.redirect(
      `${origen}/panel/contactos?tab=depurador&google_error=${encodeURIComponent(msg)}`
    );
    resp.cookies.delete(COOKIE_ESTADO_GOOGLE_CONTACTS);
    return resp;
  };

  try {
    const errorGoogle = req.nextUrl.searchParams.get("error");
    if (errorGoogle) {
      return redirigirError(`Autorización cancelada o rechazada por Google (${errorGoogle}).`);
    }

    const code = req.nextUrl.searchParams.get("code") || "";
    const stateParam = req.nextUrl.searchParams.get("state") || "";
    const stateCookie = req.cookies.get(COOKIE_ESTADO_GOOGLE_CONTACTS)?.value || "";

    if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
      return redirigirError("Validación CSRF de Google OAuth expirada. Intenta conectar nuevamente.");
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirigirError("Tu sesión expiró antes de completar el enlace con Google.");
    }

    const creds = await resolverCredencialesAppGoogleContacts(supabase, neg);
    if (!creds.ok) {
      return redirigirError(creds.error);
    }

    const stateData = verificarEstado(stateParam, creds.clientSecret);
    if (!stateData || stateData.usuarioId !== user.id || stateData.negocio !== neg) {
      return redirigirError("Firma de estado OAuth inválida o de otro usuario.");
    }

    const redirectUri = `${origen}/api/omnicanal/google-contacts/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson = (await tokenRes.json()) as Record<string, unknown>;
    if (!tokenRes.ok || !tokenJson.access_token) {
      return redirigirError(
        `Google rechazó el intercambio de token: ${String(
          tokenJson.error_description || tokenJson.error || tokenRes.status
        )}`
      );
    }

    const accessToken = String(tokenJson.access_token);
    const refreshToken = tokenJson.refresh_token ? String(tokenJson.refresh_token) : "";
    const scopes = tokenJson.scope
      ? String(tokenJson.scope)
      : GOOGLE_CONTACTS_SCOPES.join(" ");

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfo = (await userInfoRes.json()) as Record<string, unknown>;
    const correoGoogle = String(userInfo.email || "").trim().toLowerCase();
    const nombreGoogle = userInfo.name ? String(userInfo.name).trim() : null;
    const fotoUrl = userInfo.picture ? String(userInfo.picture).trim() : null;

    if (!correoGoogle) {
      return redirigirError("Google no devolvió el correo de la cuenta autorizada.");
    }

    const lineaIdRaw =
      typeof stateData.lineaWhatsappId === "string" &&
      /^[0-9a-f-]{36}$/i.test(stateData.lineaWhatsappId)
        ? stateData.lineaWhatsappId
        : null;

    const { data: guardado, error: errGuardar } = await (supabase.schema("comun_comercio") as any).rpc(
      "com_fn_omnicanal_google_contacts_guardar_conexion",
      {
        p_negocio: neg,
        p_correo_google: correoGoogle,
        p_nombre_google: nombreGoogle,
        p_foto_url: fotoUrl,
        p_refresh_token: refreshToken || null,
        p_scopes: scopes,
        p_linea_whatsapp_id: lineaIdRaw,
      }
    );

    if (errGuardar || !guardado?.ok) {
      return redirigirError(
        errGuardar?.message || String(guardado?.error || "No se pudo guardar la conexión Google.")
      );
    }

    const resp = NextResponse.redirect(
      `${origen}/panel/contactos?tab=depurador&google_ok=${encodeURIComponent(correoGoogle)}`
    );
    resp.cookies.delete(COOKIE_ESTADO_GOOGLE_CONTACTS);
    return resp;
  } catch (err) {
    return redirigirError(
      err instanceof Error ? err.message : "Error inesperado en el callback de Google Contacts."
    );
  }
}

export async function refrescarAccessTokenGoogle(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !data.access_token) {
      return {
        ok: false,
        error: `No se pudo renovar el acceso de Google (${String(
          data.error_description || data.error || res.status
        )}). Vuelve a pulsar «Conectar Google».`,
      };
    }
    return { ok: true, accessToken: String(data.access_token) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error de red renovando token Google.",
    };
  }
}

async function fetchGoogleConReintento(
  url: string,
  init: RequestInit,
  intentos = 3
): Promise<Response> {
  let ultimaResp: Response | null = null;
  for (let i = 0; i < intentos; i++) {
    const resp = await fetch(url, init);
    ultimaResp = resp;
    // En 429 devolvemos de inmediato tras 1 breve intento para que el orquestador haga cooldown real (20-30s) sin quemar cuota
    if (resp.status === 429) {
      if (i === 0) {
        const retryHdr = Number(resp.headers.get("retry-after") || "0");
        if (retryHdr > 0 && retryHdr <= 5) {
          await new Promise((r) => setTimeout(r, retryHdr * 1000));
          continue;
        }
      }
      return resp;
    }
    if (resp.status !== 500 && resp.status !== 502 && resp.status !== 503) {
      return resp;
    }
    const esperaMs = 500 * Math.pow(2, i) + Math.floor(Math.random() * 180);
    await new Promise((r) => setTimeout(r, esperaMs));
  }
  return ultimaResp!;
}

/**
 * Lee TODOS los contactos de una cuenta de Google Contacts vía People API (paginación automática).
 */
export async function leerTodosContactosGooglePeople(
  accessToken: string,
  meta: { correoGoogle: string; esAgendaPersonal: boolean }
): Promise<{ ok: true; fichas: FichaAgendaCruda[]; totalGrupos: number } | { ok: false; error: string }> {
  try {
    // 1. Leer etiquetas/grupos existentes para mapear ID -> nombre legible
    const mapaGrupos = new Map<string, string>();
    const gruposRes = await fetchGoogleConReintento(
      "https://people.googleapis.com/v1/contactGroups?pageSize=200",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (gruposRes.ok) {
      const gruposJson = (await gruposRes.json()) as {
        contactGroups?: Array<{ resourceName?: string; name?: string; groupType?: string }>;
      };
      for (const g of gruposJson.contactGroups ?? []) {
        if (g.resourceName && g.name && g.groupType === "USER_CONTACT_GROUP") {
          mapaGrupos.set(g.resourceName, g.name);
        }
      }
    }

    // 2. Paginar todas las conexiones de Google Contacts
    const fichas: FichaAgendaCruda[] = [];
    let pageToken: string | undefined = undefined;
    let guard = 0;

    do {
      const url = new URL("https://people.googleapis.com/v1/people/me/connections");
      url.searchParams.set(
        "personFields",
        "names,phoneNumbers,emailAddresses,organizations,biographies,addresses,birthdays,memberships,metadata"
      );
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("sortOrder", "FIRST_NAME_ASCENDING");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetchGoogleConReintento(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const errObj = body.error as Record<string, unknown> | undefined;
        return {
          ok: false,
          error: `Google People API respondió ${res.status}: ${String(
            errObj?.message || "Verifica que People API esté habilitada en Google Cloud."
          )}`,
        };
      }

      const conexiones = Array.isArray(body.connections)
        ? (body.connections as Array<Record<string, any>>)
        : [];

      for (const p of conexiones) {
        const resourceName = String(p.resourceName || "");
        const etag = p.etag ? String(p.etag) : null;
        const nombre =
          String(p.names?.[0]?.displayName || "").trim() ||
          [p.names?.[0]?.givenName, p.names?.[0]?.familyName].filter(Boolean).join(" ").trim() ||
          String(p.organizations?.[0]?.name || "").trim();

        const telefonos = Array.isArray(p.phoneNumbers)
          ? p.phoneNumbers
              .map((ph: any) => ({
                valor: String(ph?.value || "").trim(),
                tipo: ph?.type ? String(ph.type) : "mobile",
              }))
              .filter((ph: { valor: string }) => ph.valor.length > 0)
          : [];

        const correos = Array.isArray(p.emailAddresses)
          ? p.emailAddresses
              .map((em: any) => String(em?.value || "").trim().toLowerCase())
              .filter((em: string) => em.includes("@"))
          : [];

        const empresa = p.organizations?.[0]?.name ? String(p.organizations[0].name).trim() : null;
        const cargo = p.organizations?.[0]?.title ? String(p.organizations[0].title).trim() : null;
        const direccion = p.addresses?.[0]?.formattedValue
          ? String(p.addresses[0].formattedValue).trim()
          : null;
        const notas = p.biographies?.[0]?.value ? String(p.biographies[0].value).trim() : null;

        let cumpleanos: string | null = null;
        const bd = p.birthdays?.[0]?.date;
        if (bd?.month && bd?.day) {
          const y = bd.year ? String(bd.year).padStart(4, "0") : "0000";
          cumpleanos = `${y}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`;
        }

        const etiquetas: string[] = [];
        if (Array.isArray(p.memberships)) {
          for (const m of p.memberships) {
            const grpRes = m?.contactGroupMembership?.contactGroupResourceName;
            if (grpRes && mapaGrupos.has(grpRes)) {
              const nomGrp = mapaGrupos.get(grpRes)!;
              if (!etiquetas.includes(nomGrp)) etiquetas.push(nomGrp);
            }
          }
        }

        fichas.push({
          idLocal: `g-${resourceName || fichas.length + 1}`,
          origen: "GOOGLE_CONTACTS",
          etiquetaFuente: `Google (${meta.correoGoogle})`,
          googleResourceName: resourceName || null,
          googleEtag: etag,
          nombreOriginal: nombre,
          telefonos,
          correos,
          empresa,
          cargo,
          direccion,
          cumpleanos,
          notas,
          etiquetas,
          esAgendaPersonal: meta.esAgendaPersonal,
        });
      }

      pageToken = body.nextPageToken ? String(body.nextPageToken) : undefined;
      guard++;
    } while (pageToken && guard < 15);

    return { ok: true, fichas, totalGrupos: mapaGrupos.size };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error leyendo contactos de Google People API.",
    };
  }
}

/**
 * Crea (si no existen) las etiquetas/grupos necesarios en Google Contacts y devuelve el mapa
 * `nombreGrupo -> contactGroupResourceName`.
 */
export async function asegurarGruposGoogleContacts(
  accessToken: string,
  nombresGrupos: string[]
): Promise<{ ok: true; mapaGrupos: Record<string, string> } | { ok: false; error: string }> {
  try {
    const mapaGrupos: Record<string, string> = {};
    const mapaLower = new Map<string, string>();

    const listRes = await fetchGoogleConReintento(
      "https://people.googleapis.com/v1/contactGroups?pageSize=200",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      return { ok: false, error: `Error leyendo grupos de Google (${listRes.status}).` };
    }
    const listJson = (await listRes.json()) as {
      contactGroups?: Array<{ resourceName?: string; name?: string; groupType?: string }>;
    };
    for (const g of listJson.contactGroups ?? []) {
      if (g.resourceName && g.name && g.groupType === "USER_CONTACT_GROUP") {
        mapaLower.set(g.name.trim().toLowerCase(), g.resourceName);
        mapaGrupos[g.name.trim()] = g.resourceName;
      }
    }

    for (const rawNom of nombresGrupos) {
      const nom = rawNom.trim();
      if (!nom) continue;
      const existente = mapaLower.get(nom.toLowerCase());
      if (existente) {
        mapaGrupos[nom] = existente;
        continue;
      }
      const createRes = await fetchGoogleConReintento(
        "https://people.googleapis.com/v1/contactGroups",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contactGroup: { name: nom } }),
        }
      );
      if (createRes.ok) {
        const created = (await createRes.json()) as { resourceName?: string };
        if (created.resourceName) {
          mapaGrupos[nom] = created.resourceName;
          mapaLower.set(nom.toLowerCase(), created.resourceName);
        }
      }
    }

    return { ok: true, mapaGrupos };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error creando grupos en Google Contacts.",
    };
  }
}

/**
 * Aplica un lote de operaciones de depuración sobre Google Contacts usando las APIs Batch oficiales:
 * - `POST /v1/people:batchUpdateContacts` (hasta 200 contactos en 1 llamada, omitiendo `readMask`
 *   para evitar consumir la cuota de 90/min de `Critical read requests`).
 * - `POST /v1/people:batchDeleteContacts` (hasta 500 duplicados a Papelera en 1 llamada).
 * - `POST /v1/{contactGroup}/members:modify` (hasta 1,000 etiquetas en 1 llamada por grupo).
 * - Si ocurre HTTP 429, NO descarta contactos: devuelve `rateLimited: true` y `operacionesPendientes429`
 *   para que el cliente haga cooldown automático y reintente exactamente las fichas pendientes.
 */
export async function aplicarLoteOperacionesGooglePeople(params: {
  accessToken: string;
  mapaGrupos: Record<string, string>;
  operaciones: OperacionEscrituraGoogleContacts[];
}): Promise<{
  actualizados: number;
  etiquetadosCategoria: number;
  etiquetadosDuplicados: number;
  eliminadosPapelera: number;
  errores: string[];
  detallesLog: string[];
  rateLimited: boolean;
  retryAfterSegundos: number;
  operacionesPendientes429: OperacionEscrituraGoogleContacts[];
}> {
  let actualizados = 0;
  let etiquetadosCategoria = 0;
  let etiquetadosDuplicados = 0;
  let eliminadosPapelera = 0;
  const errores: string[] = [];
  const detallesLog: string[] = [];
  let rateLimited = false;
  let retryAfterSegundos = 0;
  const operacionesPendientes429: OperacionEscrituraGoogleContacts[] = [];

  const registrar429 = (resp: Response, opsPendientes: OperacionEscrituraGoogleContacts[]) => {
    rateLimited = true;
    const hdr = Number(resp.headers.get("retry-after") || "0");
    retryAfterSegundos = Math.max(retryAfterSegundos, hdr >= 5 && hdr <= 90 ? hdr : 25);
    operacionesPendientes429.push(...opsPendientes);
  };

  const gruposPorAsignar = new Map<
    string,
    { nombreGrupo: string; resourceNames: Set<string>; ops: OperacionEscrituraGoogleContacts[] }
  >();
  const encolarGrupo = (
    nombreGrupo: string,
    resourceName: string,
    opOrigen?: OperacionEscrituraGoogleContacts
  ) => {
    const grpRes = params.mapaGrupos[nombreGrupo];
    if (!grpRes) return;
    let bucket = gruposPorAsignar.get(grpRes);
    if (!bucket) {
      bucket = { nombreGrupo, resourceNames: new Set<string>(), ops: [] };
      gruposPorAsignar.set(grpRes, bucket);
    }
    bucket.resourceNames.add(resourceName);
    if (opOrigen) bucket.ops.push(opOrigen);
  };

  const construirPersonaYMask = (
    op: OperacionEscrituraGoogleContacts,
    etag: string
  ): { mask: string; persona: Record<string, unknown> } => {
    const campos: string[] = ["names", "phoneNumbers"];
    const persona: Record<string, unknown> = {
      etag,
      names: [{ givenName: op.nombreLimpio || "" }],
      phoneNumbers: (op.telefonos ?? []).map((t) => ({
        value: t.valorFormateado,
        type: t.tipo === "WORK" ? "work" : t.tipo === "HOME" ? "home" : "mobile",
      })),
    };

    if (op.correos && op.correos.length > 0) {
      campos.push("emailAddresses");
      persona.emailAddresses = op.correos.map((em) => ({ value: em, type: "other" }));
    }

    if (op.empresa || op.cargo) {
      campos.push("organizations");
      persona.organizations = [
        {
          name: op.empresa || undefined,
          title: op.cargo || undefined,
        },
      ];
    }

    if (op.notas) {
      campos.push("biographies");
      persona.biographies = [{ value: op.notas, contentType: "TEXT_PLAIN" }];
    }

    return { mask: campos.join(","), persona };
  };

  // Refresca etags en lote (hasta 200 en 1 sola llamada `people:batchGet`)
  const refrescarEtagsEnLote = async (
    resourceNames: string[]
  ): Promise<{ ok: true; etags: Map<string, string> } | { ok: false; resp: Response }> => {
    const etags = new Map<string, string>();
    if (resourceNames.length === 0) return { ok: true, etags };
    const url = new URL("https://people.googleapis.com/v1/people:batchGet");
    url.searchParams.set("personFields", "metadata");
    for (const rn of resourceNames) {
      url.searchParams.append("resourceNames", rn);
    }
    const resp = await fetchGoogleConReintento(url.toString(), {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (resp.status === 429) return { ok: false, resp };
    if (!resp.ok) return { ok: true, etags };
    const body = (await resp.json()) as {
      responses?: Array<{
        requestedResourceName?: string;
        person?: { resourceName?: string; etag?: string };
      }>;
    };
    for (const item of body.responses ?? []) {
      const rn = item.person?.resourceName || item.requestedResourceName;
      if (rn && item.person?.etag) {
        etags.set(rn, item.person.etag);
      }
    }
    return { ok: true, etags };
  };

  // Separar por tipo de operación
  const opsActualizar: OperacionEscrituraGoogleContacts[] = [];
  const opsSoloEtiqueta: OperacionEscrituraGoogleContacts[] = [];
  const opsEtiquetarDup: OperacionEscrituraGoogleContacts[] = [];
  const opsEliminarDup: OperacionEscrituraGoogleContacts[] = [];

  for (const op of params.operaciones) {
    if (op.tipo === "ACTUALIZAR") opsActualizar.push(op);
    else if (op.tipo === "ASIGNAR_ETIQUETA") opsSoloEtiqueta.push(op);
    else if (op.tipo === "ETIQUETAR_DUPLICADO") opsEtiquetarDup.push(op);
    else if (op.tipo === "ELIMINAR_DUPLICADO") opsEliminarDup.push(op);
  }

  // 1. ACTUALIZAR fichas usando `people:batchUpdateContacts` agrupado por `updateMask`
  //    (omite `readMask` para NO disparar `Critical read requests` post-mutate GET)
  if (opsActualizar.length > 0) {
    // Si alguna ficha no trae etag, refrescarlas en 1 sola llamada `batchGet`
    const sinEtag = opsActualizar.filter((o) => !o.etag).map((o) => o.resourceName);
    const mapaEtagsFrescos = new Map<string, string>();
    if (sinEtag.length > 0) {
      const ref = await refrescarEtagsEnLote(sinEtag);
      if (!ref.ok) {
        registrar429(ref.resp, [
          ...opsActualizar,
          ...opsSoloEtiqueta,
          ...opsEtiquetarDup,
          ...opsEliminarDup,
        ]);
        return {
          actualizados,
          etiquetadosCategoria,
          etiquetadosDuplicados,
          eliminadosPapelera,
          errores,
          detallesLog,
          rateLimited,
          retryAfterSegundos,
          operacionesPendientes429,
        };
      }
      for (const [k, v] of ref.etags.entries()) mapaEtagsFrescos.set(k, v);
    }

    // Agrupar por `updateMask` para no borrar campos (email/org/notas) de contactos que no los traen
    const porMask = new Map<string, OperacionEscrituraGoogleContacts[]>();
    for (const op of opsActualizar) {
      const etag = op.etag || mapaEtagsFrescos.get(op.resourceName) || "";
      if (!etag) {
        errores.push(`Contacto ${op.nombreLimpio || op.resourceName} no encontrado en Google.`);
        continue;
      }
      const { mask } = construirPersonaYMask(op, etag);
      const lista = porMask.get(mask) ?? [];
      lista.push({ ...op, etag });
      porMask.set(mask, lista);
    }

    const gruposMask = Array.from(porMask.entries());
    for (let gIdx = 0; gIdx < gruposMask.length; gIdx++) {
      const [mask, listaOps] = gruposMask[gIdx]!;
      const pendientesDespues = gruposMask.slice(gIdx + 1).flatMap(([, l]) => l);

      const ejecutarBatchUpdate = async (
        subOps: OperacionEscrituraGoogleContacts[],
        etagsOverride?: Map<string, string>
      ): Promise<Response> => {
        const contactsMap: Record<string, Record<string, unknown>> = {};
        for (const op of subOps) {
          const etagUsar = etagsOverride?.get(op.resourceName) || op.etag || "";
          const { persona } = construirPersonaYMask(op, etagUsar);
          contactsMap[op.resourceName] = persona;
        }
        return fetchGoogleConReintento(
          "https://people.googleapis.com/v1/people:batchUpdateContacts",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${params.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contacts: contactsMap,
              updateMask: mask,
            }),
          }
        );
      };

      let batchRes = await ejecutarBatchUpdate(listaOps);

      // Si algún etag en el lote estaba desactualizado (400/409/412), refrescar etags en 1 batchGet y reintentar 1 vez
      if (batchRes.status === 400 || batchRes.status === 409 || batchRes.status === 412) {
        const ref = await refrescarEtagsEnLote(listaOps.map((o) => o.resourceName));
        if (!ref.ok) {
          registrar429(ref.resp, [
            ...listaOps,
            ...pendientesDespues,
            ...opsSoloEtiqueta,
            ...opsEtiquetarDup,
            ...opsEliminarDup,
          ]);
          return {
            actualizados,
            etiquetadosCategoria,
            etiquetadosDuplicados,
            eliminadosPapelera,
            errores,
            detallesLog,
            rateLimited,
            retryAfterSegundos,
            operacionesPendientes429,
          };
        }
        const validas = listaOps.filter((o) => ref.etags.has(o.resourceName));
        if (validas.length > 0) {
          batchRes = await ejecutarBatchUpdate(validas, ref.etags);
        }
      }

      if (batchRes.status === 429) {
        registrar429(batchRes, [
          ...listaOps,
          ...pendientesDespues,
          ...opsSoloEtiqueta,
          ...opsEtiquetarDup,
          ...opsEliminarDup,
        ]);
        return {
          actualizados,
          etiquetadosCategoria,
          etiquetadosDuplicados,
          eliminadosPapelera,
          errores,
          detallesLog,
          rateLimited,
          retryAfterSegundos,
          operacionesPendientes429,
        };
      }

      if (batchRes.ok) {
        actualizados += listaOps.length;
        for (const op of listaOps) {
          if (op.etiquetaGrupo) encolarGrupo(op.etiquetaGrupo, op.resourceName);
        }
        const muestra = listaOps
          .slice(0, 3)
          .map((o) => o.nombreLimpio || o.resourceName)
          .join(", ");
        detallesLog.push(
          `⚡ Batch ${listaOps.length} ficha(s) actualizadas (${mask})${muestra ? `: ${muestra}${listaOps.length > 3 ? "…" : ""}` : ""}`
        );
      } else {
        // Fallback granular solo si falló un contacto puntual del batch (secuencial para respetar cuotas)
        const errBatchTxt = await batchRes.text();
        detallesLog.push(
          `⚠️ Batch (${mask}) respondió HTTP ${batchRes.status}; aplicando ${listaOps.length} ficha(s) de forma individual…`
        );
        for (let k = 0; k < listaOps.length; k++) {
          const op = listaOps[k]!;
          try {
            const { persona } = construirPersonaYMask(op, op.etag || "");
            const patchUrl = `https://people.googleapis.com/v1/${op.resourceName}:updateContact?updatePersonFields=${encodeURIComponent(mask)}`;
            const pRes = await fetchGoogleConReintento(patchUrl, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${params.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(persona),
            });
            if (pRes.status === 429) {
              registrar429(pRes, [
                ...listaOps.slice(k),
                ...pendientesDespues,
                ...opsSoloEtiqueta,
                ...opsEtiquetarDup,
                ...opsEliminarDup,
              ]);
              return {
                actualizados,
                etiquetadosCategoria,
                etiquetadosDuplicados,
                eliminadosPapelera,
                errores,
                detallesLog,
                rateLimited,
                retryAfterSegundos,
                operacionesPendientes429,
              };
            }
            if (pRes.ok) {
              actualizados++;
              if (op.etiquetaGrupo) encolarGrupo(op.etiquetaGrupo, op.resourceName);
            } else {
              const t = await pRes.text();
              errores.push(
                `Error en ${op.nombreLimpio || op.resourceName} (HTTP ${pRes.status}): ${(t || errBatchTxt).slice(0, 110)}`
              );
            }
          } catch (e) {
            errores.push(
              `Excepción en ${op.nombreLimpio || op.resourceName}: ${e instanceof Error ? e.message : "error"}`
            );
          }
        }
      }
    }
  }

  // 2. ELIMINAR_DUPLICADO en 1 sola llamada `people:batchDeleteContacts` (hasta 500 por llamada)
  // INVARIANTE DE SEGURIDAD: jamás eliminar un resourceName que también esté siendo actualizado o etiquetado
  if (opsEliminarDup.length > 0) {
    const recursosProtegidos = new Set<string>([
      ...opsActualizar.map((o) => o.resourceName),
      ...opsSoloEtiqueta.map((o) => o.resourceName),
    ]);
    const idsEliminar = Array.from(
      new Set(
        opsEliminarDup
          .map((o) => o.resourceName)
          .filter((rn) => Boolean(rn) && !recursosProtegidos.has(rn))
      )
    );
    if (idsEliminar.length === 0) {
      detallesLog.push(
        "🛡️ Protección activa: se omitió borrado porque coincidía con fichas principales."
      );
    } else {
      const delRes = await fetchGoogleConReintento(
        "https://people.googleapis.com/v1/people:batchDeleteContacts",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceNames: idsEliminar }),
        }
      );
      if (delRes.status === 429) {
        registrar429(delRes, [...opsEliminarDup, ...opsSoloEtiqueta, ...opsEtiquetarDup]);
        return {
          actualizados,
          etiquetadosCategoria,
          etiquetadosDuplicados,
          eliminadosPapelera,
          errores,
          detallesLog,
          rateLimited,
          retryAfterSegundos,
          operacionesPendientes429,
        };
      }
      if (delRes.ok) {
        eliminadosPapelera += idsEliminar.length;
        detallesLog.push(`🗑️ Movidos ${idsEliminar.length} duplicado(s) a Papelera (batch)`);
      } else {
        const errTxt = await delRes.text();
        errores.push(
          `Error moviendo duplicados a Papelera (HTTP ${delRes.status}): ${errTxt.slice(0, 110)}`
        );
      }
    }
  }

  // 3. Encolar operaciones de solo etiqueta (`ASIGNAR_ETIQUETA`) y duplicados (`ETIQUETAR_DUPLICADO`)
  for (const op of opsSoloEtiqueta) {
    if (op.etiquetaGrupo) {
      encolarGrupo(op.etiquetaGrupo, op.resourceName, op);
    }
  }
  for (const op of opsEtiquetarDup) {
    encolarGrupo("Duplicado - Revisar", op.resourceName, op);
  }

  // 4. Aplicar etiquetas en bloque (1 HTTP POST por etiqueta — soporta hasta 1,000 miembros por llamada)
  const listaGrupos = Array.from(gruposPorAsignar.entries());
  for (let i = 0; i < listaGrupos.length; i++) {
    const [grpRes, info] = listaGrupos[i]!;
    const ids = Array.from(info.resourceNames);
    if (ids.length === 0) continue;
    try {
      const res = await fetchGoogleConReintento(
        `https://people.googleapis.com/v1/${grpRes}/members:modify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceNamesToAdd: ids }),
        }
      );
      if (res.status === 429) {
        const opsRestantes = listaGrupos
          .slice(i)
          .flatMap(([, b]) => b.ops);
        registrar429(res, opsRestantes);
        return {
          actualizados,
          etiquetadosCategoria,
          etiquetadosDuplicados,
          eliminadosPapelera,
          errores,
          detallesLog,
          rateLimited,
          retryAfterSegundos,
          operacionesPendientes429,
        };
      }
      if (res.ok) {
        if (info.nombreGrupo === "Duplicado - Revisar") {
          etiquetadosDuplicados += ids.length;
        } else {
          // Contar cuántos vinieron de ASIGNAR_ETIQUETA (solo-etiqueta)
          const soloEtqCount = info.ops.filter((o) => o.tipo === "ASIGNAR_ETIQUETA").length;
          etiquetadosCategoria += soloEtqCount;
        }
        detallesLog.push(`🏷️ Etiqueta «${info.nombreGrupo}» → ${ids.length} ficha(s) (1 llamada)`);
      } else {
        errores.push(`No se pudo asignar etiqueta «${info.nombreGrupo}» (HTTP ${res.status})`);
      }
    } catch (err) {
      errores.push(
        `Error asignando etiqueta «${info.nombreGrupo}»: ${err instanceof Error ? err.message : "error"}`
      );
    }
  }

  return {
    actualizados,
    etiquetadosCategoria,
    etiquetadosDuplicados,
    eliminadosPapelera,
    errores,
    detallesLog,
    rateLimited,
    retryAfterSegundos,
    operacionesPendientes429,
  };
}
