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
  tipo: "ACTUALIZAR" | "ETIQUETAR_DUPLICADO" | "ELIMINAR_DUPLICADO";
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
  intentos = 4
): Promise<Response> {
  let ultimaResp: Response | null = null;
  for (let i = 0; i < intentos; i++) {
    const resp = await fetch(url, init);
    ultimaResp = resp;
    if (resp.status !== 429 && resp.status !== 500 && resp.status !== 502 && resp.status !== 503) {
      return resp;
    }
    const esperaMs = 450 * Math.pow(2, i) + Math.floor(Math.random() * 180);
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
 * Aplica un lote de operaciones de depuración sobre Google Contacts (People API).
 * Optimizado para móvil y lotes grandes:
 * - Usa el `etag` ya leído primero y solo hace GET de respaldo si Google devuelve 400/409/412.
 * - Ejecuta PATCH/DELETE en sub-lotes concurrentes de 4 para acelerar ~3x sin disparar 429.
 * - Agrupa todas las asignaciones de etiquetas (`members:modify`) en 1 sola llamada por grupo.
 */
export async function aplicarLoteOperacionesGooglePeople(params: {
  accessToken: string;
  mapaGrupos: Record<string, string>;
  operaciones: OperacionEscrituraGoogleContacts[];
}): Promise<{
  actualizados: number;
  etiquetadosDuplicados: number;
  eliminadosPapelera: number;
  errores: string[];
  detallesLog: string[];
}> {
  let actualizados = 0;
  let etiquetadosDuplicados = 0;
  let eliminadosPapelera = 0;
  const errores: string[] = [];
  const detallesLog: string[] = [];

  const gruposPorAsignar = new Map<string, { nombreGrupo: string; resourceNames: Set<string> }>();
  const encolarGrupo = (nombreGrupo: string, resourceName: string) => {
    const grpRes = params.mapaGrupos[nombreGrupo];
    if (!grpRes) return;
    let bucket = gruposPorAsignar.get(grpRes);
    if (!bucket) {
      bucket = { nombreGrupo, resourceNames: new Set<string>() };
      gruposPorAsignar.set(grpRes, bucket);
    }
    bucket.resourceNames.add(resourceName);
  };

  const obtenerPersonaActual = async (resourceName: string) => {
    const res = await fetchGoogleConReintento(
      `https://people.googleapis.com/v1/${resourceName}?personFields=names,phoneNumbers,emailAddresses,organizations,biographies,memberships,metadata`,
      { headers: { Authorization: `Bearer ${params.accessToken}` } }
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, any>;
  };

  const construirPayloadActualizacion = (
    op: OperacionEscrituraGoogleContacts,
    etag: string,
    actual?: Record<string, any> | null
  ) => {
    const camposActualizar = new Set<string>(["names", "phoneNumbers"]);
    const payload: Record<string, unknown> = {
      etag,
      names: [{ givenName: op.nombreLimpio || actual?.names?.[0]?.givenName || "" }],
      phoneNumbers: (op.telefonos ?? []).map((t) => ({
        value: t.valorFormateado,
        type: t.tipo === "WORK" ? "work" : t.tipo === "HOME" ? "home" : "mobile",
      })),
    };

    if (op.correos && op.correos.length > 0) {
      camposActualizar.add("emailAddresses");
      payload.emailAddresses = op.correos.map((em) => ({ value: em, type: "other" }));
    }

    if (op.empresa || op.cargo) {
      camposActualizar.add("organizations");
      payload.organizations = [
        {
          name: op.empresa || actual?.organizations?.[0]?.name || undefined,
          title: op.cargo || actual?.organizations?.[0]?.title || undefined,
        },
      ];
    }

    if (op.notas) {
      camposActualizar.add("biographies");
      payload.biographies = [{ value: op.notas, contentType: "TEXT_PLAIN" }];
    }

    return { camposActualizar, payload };
  };

  const duplicadosPorEtiquetar: OperacionEscrituraGoogleContacts[] = [];
  const opsIndividuales: OperacionEscrituraGoogleContacts[] = [];

  for (const op of params.operaciones) {
    if (op.tipo === "ETIQUETAR_DUPLICADO") {
      duplicadosPorEtiquetar.push(op);
    } else {
      opsIndividuales.push(op);
    }
  }

  const ejecutarOpIndividual = async (op: OperacionEscrituraGoogleContacts) => {
    try {
      if (op.tipo === "ELIMINAR_DUPLICADO") {
        const res = await fetchGoogleConReintento(
          `https://people.googleapis.com/v1/${op.resourceName}:deleteContact`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${params.accessToken}` },
          }
        );
        if (res.ok || res.status === 404) {
          eliminadosPapelera++;
          detallesLog.push(`🗑️ Papelera: ${op.nombreLimpio || op.resourceName}`);
        } else {
          errores.push(`No se pudo mover a papelera ${op.resourceName} (HTTP ${res.status})`);
        }
        return;
      }

      // ACTUALIZAR ficha maestra: intentar primero con etag cacheado para ahorrar 1 GET por contacto
      const intentarPatch = async (etag: string, actual?: Record<string, any> | null) => {
        const { camposActualizar, payload } = construirPayloadActualizacion(op, etag, actual);
        const patchUrl = `https://people.googleapis.com/v1/${op.resourceName}:updateContact?updatePersonFields=${Array.from(
          camposActualizar
        ).join(",")}`;
        return fetchGoogleConReintento(patchUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      };

      let patchRes: Response | null = null;
      if (op.etag && op.nombreLimpio) {
        patchRes = await intentarPatch(op.etag, null);
      }

      if (!patchRes || patchRes.status === 400 || patchRes.status === 409 || patchRes.status === 412) {
        const actual = await obtenerPersonaActual(op.resourceName);
        if (!actual || !actual.etag) {
          errores.push(`Contacto ${op.nombreLimpio || op.resourceName} no encontrado en Google.`);
          return;
        }
        patchRes = await intentarPatch(String(actual.etag), actual);
      }

      if (!patchRes.ok) {
        const errBody = await patchRes.text();
        errores.push(
          `Error actualizando ${op.nombreLimpio || op.resourceName} (HTTP ${patchRes.status}): ${errBody.slice(0, 120)}`
        );
        return;
      }

      if (op.etiquetaGrupo) {
        encolarGrupo(op.etiquetaGrupo, op.resourceName);
      }

      actualizados++;
      const telResumen = op.telefonos?.[0]?.valorFormateado
        ? ` (${op.telefonos[0].valorFormateado})`
        : "";
      detallesLog.push(`✓ ${op.nombreLimpio || op.resourceName}${telResumen}`);
    } catch (err) {
      errores.push(
        `Excepción en ${op.nombreLimpio || op.resourceName}: ${err instanceof Error ? err.message : "error"}`
      );
    }
  };

  // Ejecutar operaciones individuales en sub-lotes concurrentes de 4
  const CONCURRENCIA = 4;
  for (let i = 0; i < opsIndividuales.length; i += CONCURRENCIA) {
    const subLote = opsIndividuales.slice(i, i + CONCURRENCIA);
    await Promise.all(subLote.map((op) => ejecutarOpIndividual(op)));
  }

  // Agrupar duplicados a etiquetar en 1 sola llamada members:modify
  if (duplicadosPorEtiquetar.length > 0) {
    const grpDup = params.mapaGrupos["Duplicado - Revisar"];
    if (grpDup) {
      const ids = Array.from(new Set(duplicadosPorEtiquetar.map((d) => d.resourceName)));
      const res = await fetchGoogleConReintento(
        `https://people.googleapis.com/v1/${grpDup}/members:modify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceNamesToAdd: ids }),
        }
      );
      if (res.ok) {
        etiquetadosDuplicados += ids.length;
        detallesLog.push(`🏷️ Etiquetados ${ids.length} duplicado(s) en «Duplicado - Revisar»`);
      } else {
        errores.push(`No se pudo etiquetar lote de duplicados (HTTP ${res.status})`);
      }
    }
  }

  // Aplicar etiquetas de categoría en bloque (1 HTTP POST por etiqueta)
  for (const [grpRes, info] of gruposPorAsignar.entries()) {
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
      if (res.ok) {
        detallesLog.push(`🏷️ Etiqueta «${info.nombreGrupo}» asignada a ${ids.length} ficha(s)`);
      } else {
        errores.push(`No se pudo asignar etiqueta «${info.nombreGrupo}» (HTTP ${res.status})`);
      }
    } catch (err) {
      errores.push(
        `Error asignando etiqueta «${info.nombreGrupo}»: ${err instanceof Error ? err.message : "error"}`
      );
    }
  }

  return { actualizados, etiquetadosDuplicados, eliminadosPapelera, errores, detallesLog };
}
