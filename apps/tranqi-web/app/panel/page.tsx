import type { Metadata } from "next";
import {
  Search, Calendar, Upload, Coins, MessageCircle, FileText,
  Briefcase, Scale, Award, Sparkles, UserCheck, Users, Settings,
  ShieldCheck, Bell, Shield, type LucideIcon
} from "lucide-react";
import { obtenerPerfilActual, obtenerSaludo, obtenerPerfiles } from "@eco/identidad";
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
  { clave: "emision_notificaciones", icono: Bell, nombre: "Emisión Notificaciones", detalle: "Editor WYSIWYG HTML/Markdown y Push/Email", estado: "registrado" },
  { clave: "configuracion_permisos", icono: Shield, nombre: "Gobernanza Permisos", detalle: "Matriz Perfil-Widget exclusiva SuperAdmin", estado: "proximamente" },
];

interface Props {
  searchParams: Promise<{ modo?: string }>;
}

const MODOS: readonly ModoRol[] = ["cliente", "abogado", "admin"];

/** Valida el parametro de URL contra la lista cerrada de modos. Sin esto un
 *  `?modo=cualquier-cosa` caia en el ternario final y renderizaba la vista de
 *  cliente por descarte, en vez de rechazarse. */
function modoValido(valor: string | undefined): ModoRol | null {
  return MODOS.includes(valor as ModoRol) ? (valor as ModoRol) : null;
}

/** Modo que le corresponde a un rol de negocio. Es el unico modo que vera quien
 *  no es superadmin, sin importar lo que traiga la URL. */
function modoDePerfiles(perfiles: string[]): ModoRol {
  // PLT-003 regla 3: manda el perfil de mayor jerarquía de los que tenga.
  if (perfiles.includes("ADMINISTRADOR")) return "admin";
  if (perfiles.includes("ABOGADO")) return "abogado";
  return "cliente";
}

export default async function PaginaPanel({ searchParams }: Props) {
  const { modo: modoParam } = await searchParams;

  const perfil = await obtenerPerfilActual();
  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre) : null;
  const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || nombre;

  // Ver el portal con los ojos de otro rol es una capacidad de plataforma, no
  // de negocio: solo `usu_superadmin_plataforma`. Antes el modo se tomaba de
  // `?modo=` sin contrastarlo con nada, asi que cualquier CLIENTE con sesion
  // podia escribir `?modo=admin` y ver la consola de administracion -- no
  // filtraba datos (esas tarjetas son texto fijo y las pantallas reales estan
  // protegidas por RLS y por sus guardas), pero si el mapa completo de la
  // arquitectura interna: que widgets existen, cuales estan activos, que hay
  // auditoria inmutable, cuanto almacenamiento hay contratado.
  const puedeConmutar = perfil?.usu_superadmin_plataforma === true;

  // Para quien no puede conmutar, el modo NO se lee de la URL: se deriva de su
  // membresia real. Ignorar el parametro en vez de redirigir evita un rebote
  // visible y deja la URL inofensiva.
  const perfiles = perfil ? await obtenerPerfiles(NEGOCIO) : [];
  const modo: ModoRol = puedeConmutar
    ? modoValido(modoParam) ?? "admin"
    : modoDePerfiles(perfiles);

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

        {/* Conmutador de vista por rol: solo superadmin de plataforma. Ocultarlo
            no basta por si solo -- lo que de verdad cierra la puerta es que
            `modo` se derive de la membresia cuando no se puede conmutar. Esto
            evita ademas ofrecer un control que no haria nada. */}
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

      {/* Renderizado dinámico del panel según el Rol Activo */}
      {modo === "cliente" && <PanelCliente saludo={saludo} nombre={nombre} />}
      {modo === "abogado" && <PanelAbogado nombreCompleto={nombreCompleto} />}
      {modo === "admin" && <PanelAdministrador esSuperadmin={puedeConmutar} />}

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
      {/* El saludo de la maqueta es "Hola, X. Estás tranqi." con "tranqi" en
          violeta. No se toca calcularSaludo() -- vive en @eco/identidad, lo usan
          las 4 apps y su texto depende de cuándo entraste --: se le añade encima
          la línea de marca. */}
      <h1>{saludo ?? `Hola de nuevo, ${nombre}`}. Estás <i>tranqi</i>.</h1>
      <p className="inicio-cliente-sub">¿Qué necesitas resolver hoy?</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* BANNER TU PROTECCIÓN */}
          <section className="tarjeta-proteccion" aria-labelledby="t-proteccion">
            {/* Segunda y última cinta de la pantalla (§7 permite dos). Path de
                maqueta-cliente.html. */}
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
function PanelAbogado({ nombreCompleto }: { nombreCompleto: string }) {
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
function PanelAdministrador({ esSuperadmin }: { esSuperadmin: boolean }) {
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
                {/* El titulo se ajusta a quien mira: un ADMINISTRADOR de negocio
                    llega aqui por su rol y no es superadmin de plataforma. */}
                <div className="eyebrow-cliente" id="t-admin">Gobernanza de Plataforma</div>
                <div className="tarjeta-proteccion-plan">
                  Consola <i>{esSuperadmin ? "SuperAdmin / Administrador" : "de Administración"}</i>
                </div>
                <div className="tarjeta-proteccion-meta">
                  Acceso universal a los widgets comunes y matriz de seguridad de perfiles en tranqi.
                </div>
              </div>
              {/* Solo se anuncia SuperAdmin a quien lo es de verdad. Icono de
                  lucide-react, no emoji: §5 del sistema visual. */}
              {esSuperadmin && (
                <span className="badge-rol">
                  <ShieldCheck className="icono-badge-rol" aria-hidden="true" strokeWidth={2} />
                  SuperAdmin
                </span>
              )}
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
