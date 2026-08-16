import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  Calendar, Upload, Coins, MessageCircle, FileText,
  Briefcase, UserCheck, Users, Settings, ShieldCheck, Bell,
  type LucideIcon
} from "lucide-react";
import { obtenerPerfilActual, obtenerSaludo, obtenerPerfiles, obtenerNivelMaximo } from "@eco/identidad";
import type { ModoRol } from "./SelectorRolActivo";
import { TarjetasFavoritasGrid } from "./SeccionFavoritosInicio";
import { BuscadorModulosGlobal } from "./BuscadorModulosGlobal";
import { WidgetNotificacionesCliente } from "@eco/notificaciones";
import { obtenerSolicitudPropia } from "../../modulos/socios/consultas";
import { ConsolaSuperAdminModular } from "./ConsolaSuperAdminModular";
import { TarjetaEstadoSolicitudHome } from "./TarjetaEstadoSolicitudHome";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

const ACCESOS_CLIENTE: { icono: LucideIcon; nombre: string; detalle: string; href?: string }[] = [
  { icono: Briefcase, nombre: "Registro de Abogados", detalle: "Postúlate a la red oficial de socios profesionales", href: "/panel/solicitud-socio" },
  { icono: Calendar, nombre: "Agendar cita", detalle: "Presencial o por video", href: "/panel/agendar" },
  { icono: Upload, nombre: "Subir documento", detalle: "Contratos, cédulas, actas", href: "/panel/cuenta" },
  { icono: Coins, nombre: "Financiamiento", detalle: "Cuotas para tu caso", href: "/panel" },
  { icono: MessageCircle, nombre: "Preguntar a tranqi", detalle: "Respuesta en minutos", href: "/panel" },
];

const ACCESOS_ABOGADO: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: Briefcase, nombre: "Nuevas Solicitudes", detalle: "3 casos en espera de patrocinio" },
  { icono: Calendar, nombre: "Citas de hoy", detalle: "2 videollamadas agendadas" },
  { icono: FileText, nombre: "Cargar Expediente", detalle: "Subir demandas y providencias" },
  { icono: Coins, nombre: "Mis Honorarios", detalle: "Resumen de cobros y facturación" },
];

const WIDGETS_ADMIN: { clave: string; icono: LucideIcon; nombre: string; detalle: string; ruta: string; estado: "registrado" | "proximamente" }[] = [
  { clave: "gestion_usuarios", icono: Users, nombre: "Gestión de Usuarios", detalle: "Membresías, asignación de perfiles y jerarquía", ruta: "/panel/usuarios", estado: "registrado" },
  { clave: "socios", icono: UserCheck, nombre: "Aprobación de Socios", detalle: "Verificación de cédula, título y matrícula", ruta: "/panel/socios", estado: "registrado" },
  { clave: "configuracion_negocio", icono: Settings, nombre: "Configuración Negocio", detalle: "Términos, locales, redes sociales y canales", ruta: "/panel/configuracion", estado: "registrado" },
  { clave: "auditoria", icono: ShieldCheck, nombre: "Auditoría de Cambios", detalle: "Log inmutable PostgreSQL de operaciones BDD", ruta: "/panel/auditoria", estado: "registrado" },
  { clave: "emision_notificaciones", icono: Bell, nombre: "Emisión Notificaciones", detalle: "Despacho masivo multicanal In-App, Push, Email, WhatsApp", ruta: "/panel/emision-notificaciones", estado: "registrado" },
];

interface Props {
  searchParams: Promise<{ modo?: string }>;
}

function modoValido(valor: string | undefined): ModoRol | null {
  if (!valor || !valor.trim()) return null;
  return valor.toLowerCase().trim() as ModoRol;
}

function modoDePerfiles(perfiles: string[]): ModoRol {
  if (perfiles.includes("SUPERADMIN")) return "superadmin";
  if (perfiles.includes("ADMINISTRADOR")) return "admin";
  if (perfiles.includes("ABOGADO")) return "abogado";
  if (perfiles.includes("OPERADOR")) return "operador";
  return (perfiles[0]?.toLowerCase() ?? "cliente") as ModoRol;
}

function iniciales(nombres?: string | null, apellidos?: string | null, correo?: string | null): string {
  const fuente = [nombres, apellidos].filter(Boolean).join(" ").trim() || correo || "";
  if (!fuente) return "?";
  const partes = fuente.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return (partes[0] ?? "?").substring(0, 2).toUpperCase();
  return ((partes[0]?.[0] ?? "?") + (partes[1]?.[0] ?? "?")).toUpperCase();
}

export default async function PagePanel({ searchParams }: Props) {
  const perfil = await obtenerPerfilActual();
  const perfiles = await obtenerPerfiles(NEGOCIO);
  const puedeConmutar = Boolean(perfil?.usu_superadmin_plataforma);
  const solicitudPropia = perfil ? await obtenerSolicitudPropia(perfil.usu_id) : null;
  const tieneSolicitudNoAutorizada = Boolean(solicitudPropia && solicitudPropia.ssc_estado !== "aceptada");

  const rawParams = await searchParams;
  const modoURL = modoValido(rawParams?.modo);
  const cookieStore = await cookies();
  const modoCookie = modoValido(cookieStore.get("tranqi_modo_rol")?.value)
    || modoValido(cookieStore.get("tranqi_rol_favorito")?.value);

  const modo: ModoRol = puedeConmutar
    ? (modoURL ?? modoCookie ?? modoDePerfiles(perfiles))
    : modoDePerfiles(perfiles);

  const saludo = await obtenerSaludo(perfil?.usu_nombres ?? "", perfil?.usu_apellidos ?? "");
  const nombre = perfil?.usu_nombres?.split(/\s+/)[0] ?? "Usuario";
  const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || "Usuario";
  const esAdminGlobal = puedeConmutar || perfiles.includes("ADMINISTRADOR");
  const nivelMaximo = await obtenerNivelMaximo(NEGOCIO);

  return (
    <div className="contenedor-panel">
      <div className="barra-superior-panel">
        <BuscadorModulosGlobal nivelUsuario={nivelMaximo} esSuperadmin={puedeConmutar} />

        <div className="usuario-barra">
          <div className="usuario-barra-foto" style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {typeof (perfil?.usu_detalle_usuario as Record<string, unknown>)?.foto_url === "string" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={String((perfil?.usu_detalle_usuario as Record<string, unknown>).foto_url)} alt={nombreCompleto} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              iniciales(perfil?.usu_nombres, perfil?.usu_apellidos, perfil?.usu_correo)
            )}
          </div>
          <div className="usuario-barra-txt">
            <b>{nombreCompleto}</b>
            <span>
              {modo === "abogado" ? "Socio Abogado" : modo === "admin" ? "Administrador" : modo === "superadmin" ? "SuperAdmin Plataforma" : modo === "operador" ? "Operador / Auxiliar" : modo.charAt(0).toUpperCase() + modo.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* POSICIÓN #1 EN PANEL HOME: Si existe una solicitud no autorizada, aparece al inicio absoluto */}
      {tieneSolicitudNoAutorizada && solicitudPropia && (
        <TarjetaEstadoSolicitudHome solicitud={solicitudPropia as unknown as Record<string, unknown>} />
      )}

      {modo === "superadmin" ? (
        <ConsolaSuperAdminModular />
      ) : modo === "abogado" ? (
        <PanelAbogado nombreCompleto={nombreCompleto} />
      ) : modo === "admin" ? (
        <PanelAdministrador esSuperadmin={puedeConmutar} esAdminGlobal={esAdminGlobal} />
      ) : (
        <PanelCliente saludo={saludo} nombre={nombre} />
      )}

      <footer className="pie-panel">
        <span>© tranqi® 2026</span>
        <a href="/terminos">Términos</a>
      </footer>
    </div>
  );
}

/* ──────────────── SECCIÓN NOTIFICACIONES ECOSISTEMA DINÁMICA ──────────────── */
function SeccionNotificacionesEcosistema({ esAdmin }: { esAdmin: boolean }) {
  return <WidgetNotificacionesCliente negocio="tranqi" esAdmin={esAdmin} />;
}

/* ──────────────── 1. PANEL MODO CLIENTE ──────────────── */
function PanelCliente({ saludo, nombre }: { saludo: string | null; nombre: string }) {
  return (
    <>
      <h1>{saludo ?? `Hola de nuevo, ${nombre}`}. Estás <i>tranqi</i>.</h1>
      <p className="inicio-cliente-sub">¿Qué necesitas resolver hoy?</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* 1) HERO CARD */}
          <section className="tarjeta-proteccion" aria-labelledby="t-proteccion">
            <svg className="cinta-proteccion" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 540 -60 C 760 40 840 190 700 300 C 620 362 470 340 430 420" />
            </svg>
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-proteccion">Protección Activa</div>
                <div className="tarjeta-proteccion-plan">Plan Familiar Cobertura Total</div>
                <div className="tarjeta-proteccion-meta">
                  Protección jurídica 24/7 en Ecuador. Consultas e ilimitadas vía chat.
                </div>
              </div>
              <span className="badge-activo">✓ Activo</span>
            </div>
            <div className="tarjeta-proteccion-chips">
              <span className="chip-proteccion">2 Abogados asignados</span>
              <span className="chip-proteccion">4 Miembros cubiertos</span>
              <span className="chip-proteccion">SOS 24/7 Habilitado</span>
            </div>
          </section>

          {/* 2) ACCESS GRID (Favoritos primero + Accesos predeterminados) */}
          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
            {ACCESOS_CLIENTE.map((acc, i) => (
              acc.href ? (
                <Link
                  key={i}
                  href={acc.href}
                  className="tarjeta-acceso"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <acc.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                  <strong>{acc.nombre}</strong>
                  <p>{acc.detalle}</p>
                </Link>
              ) : (
                <div key={i} className="tarjeta-acceso" tabIndex={0} role="button">
                  <acc.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                  <strong>{acc.nombre}</strong>
                  <p>{acc.detalle}</p>
                </div>
              )
            ))}
          </div>

          {/* 3) SUMMARY / STATUS SECTION */}
          <section className="tarjeta-seccion" aria-labelledby="t-actividad">
            <header>
              <h2 id="t-actividad">Tus Casos & Consultas Activas</h2>
            </header>
            <div className="vacio-seccion">
              <b>No tienes trámites abiertos en este momento</b>
              <span>Si necesitas asesoría legal, presiona en agendar cita o chatea con tranqi.</span>
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA */}
        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={false} />

          <section className="tarjeta-seccion" aria-labelledby="t-contactos">
            <header><h2 id="t-contactos">Tus Abogados Asignados</h2></header>
            <div className="vacio-seccion">
              <b>Equipo Legal tranqi</b>
              <span>Abogados acreditados ante el Consejo de la Judicatura listos para atenderte.</span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

/* ──────────────── 2. PANEL MODO SOCIO ABOGADO ──────────────── */
function PanelAbogado({ nombreCompleto }: { nombreCompleto: string }) {
  return (
    <>
      <h1>Portal Profesional de Abogado — tranqi</h1>
      <p className="inicio-cliente-sub">Bienvenido Dr. {nombreCompleto}. Panel de gestión de causas y patrocinios.</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* 1) HERO CARD */}
          <section className="tarjeta-proteccion tarjeta-abogado" aria-labelledby="t-abogado">
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-abogado">Socio Acreditado</div>
                <div className="tarjeta-proteccion-plan">Acreditación Foro de Abogados</div>
                <div className="tarjeta-proteccion-meta">
                  Habilitado para atención de patrocinio en materia Civil, Penal, Laboral y Familia.
                </div>
              </div>
              <span className="badge-socio">✓ Socio Activo</span>
            </div>
            <div className="tarjeta-proteccion-chips">
              <span className="chip-proteccion">Matrícula Verificada</span>
              <span className="chip-proteccion">SENESCYT Validado</span>
              <span className="chip-proteccion">Turno SOS Activo</span>
            </div>
          </section>

          {/* 2) ACCESS GRID (Favoritos primero + Accesos predeterminados) */}
          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
            {ACCESOS_ABOGADO.map((acc, i) => (
              <div key={i} className="tarjeta-acceso" tabIndex={0} role="button">
                <acc.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                <strong>{acc.nombre}</strong>
                <p>{acc.detalle}</p>
              </div>
            ))}
          </div>

          <section className="tarjeta-seccion" aria-labelledby="t-causas">
            <header><h2 id="t-causas">Causas & Juicios Asignados</h2></header>
            <div className="vacio-seccion">
              <b>Sin audiencias pendientes para hoy</b>
              <span>Las notificaciones de providencias se enviarán en tiempo real a tu WhatsApp.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={false} />

          <section className="tarjeta-seccion" aria-labelledby="t-turnos">
            <header><h2 id="t-turnos">Agenda de Citas & Videollamadas</h2></header>
            <div className="vacio-seccion">
              <b>Calendario Profesional</b>
              <span>Sincronizado con Google Calendar.</span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

/* ──────────────── 3. PANEL MODO ADMINISTRADOR ──────────────── */
function PanelAdministrador({ esSuperadmin, esAdminGlobal }: { esSuperadmin: boolean; esAdminGlobal: boolean }) {
  return (
    <>
      <h1>Consola de Control del Portal — tranqi</h1>
      <p className="inicio-cliente-sub">Gobernanza multitenant de plataforma, usuarios y telemetría de negocio</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* 1) HERO CARD */}
          <section className="tarjeta-proteccion tarjeta-admin" aria-labelledby="t-admin">
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-admin">Plataforma Ecosistema</div>
                <div className="tarjeta-proteccion-plan">
                  Administrador de <i>tranqi</i> {esSuperadmin && "(SuperAdmin Activo)"}
                </div>
                <div className="tarjeta-proteccion-meta">
                  Gestión centralizada de miembros, aprobación de socios abogados, configuración SMTP en Vault y auditoría BDD.
                </div>
              </div>
              <span className="badge-rol">✓ Operativo</span>
            </div>
          </section>

          {/* 2) ACCESS GRID (Favoritos primero + Accesos predeterminados) */}
          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
            {WIDGETS_ADMIN.map((w) => (
              <Link
                key={w.clave}
                href={w.ruta}
                className="tarjeta-acceso"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <w.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                <strong>{w.nombre}</strong>
                <p>{w.detalle}</p>
                {w.estado === "proximamente" && (
                  <span className="chip-proximamente">Próximamente</span>
                )}
              </Link>
            ))}
          </div>

          <section className="tarjeta-seccion" aria-labelledby="t-metricas">
            <header><h2 id="t-metricas">Métricas de Plataforma & Auditoría</h2></header>
            <div className="vacio-seccion">
              <b>Telemetría en Vivo BDD</b>
              <span>Monitoreo de RPCs, peticiones HTTP, logs de auditoría por triggers y latencia de respuesta.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={esAdminGlobal} />

          <section className="tarjeta-seccion" aria-labelledby="t-superadmin">
            <header><h2 id="t-superadmin">Gobernanza Multitenant</h2></header>
            <div className="vacio-seccion">
              <b>4 Negocios Activos</b>
              <span>tranqi, FastFix Home, Tinkay Floristería, Margaritas Floristería.</span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
