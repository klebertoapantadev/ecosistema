import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  Calendar, Upload, Coins, MessageCircle, FileText,
  Briefcase, Award, Sparkles, UserCheck, Users, Settings,
  ShieldCheck, Bell, Shield, type LucideIcon
} from "lucide-react";
import { obtenerPerfilActual, obtenerSaludo, obtenerPerfiles, obtenerNivelMaximo } from "@eco/identidad";
import type { ModoRol } from "./SelectorRolActivo";
import { TarjetasFavoritasGrid } from "./SeccionFavoritosInicio";
import { BuscadorModulosGlobal } from "./BuscadorModulosGlobal";

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

import { obtenerSolicitudPropia } from "../../modulos/socios/consultas";

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
              <img
                src={(perfil?.usu_detalle_usuario as Record<string, unknown>).foto_url as string}
                alt={nombreCompleto}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
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

      {modo === "abogado" ? (
        <PanelAbogado nombreCompleto={nombreCompleto} />
      ) : (modo === "admin" || modo === "superadmin") ? (
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

function TarjetaEstadoSolicitudHome({ solicitud }: { solicitud: Record<string, unknown> }) {
  const estado = String(solicitud.ssc_estado || "enviada");
  const fechaStr = solicitud.ssc_enviada_en || solicitud.ssc_creado_en;
  const fecha = fechaStr ? new Date(String(fechaStr)).toLocaleDateString("es-EC") : null;

  const CONFIG: Record<string, { titulo: string; desc: string; chip: string; bg: string; border: string; color: string }> = {
    enviada: {
      titulo: "Solicitud de Socio Abogado — Enviada & En Espera de Revisión",
      desc: "Tu postulación profesional se encuentra registrada. El equipo legal revisará tus certificados de SENESCYT y Foro de Abogados.",
      chip: "🟡 Enviada (Pendiente de Autorización)",
      bg: "rgba(245, 158, 11, 0.08)",
      border: "#F59E0B",
      color: "#B45309",
    },
    en_revision: {
      titulo: "Solicitud de Socio Abogado — En Revisión Legal",
      desc: "Estamos validando tus credenciales en los portales oficiales de la SENESCYT y Consejo de la Judicatura.",
      chip: "🔵 En Revisión Legal",
      bg: "rgba(59, 130, 246, 0.08)",
      border: "#3B82F6",
      color: "#1D4ED8",
    },
    rechazada: {
      titulo: "Solicitud de Socio Abogado — Requiere Corrección / Actualización",
      desc: "Se identificaron observaciones en la documentación o datos ingresados. Por favor actualiza la información y vuelve a enviar.",
      chip: "🔴 No Autorizada (Modificación Requerida)",
      bg: "rgba(239, 68, 68, 0.08)",
      border: "#EF4444",
      color: "#B91C1C",
    },
  };

  const info = CONFIG[estado] ?? {
    titulo: "Solicitud de Socio Abogado — En Curso",
    desc: "Tienes una solicitud de registro profesional iniciada en la plataforma.",
    chip: "🟠 En Curso (Incompleta)",
    bg: "rgba(249, 115, 22, 0.08)",
    border: "#F97316",
    color: "#C2410C",
  };

  return (
    <section
      style={{
        width: "100%",
        background: info.bg,
        border: `1.5px solid ${info.border}`,
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "24px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: "999px",
                background: "#FFFFFF",
                border: `1px solid ${info.border}`,
                color: info.color,
              }}
            >
              {info.chip}
            </span>
            {fecha && <span style={{ fontSize: "0.78rem", color: "#666" }}>Registrada el {fecha}</span>}
          </div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111111", margin: "6px 0 4px" }}>{info.titulo}</h2>
          <p style={{ fontSize: "0.88rem", color: "#444444", margin: 0, lineHeight: "1.45" }}>{info.desc}</p>
        </div>

        <Link
          href="/panel/solicitud-socio"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)",
            color: "#FFF",
            padding: "12px 20px",
            borderRadius: "10px",
            fontSize: "0.88rem",
            fontWeight: 800,
            boxShadow: "0 4px 12px rgba(80, 0, 186, 0.25)",
            whiteSpace: "nowrap",
          }}
        >
          ✏️ Ver, Modificar y Actualizar Todos los Datos de mi Solicitud
        </Link>
      </div>
    </section>
  );
}

import { WidgetNotificacionesCliente } from "@eco/notificaciones";

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

          {/* 2) ACCESS GRID (Favoritos primero + Accesos predeterminados) */}
          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
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
          {/* 1) HERO CARD */}
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

          {/* 2) ACCESS GRID (Favoritos primero + Accesos predeterminados) */}
          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
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
              <a
                key={w.clave}
                href={w.clave === "gestion_usuarios" ? "/panel/usuarios" : w.clave === "socios" ? "/panel/socios" : w.clave === "configuracion_negocio" ? "/panel/configuracion" : w.clave === "emision_notificaciones" ? "/panel/emision-notificaciones" : "/panel/configuracion"}
                className="tarjeta-acceso"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <w.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                <strong>{w.nombre}</strong>
                <p>{w.detalle}</p>
                {w.estado === "proximamente" && (
                  <span className="chip-proximamente">Próximamente</span>
                )}
              </a>
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
