import type { Metadata } from "next";
import {
  Search, Calendar, Upload, Coins, MessageCircle, FileText,
  Briefcase, Scale, Award, Sparkles, UserCheck, Users, Settings,
  ShieldCheck, Bell, Shield, type LucideIcon
} from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";
import { SelectorRolActivo, type ModoRol } from "./SelectorRolActivo";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

// Accesos rápidos cliente (maqueta de inicio de cliente)
const ACCESOS_CLIENTE: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: Calendar, nombre: "Agendar cita", detalle: "Presencial o por video" },
  { icono: Upload, nombre: "Subir documento", detalle: "Contratos, cédulas, actas" },
  { icono: Coins, nombre: "Financiamiento", detalle: "Cuotas para tu caso" },
  { icono: MessageCircle, nombre: "Preguntar a tranqi", detalle: "Respuesta en minutos" },
];

// Accesos rápidos socio abogado
const ACCESOS_ABOGADO: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: Briefcase, nombre: "Nuevas Solicitudes", detalle: "3 casos en espera de patrocinio" },
  { icono: Calendar, nombre: "Citas de hoy", detalle: "2 videollamadas agendadas" },
  { icono: FileText, nombre: "Cargar Expediente", detalle: "Subir demandas y providencias" },
  { icono: Coins, nombre: "Mis Honorarios", detalle: "Resumen de cobros y facturación" },
];

// Widgets administrativos de plataforma
const WIDGETS_ADMIN: { clave: string; icono: LucideIcon; nombre: string; detalle: string; estado: "registrado" | "proximamente" }[] = [
  { clave: "gestion_usuarios", icono: Users, nombre: "Gestión de Usuarios", detalle: "Membresías, asignación de perfiles y jerarquía", estado: "registrado" },
  { clave: "socios", icono: UserCheck, nombre: "Aprobación de Socios", detalle: "Verificación de cédula, título y matrícula", estado: "registrado" },
  { clave: "configuracion_negocio", icono: Settings, nombre: "Configuración Negocio", detalle: "Términos, locales, redes sociales y canales", estado: "registrado" },
  { clave: "auditoria", icono: ShieldCheck, nombre: "Auditoría de Cambios", detalle: "Log inmutable PostgreSQL de operaciones BDD", estado: "proximamente" },
  { clave: "emision_notificaciones", icono: Bell, nombre: "Emisión Notificaciones", detalle: "Editor WYSIWYG HTML/Markdown y Push/Email", estado: "proximamente" },
  { clave: "configuracion_permisos", icono: Shield, nombre: "Gobernanza Permisos", detalle: "Matriz Perfil-Widget exclusiva SuperAdmin", estado: "proximamente" },
];

interface Props {
  searchParams: Promise<{ modo?: string }>;
}

export default async function PaginaPanel({ searchParams }: Props) {
  const { modo: modoParam } = await searchParams;
  const modo: ModoRol = (modoParam as ModoRol) || "cliente";

  const perfil = await obtenerPerfilActual();
  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre) : null;
  const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || nombre;

  return (
    <div className="inicio-cliente">
      {/* Barra superior con Buscador, Selector de Rol Activo y Perfil */}
      <div className="barra-cliente">
        <div className="buscador-cliente">
          <Search aria-hidden="true" strokeWidth={1.7} />
          <input
            type="search"
            placeholder={
              modo === "abogado"
                ? "Buscar expediente, causa o cliente..."
                : modo === "admin"
                ? "Buscar usuario, RUC, auditoría..."
                : "La búsqueda llegará pronto"
            }
            aria-label="Buscar"
            disabled
          />
        </div>

        {/* Conmutador interactivo de vista por Rol */}
        <SelectorRolActivo modoInicial={modo} />

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

      {/* Renderizado dinámico del panel según el Rol Activo */}
      {modo === "cliente" && <PanelCliente saludo={saludo} nombre={nombre} />}
      {modo === "abogado" && <PanelAbogado saludo={saludo} nombreCompleto={nombreCompleto} />}
      {modo === "admin" && <PanelAdministrador saludo={saludo} nombreCompleto={nombreCompleto} />}

      <footer className="pie-panel">
        <span>© tranqi® 2026</span>
        <a href="/terminos">Términos</a>
      </footer>
    </div>
  );
}

/* ──────────────── 1. PANEL MODO CLIENTE ──────────────── */
function PanelCliente({ saludo, nombre }: { saludo: string | null; nombre: string }) {
  return (
    <>
      <h1>{saludo ?? `Hola de nuevo, ${nombre}`}</h1>
      <p className="inicio-cliente-sub">¿Qué necesitas resolver hoy?</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* BANNER TU PROTECCIÓN */}
          <section className="tarjeta-proteccion" aria-labelledby="t-proteccion">
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

          {/* ACCESOS RÁPIDOS */}
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

          {/* TRÁMITES */}
          <section className="tarjeta-seccion" aria-labelledby="t-tramites">
            <header><h2 id="t-tramites">Tus trámites</h2></header>
            <div className="vacio-seccion">
              <b>Aún no tienes trámites</b>
              <span>Cuando abras un caso con tu abogado, podrás seguir aquí cada paso.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          {/* PRÓXIMA CITA */}
          <section className="tarjeta-seccion" aria-labelledby="t-cita">
            <header><h2 id="t-cita">Tu próxima cita</h2></header>
            <div className="vacio-seccion">
              <b>No tienes citas agendadas</b>
              <span>Podrás agendar presencial o por videollamada.</span>
            </div>
          </section>

          {/* DOCUMENTOS */}
          <section className="tarjeta-seccion" aria-labelledby="t-docs">
            <header><h2 id="t-docs">Documentos recientes</h2></header>
            <div className="vacio-seccion">
              <b>Sin documentos todavía</b>
              <span>Aquí se guardarán tus contratos, escritos y certificados.</span>
            </div>
          </section>

          {/* BUDDIE DE REPOSO */}
          <section className="bloque-ayuda" aria-labelledby="t-ayuda">
            <div className="bloque-ayuda-cabeza">
              <div className="bloque-ayuda-ojitos" aria-hidden="true" />
              <strong id="t-ayuda">¿Una duda rápida?</strong>
            </div>
            <p>
              tranqi te responderá al instante y, si hace falta, te derivará con un
              abogado de la red sin costo adicional.
            </p>
            <span className="chip-proximamente">Próximamente</span>
          </section>
        </aside>
      </div>
    </>
  );
}

/* ──────────────── 2. PANEL MODO SOCIO ABOGADO ──────────────── */
function PanelAbogado({ saludo, nombreCompleto }: { saludo: string | null; nombreCompleto: string }) {
  return (
    <>
      <h1>Panel Profesional — Abg. {nombreCompleto}</h1>
      <p className="inicio-cliente-sub">Patrocinio legal, gestión de causas y expedientes judiciales</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* BANNER DE ACREDITACIÓN PROFESIONAL */}
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

          {/* ACCESOS RÁPIDOS ABOGADO */}
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

          {/* CASOS EN PATROCINIO ACTIVO */}
          <section className="tarjeta-seccion" aria-labelledby="t-causas">
            <header><h2 id="t-causas">Casos en patrocinio activo</h2></header>
            <div className="vacio-seccion">
              <b>Sin casos asignados todavía</b>
              <span>Las causas judiciales asignadas por el sistema aparecerán aquí con su historial y término.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          {/* PRÓXIMAS AUDIENCIAS */}
          <section className="tarjeta-seccion" aria-labelledby="t-audiencias">
            <header><h2 id="t-audiencias">Agenda de audiencias</h2></header>
            <div className="vacio-seccion">
              <b>No tienes audiencias agendadas</b>
              <span>Fechas de diligencias judiciales y términos procesales de tus causas.</span>
            </div>
          </section>

          {/* REPUTACIÓN Y RESEÑAS */}
          <section className="tarjeta-seccion" aria-labelledby="t-reputacion">
            <header><h2 id="t-reputacion">Mi reputación y reseñas</h2></header>
            <div className="vacio-seccion">
              <Award className="icono-nav" style={{ width: 28, height: 28, color: "#05594A" }} />
              <b>Calificación: 5.0 / 5.0 ⭐</b>
              <span>Basado en las evaluaciones de clientes patrocinados en tranqi.</span>
            </div>
          </section>

          {/* ASISTENTE LEGAL IA ARIA */}
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
function PanelAdministrador({ saludo, nombreCompleto }: { saludo: string | null; nombreCompleto: string }) {
  return (
    <>
      <h1>Consola de Control del Portal — tranqi</h1>
      <p className="inicio-cliente-sub">Gobernanza multitenant de plataforma, usuarios y telemetría de negocio</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* BANNER DE ADMINISTRACIÓN */}
          <section className="tarjeta-proteccion tarjeta-admin" aria-labelledby="t-admin">
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" id="t-admin">Gobernanza de Plataforma</div>
                <div className="tarjeta-proteccion-plan">Consola <i>SuperAdmin / Administrador</i></div>
                <div className="tarjeta-proteccion-meta">
                  Acceso universal a los widgets comunes y matriz de seguridad de perfiles en tranqi.
                </div>
              </div>
              <span className="badge-rol">🛡️ SuperAdmin</span>
            </div>
          </section>

          {/* GRID DE WIDGETS ADMINISTRATIVOS */}
          <div className="grid-admin-widgets">
            {WIDGETS_ADMIN.map((w) => (
              <div key={w.clave} className={`tarjeta-widget-admin ${w.estado === "registrado" ? "destacado" : ""}`}>
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
            ))}
          </div>

          {/* MÉTRICAS DE PLATAFORMA */}
          <section className="tarjeta-seccion" aria-labelledby="t-metricas">
            <header><h2 id="t-metricas">Telemetría y Métricas del Negocio</h2></header>
            <div className="vacio-seccion">
              <b>Panel de telemetría en preparación</b>
              <span>Consolidado de usuarios registrados, consultas de API y estado de servidores.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          {/* ESTADO DE PLATAFORMA */}
          <section className="tarjeta-seccion" aria-labelledby="t-infra">
            <header><h2 id="t-infra">Infraestructura y Servicios</h2></header>
            <div className="vacio-seccion" style={{ textAlign: "left", justifyItems: "start" }}>
              <div style={{ fontSize: "0.85rem", display: "grid", gap: "8px", width: "100%" }}>
                <div>🟢 <b>PostgreSQL BDD:</b> Operativo (Supabase)</div>
                <div>🟢 <b>Autenticación JWT:</b> TLS 1.3 Verificado</div>
                <div>🟢 <b>Facturación SRI:</b> Ambiente Pruebas</div>
                <div>🟢 <b>Meta/WhatsApp API:</b> Conectado</div>
              </div>
            </div>
          </section>

          {/* BITÁCORA DE AUDITORÍA RECIENTE */}
          <section className="tarjeta-seccion" aria-labelledby="t-aud">
            <header><h2 id="t-aud">Eventos Recientes (Auditoría)</h2></header>
            <div className="vacio-seccion">
              <b>Triggers inmutables activos</b>
              <span>Los eventos de creación de usuarios y cambios de perfil se registran en `comun_auditoria`.</span>
            </div>
          </section>

          {/* CONTROL DE CUOTAS Y RECURSOS */}
          <section className="bloque-ayuda" aria-labelledby="t-recursos">
            <div className="bloque-ayuda-cabeza">
              <Scale className="icono-nav" style={{ width: 24, height: 24, color: "#05594A" }} />
              <strong id="t-recursos">Capacidad y Recursos</strong>
            </div>
            <p>
              Almacenamiento Cifrado: 1.2 GB / 50 GB • Cupo de Notificaciones Push & WhatsApp: 85% disponible.
            </p>
            <span className="chip-proximamente">Próximamente</span>
          </section>
        </aside>
      </div>
    </>
  );
}

/** Iniciales para el avatar de usuario */
function iniciales(nombres?: string | null, apellidos?: string | null, correo?: string | null): string {
  const [primero, segundo] = [nombres, apellidos]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  if (primero && segundo) return (primero.charAt(0) + segundo.charAt(0)).toUpperCase();
  if (primero) return primero.slice(0, 2).toUpperCase();
  return (correo ?? "?").slice(0, 2).toUpperCase();
}
