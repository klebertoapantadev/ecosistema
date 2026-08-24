import { describe, expect, it } from "vitest";
import { firmarJwtHs256, verificarJwtHs256 } from "./jwt";
import { acunarTokenSupabase, firmarCapsula, verificarCapsula } from "./capsula";

const SECRETO = "secreto-de-prueba-suficientemente-largo";
const OTRO_SECRETO = "otro-secreto-distinto-del-primero";

const SESION = {
  usuarioId: "11111111-2222-3333-4444-555555555555",
  rol: "CLIENTE" as const,
  conversacionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

function cuerpoDe(token: string): Record<string, unknown> {
  const base64 = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)));
}

describe("capsula de sesion del asistente", () => {
  it("va y vuelve conservando identidad, rol y conversacion", async () => {
    const token = await firmarCapsula(SESION, SECRETO);
    expect(await verificarCapsula(token, SECRETO)).toEqual(SESION);
  });

  it("rechaza una capsula firmada con otro secreto", async () => {
    const token = await firmarCapsula(SESION, OTRO_SECRETO);
    expect(await verificarCapsula(token, SECRETO)).toBeNull();
  });

  it("rechaza una capsula con el contenido manipulado", async () => {
    // El ataque que importa: cambiar el `sub` para leer los datos de otro.
    const token = await firmarCapsula(SESION, SECRETO);
    const [cabecera, , firma] = token.split(".");
    const cuerpoAjeno = btoa(
      JSON.stringify({ ...cuerpoDe(token), sub: "00000000-0000-0000-0000-000000000000" }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(await verificarCapsula(`${cabecera}.${cuerpoAjeno}.${firma}`, SECRETO)).toBeNull();
  });

  it("rechaza una capsula caducada", async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const token = await firmarJwtHs256(
      { sub: SESION.usuarioId, rol: "CLIENTE", cnv: SESION.conversacionId, exp: ahora - 1 },
      SECRETO,
    );
    expect(await verificarCapsula(token, SECRETO)).toBeNull();
  });

  it("rechaza un token sin exp", async () => {
    const token = await firmarJwtHs256(
      { sub: SESION.usuarioId, rol: "CLIENTE", cnv: SESION.conversacionId },
      SECRETO,
    );
    expect(await verificarJwtHs256(token, SECRETO)).toBeNull();
  });

  it("rechaza alg: none aunque la firma vaya vacia", async () => {
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const ahora = Math.floor(Date.now() / 1000);
    const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      sub: SESION.usuarioId,
      rol: "CLIENTE",
      cnv: SESION.conversacionId,
      exp: ahora + 300,
    })}.`;
    expect(await verificarCapsula(token, SECRETO)).toBeNull();
  });

  it("rechaza un rol que no es de asistente", async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const token = await firmarJwtHs256(
      { sub: SESION.usuarioId, rol: "SUPERADMIN", cnv: SESION.conversacionId, exp: ahora + 300 },
      SECRETO,
    );
    expect(await verificarCapsula(token, SECRETO)).toBeNull();
  });

  it("rechaza basura sin romperse", async () => {
    for (const basura of ["", "abc", "a.b", "a.b.c", "....", "null"]) {
      expect(await verificarCapsula(basura, SECRETO)).toBeNull();
    }
  });
});

describe("token de Supabase acuñado", () => {
  it("lleva los claims que PostgREST necesita para resolver auth.uid()", async () => {
    const token = await acunarTokenSupabase(
      SESION.usuarioId,
      SECRETO,
      "https://oaybbpdxhlxjbpwnoymy.supabase.co/",
    );
    const cuerpo = cuerpoDe(token);

    expect(cuerpo.sub).toBe(SESION.usuarioId);
    expect(cuerpo.role).toBe("authenticated");
    expect(cuerpo.aud).toBe("authenticated");
    // La barra final de la URL no se duplica.
    expect(cuerpo.iss).toBe("https://oaybbpdxhlxjbpwnoymy.supabase.co/auth/v1");
    expect(await verificarJwtHs256(token, SECRETO)).not.toBeNull();
  });

  it("NUNCA se declara aal2: una sesion de asistente no paso por MFA", async () => {
    // Si esto cambiara, el asistente alcanzaria lo que protege
    // tranqui_legal.trq_fn_es_admin_mfa_verificado(), que lee este mismo claim.
    const token = await acunarTokenSupabase(SESION.usuarioId, SECRETO, "https://x.supabase.co");
    expect(cuerpoDe(token).aal).toBe("aal1");
  });

  it("caduca en minutos, no en horas", async () => {
    const token = await acunarTokenSupabase(SESION.usuarioId, SECRETO, "https://x.supabase.co");
    const cuerpo = cuerpoDe(token);
    const vida = (cuerpo.exp as number) - (cuerpo.iat as number);
    expect(vida).toBeLessThanOrEqual(300);
  });
});
