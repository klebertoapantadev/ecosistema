import type { Metadata } from "next";
import {
  Search, Calendar, Upload, Coins, MessageCircle, FileText,
  Briefcase, Award, Sparkles, UserCheck, Users, Settings,
  ShieldCheck, Bell, Shield, type LucideIcon
} from "lucide-react";
import { obtenerPerfilActual, obtenerSaludo, obtenerPerfiles } from "@eco/identidad";
import { SelectorRolActivo, type ModoRol } from "./SelectorRolActivo";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

const ACCESOS_CLIENTE: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: Calendar, nombre: "Agendar cita", detalle: "Presencial o por video" },
  { icono: Upload, nombre: "Subir documento", detalle: "Contratos, cédulas, actas" },
  { icono: Coins, nombre: "Financiamiento", detalle: "Cuotas para tu caso" },
  { icono: MessageCircle, nombre: "Preguntar a tranqi", detalle: "Respuesta en minutos" },
];

const ACCESOS_ABOGADO: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: Briefcase, nombre: "Nuevas Solicitudes", detalle: "3 casos en espera de patrocinio" },
  { icono: Calendar, nombre: "Citas de hoy", detalle: "2 videollamadas agendadas" },
  { icono: FileText, nombre: "Cargar Expediente", detalle: "Subir demandas y providencias" },
  { icono: Coins, nombre: "Mis Honorarios", detalle: "Resumen de cobros y facturación" },
];

const WIDGETS_ADMIN: { clave: string; icono: LucideIcon; nombre: string; detalle: string; estado: "registrado" | "proximamente" }[] = [
  { clave: "gestion_usuarios", icono: Users, nombre: "Gestión de Usuarios", detalle: "Membresías, asignación de perfiles y jerarquía", estado: "registrado" },
  { clave: "socios", icono: UserCheck, nombre: "Aprobación de Socios", detalle: "Verificación de cédula, título y matrícula", estado: "registrado" },
  { clave: "configuracion_negocio", icono: Settings, nombre: "Configuración Negocio", detalle: "Términos, locales, redes sociales y canales", estado: "registrado" },
  { clave: "auditoria", icono: ShieldCheck, nombre: "Auditoría de Cambios", detalle: "Log inmutable PostgreSQL de operaciones BDD", estado: "proximamente" },
  { clave: "emision_notificaciones", icono: Bell, nombre: "Emisión Notificaciones", detalle: "Editor WYSIWYG HTML/Markdown y Push/Email", estado: "registrado" },
  { clave: "configuracion_permisos", icono: Shield, nombre: "Gobernanza Permisos", detalle: "Matriz Perfil-Widget exclusiva SuperAdmin", estado: "proximamente" },
];

interface Props {
  searchParams: Promise<{ modo?: string }>;
}

const MODOS: readonly ModoRol[] = ["cliente", "abogado", "admin"];

function modoValido(valor: string | undefined): ModoRol | null {
  return MODOS.includes(valor as ModoRol) ? (valor as ModoRol) : null;
}

function modoDePerfiles(perfiles: string[]): ModoRol {
  if (perfiles.includes("ADMINISTRADOR")) return "admin";
  if (perfiles.includes("ABOGADO")) return "abogado";
  return "cliente";
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

  const rawParams = await searchParams;
  const modoURL = modoValido(rawParams?.modo);
  const modo: ModoRol = puedeConmutar && modoURL ? modoURL : modoDePerfiles(perfiles);

  const saludo = await obtenerSaludo(perfil?.usu_nombres ?? "", perfil?.usu_apellidos ?? "");
  const nombre = perfil?.usu_nombres?.split(/\s+/)[0] ?? "Usuario";
  const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || "Usuario";
  const esAdminGlobal = puedeConmutar || perfiles.includes("ADMINISTRADOR");

  return (
    <div className="contenedor-panel">
      <div className="barra-superior-panel">
        <div className="busqueda-panel">
          <Search className="busqueda-icono" aria-hidden="true" strokeWidth={1.8} />
          <input
            type="search"
            placeholder={
              modo === "cliente"
                ? "Buscar trámites, causas o consultas..."
                : modo === "abogado"
                ? "Buscar causas, cédulas o actuaciones..."
                : "Buscar usuario, RUC, auditoría..."
            }
            aria-label="Buscar"
            disabled
          />
        </div>

        {puedeConmutar && <SelectorRolActivo modoInicial={modo} />}

        <div className="usuario-barra">
          <div className="usuario-barra-foto">
            {iniciales(perfil?.usu_nombres, perfil?.usu_apellidos, perfil?.usu_correo)}
          </div>
          <div className="usuario-barra-txt">
            <b>{nombreCompleto}</b>
            <span>
              {modo === "abogado" ? "Socio Abogado" : modo === "admin" ? "Administrador" : "Cliente"}
            </span>
          </div>
        </div>
      </div>

      {modo === "cliente" && <PanelCliente saludo={saludo} nombre={nombre} />}
      {modo === "abogado" && <PanelAbogado nombreCompleto={nombreCompleto} />}
      {modo === "admin" && <PanelAdministrador esSuperadmin={puedeConmutar} esAdminGlobal={esAdminGlobal} />}

      <footer className="pie-panel">
        <span>© tranqi® 2026</span>
        <a href="/terminos">Términos</a>
      </footer>
    </div>
  );
}

/* ──────────────── SECCIÓN NOTIFICACIONES ECOSISTEMA ──────────────── */
function SeccionNotificacionesEcosistema({ esAdmin }: { esAdmin: boolean }) {
  return (
    <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco" style={{ borderLeft: "4px solid #1f6feb" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id="t-notificaciones-eco" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#58a6ff" }}>
          <Bell style={{ width: 20, height: 20, color: "#1f6feb" }} /> Notificaciones & Alertas
        </h2>
        <span className="chip-registrado" style={{ background: "#1f6feb", color: "#fff", fontWeight: 700, padding: "2px 8px" }}>
          🔔 2 Alertas
        </span>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
        <div style={{ padding: "10px 12px", background: "rgba(31, 111, 235, 0.12)", borderRadius: "8px", border: "1px solid #388bfd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#58a6ff" }}>
            <span>Bienvenido a tranqi 2026</span>
            <span style={{ fontSize: "0.74rem", color: "#8b949e" }}>Hace 5 min</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#8b949e", marginTop: "4px" }}>
            Se ha activado tu suscripción a la plataforma de gestión legal e identidad unificada.
          </p>
        </div>

        <div style={{ padding: "10px 12px", background: "#161b22", borderRadius: "8px", border: "1px solid #30363d" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600, color: "#c9d1d9" }}>
            <span>Actualización de Servicios</span>
            <span style={{ fontSize: "0.74rem", color: "#8b949e" }}>Hace 1 hora</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#8b949e", marginTop: "4px" }}>
            Nuevas funcionalidades de seguimiento y consultas en línea activadas.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
        <a href="/panel/notificaciones" style={{ fontSize: "0.78rem", color: "#c9d1d9", background: "#21262d", border: "1px solid #30363d", borderRadius: "6px", padding: "6px 12px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Settings size={14} /> Preferencias & Alertas Recibidas
        </a>
        {esAdmin && (
          <a href="/panel/emision-notificaciones" style={{ fontSize: "0.78rem", color: "#fff", background: "#1f6feb", border: "none", borderRadius: "6px", padding: "6px 12px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Bell size={14} /> Consola de Emisión Multicanal
          </a>
        )}
      </div>
    </section>
  );
}

/* ──────────────── 1. PANEL MODO CLIENTE ──────────────── */
function PanelCliente({ saludo, nombre }: { saludo: string | null; nombre: string }) {
  return (
    <>
      <h1>{saludo ?? `Hola de nuevo, ${nombre}`}. Estás <i>tranqi</i>.</h1>
      <p className="inicio-cliente-sub">¿Qué necesitas resolver hoy?</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          <section className="tarjeta-proteccion" aria-labelledby="t-proteccion">
            <svg className="cinta-proteccion" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 540 -60 C 760 40 840 190 700 300 C 620 362 470 340 430 420" />
            </svg>
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-proteccion">Tu protección</div>
                <div className="tarjeta-proteccion-plan">Todavía sin <i>plan activo</i></div>
                <div className="tarjeta-proteccion-meta">
                  Cuando contrates tu protección jurídica, aquí aparecerán tu plan, tu
                  número de póliza y hasta cuándo está vigente.
                </div>
              </div>
              <span className="pildora-estado pendiente">Sin activar</span>
            </div>
          </section>

          <div className="accesos-cliente">
            {ACCESOS_CLIENTE.map((a) => (
              <div key={a.nombre} className="tarjeta-acceso">
                <a.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                <strong>{a.nombre}</strong>
                <p>{a.detalle}</p>
                <span className="chip-proximamente">Próximamente</span>
              </div>
            ))}
          </div>

          <section className="tarjeta-seccion" aria-labelledby="t-tramites">
            <header><h2 id="t-tramites">Tus trámites</h2></header>
            <div className="vacio-seccion">
              <b>Aún no tienes trámites</b>
              <span>Cuando abras un caso con tu abogado, podrás seguir aquí cada paso.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={false} />

          <section className="tarjeta-seccion" aria-labelledby="t-cita">
            <header><h2 id="t-cita">Tu próxima cita</h2></header>
            <div className="vacio-seccion">
              <b>No tienes citas agendadas</b>
              <span>Tus videollamadas y reuniones presenciales aparecerán agendadas aquí.</span>
            </div>
          </section>

          <section className="bloque-ayuda" aria-labelledby="t-ayuda">
            <div className="bloque-ayuda-cabeza">
              <Sparkles className="icono-nav" style={{ width: 24, height: 24, color: "#05594A" }} />
              <strong id="t-ayuda">Asistencia 24/7</strong>
            </div>
            <p>
              ¿Tienes una urgencia legal? Nuestro equipo responde en menos de 15 minutos.
            </p>
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
      <h1>Panel Profesional — Abg. {nombreCompleto}</h1>
      <p className="inicio-cliente-sub">Patrocinio legal, gestión de causas y expedientes judiciales</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          <section className="tarjeta-proteccion tarjeta-abogado" aria-labelledby="t-abogado">
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-abogado">Estado de acreditación</div>
                <div className="tarjeta-proteccion-plan">Socio Abogado <i>Verificado</i></div>
                <div className="tarjeta-proteccion-meta">
                  Foro de Abogados Matrícula N° 17-2026-89 • Red de Abogados Habilitada en Pichincha / Ecuador.
                </div>
              </div>
              <span className="badge-rol">✓ Acreditado</span>
            </div>
          </section>

          <div className="accesos-cliente">
            {ACCESOS_ABOGADO.map((a) => (
              <div key={a.nombre} className="tarjeta-acceso">
                <a.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                <strong>{a.nombre}</strong>
                <p>{a.detalle}</p>
                <span className="chip-proximamente">Próximamente</span>
              </div>
            ))}
          </div>

          <section className="tarjeta-seccion" aria-labelledby="t-causas">
            <header><h2 id="t-causas">Casos en patrocinio activo</h2></header>
            <div className="vacio-seccion">
              <b>Sin casos asignados todavía</b>
              <span>Las causas judiciales asignadas por el sistema aparecerán aquí con su historial y término.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={false} />

          <section className="tarjeta-seccion" aria-labelledby="t-audiencias">
            <header><h2 id="t-audiencias">Agenda de audiencias</h2></header>
            <div className="vacio-seccion">
              <b>No tienes audiencias agendadas</b>
              <span>Fechas de diligencias judiciales y términos procesales de tus causas.</span>
            </div>
          </section>

          <section className="tarjeta-seccion" aria-labelledby="t-reputacion">
            <header><h2 id="t-reputacion">Mi reputación y reseñas</h2></header>
            <div className="vacio-seccion">
              <Award className="icono-nav" style={{ width: 28, height: 28, color: "#05594A" }} />
              <b>Calificación: 5.0 / 5.0 ⭐</b>
              <span>Basado en las evaluaciones de clientes patrocinados en tranqi.</span>
            </div>
          </section>

          <section className="bloque-ayuda" aria-labelledby="t-aria">
            <div className="bloque-ayuda-cabeza">
              <Sparkles className="icono-nav" style={{ width: 24, height: 24, color: "#05594A" }} />
              <strong id="t-aria">Asistente Legal ARIA IA</strong>
            </div>
            <p>
              Genera borradores automáticos de demandas, minutas y análisis jurisprudencial de la Corte Nacional.
            </p>
            <span className="chip-proximamente">Próximamente</span>
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
          <section className="tarjeta-proteccion tarjeta-admin" aria-labelledby="t-admin">
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-admin">Gobernanza de Plataforma</div>
                <div className="tarjeta-proteccion-plan">
                  Consola <i>{esSuperadmin ? "SuperAdmin / Administrador" : "de Administración"}</i>
                </div>
                <div className="tarjeta-proteccion-meta">
                  Acceso universal a los widgets comunes y matriz de seguridad de perfiles en tranqi.
                </div>
              </div>
              {esSuperadmin && (
                <span className="badge-rol">
                  <ShieldCheck className="icono-badge-rol" aria-hidden="true" strokeWidth={2} />
                  SuperAdmin
                </span>
              )}
            </div>
          </section>

          <div className="grid-admin-widgets">
            {WIDGETS_ADMIN.map((w) => (
              <a
                key={w.clave}
                href={w.clave === "emision_notificaciones" ? "/panel/emision-notificaciones" : `#`}
                style={{ textDecoration: "none" }}
              >
                <div className={`tarjeta-widget-admin ${w.estado === "registrado" ? "destacado" : ""}`}>
                  <div className="tarjeta-widget-cabeza">
                    <w.icono className="tarjeta-widget-icono" strokeWidth={1.7} />
                    {w.estado === "registrado" ? (
                      <span className="chip-registrado">Widget Activo</span>
                    ) : (
                      <span className="chip-proximamente">Próximamente</span>
                    )}
                  </div>
                  <strong>{w.nombre}</strong>
                  <p>{w.detalle}</p>
                </div>
              </a>
            ))}
          </div>

          <section className="tarjeta-seccion" aria-labelledby="t-metricas">
            <header><h2 id="t-metricas">Telemetría y Métricas del Negocio</h2></header>
            <div className="vacio-seccion">
              <b>Panel de telemetría en preparación</b>
              <span>Consolidado de usuarios registrados, consultas de API y estado de servidores.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={esAdminGlobal} />

          <section className="tarjeta-seccion" aria-labelledby="t-infra">
            <header><h2 id="t-infra">Infraestructura y Servicios</h2></header>
            <div className="vacio-seccion" style={{ textAlign: "left", justifyItems: "start" }}>
              <b>Cluster PostgreSQL Supabase & Vercel Edge</b>
              <span style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "4px" }}>
                11 tablas en comun_seguridad • RLS Activo • TLS 1.3
              </span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
