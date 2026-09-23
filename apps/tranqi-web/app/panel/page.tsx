import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  Calendar, Upload, Coins, MessageCircle, FileText,
  Briefcase, UserCheck, Users, Settings, ShieldCheck, Bell, FileCheck,
  ShoppingBag, CreditCard, Folder, Receipt,
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
import { SeccionCoberturaCliente } from "@eco/comercio";
import { MenuCuenta } from "./MenuCuenta";
import { obtenerResumenInicioCliente, type DocumentoBilletera } from "../../modulos/inicio-cliente/consultas";
import { CifraQueCuenta } from "../../modulos/inicio-cliente/componentes/CifraQueCuenta";
import { TarjetaCaso } from "../../modulos/inicio-cliente/componentes/TarjetaCaso";
import { RejillaPlanes } from "../../modulos/inicio-cliente/componentes/RejillaPlanes";
import { BilleteraVacia } from "../../modulos/inicio-cliente/componentes/BilleteraVacia";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

const ACCESOS_CLIENTE: { icono: LucideIcon; nombre: string; detalle: string; href?: string }[] = [
  { icono: ShoppingBag, nombre: "Catálogo & Servicios", detalle: "Honorarios y planes legales", href: "/panel/catalogo-productos" },
  { icono: Folder, nombre: "Billetera digital", detalle: "Documentos con OCR y TTL", href: "/panel/billetera-documentos" },
  { icono: FileCheck, nombre: "Firmar un documento", detalle: "Con tu certificado digital", href: "/panel/firma-documentos" },
  { icono: Briefcase, nombre: "Ser abogado socio", detalle: "Postula a la red", href: "/panel/solicitud-socio" },
  { icono: Calendar, nombre: "Agendar cita", detalle: "Presencial o por video", href: "/panel/agendar" },
  { icono: Upload, nombre: "Subir documento", detalle: "Contratos, cédulas, actas", href: "/panel/cuenta" },
  { icono: Coins, nombre: "Financiamiento", detalle: "Cuotas para tu caso", href: "/panel" },
  { icono: MessageCircle, nombre: "Preguntar a tranqi", detalle: "Respuesta en minutos", href: "/panel" },
];

const ACCESOS_ABOGADO: { icono: LucideIcon; nombre: string; detalle: string; href?: string }[] = [
  { icono: Users, nombre: "CRM & Clientes", detalle: "Directorio y expedientes", href: "/panel/clientes" },
  { icono: Coins, nombre: "Mis honorarios", detalle: "Tarifario y liquidación", href: "/panel/catalogo-productos" },
  { icono: Folder, nombre: "Billetera digital", detalle: "Documentos y expedientes", href: "/panel/billetera-documentos" },
  { icono: FileCheck, nombre: "Firmar un documento", detalle: "Con tu certificado digital", href: "/panel/firma-documentos" },
  { icono: Briefcase, nombre: "Nuevas solicitudes", detalle: "3 casos en espera" },
  { icono: Calendar, nombre: "Citas de hoy", detalle: "2 videollamadas" },
  { icono: FileText, nombre: "Cargar expediente", detalle: "Demandas y providencias" },
];

const WIDGETS_OPERADOR: { clave: string; icono: LucideIcon; nombre: string; detalle: string; ruta: string }[] = [
  { clave: "crm_clientes", icono: Users, nombre: "CRM & Clientes", detalle: "Directorio y expedientes", ruta: "/panel/clientes" },
  { clave: "alta_cliente_crm", icono: UserCheck, nombre: "Alta Asistida", detalle: "Recepción con OCR", ruta: "/panel/clientes?accion=alta" },
  { clave: "socios", icono: UserCheck, nombre: "Aprobación de socios", detalle: "Cédula, título y matrícula", ruta: "/panel/socios" },
  { clave: "solicitud_socio", icono: Briefcase, nombre: "Solicitudes de socios", detalle: "Postulaciones en revisión", ruta: "/panel/administrar?widget=solicitud_socio" },
  { clave: "historial_pagos", icono: Receipt, nombre: "Historial de pagos", detalle: "Auditoría de cobros", ruta: "/panel/administrar?widget=historial_pagos" },
  { clave: "catalogo_productos", icono: ShoppingBag, nombre: "Catálogo & Precios", detalle: "Servicios con IVA", ruta: "/panel/catalogo-productos" },
  { clave: "billetera_documentos", icono: Folder, nombre: "Billetera digital", detalle: "Bóveda con OCR y TTL", ruta: "/panel/billetera-documentos" },
  { clave: "firma_documentos_pdf", icono: FileCheck, nombre: "Firmar documentos", detalle: "Firma digital .p12 y QR", ruta: "/panel/firma-documentos" },
  { clave: "emision_notificaciones", icono: Bell, nombre: "Emisión de avisos", detalle: "Despacho multicanal", ruta: "/panel/emision-notificaciones" },
];

const WIDGETS_ADMIN: { clave: string; icono: LucideIcon; nombre: string; detalle: string; ruta: string; estado: "registrado" | "proximamente" }[] = [
  { clave: "catalogo_productos", icono: ShoppingBag, nombre: "Catálogo & Honorarios", detalle: "Servicios y precios con IVA", ruta: "/panel/catalogo-productos", estado: "registrado" },
  { clave: "pasarela_payphone", icono: CreditCard, nombre: "Pasarela Payphone", detalle: "Botón de pago y simulador", ruta: "/panel/configuracion?widget=pasarela_payphone", estado: "registrado" },
  { clave: "crm_clientes", icono: Users, nombre: "CRM Jurídico & Clientes", detalle: "Expedientes y conflict check", ruta: "/panel/clientes", estado: "registrado" },
  { clave: "billetera_documentos", icono: Folder, nombre: "Billetera digital", detalle: "Bóveda segura OCR/TTL", ruta: "/panel/billetera-documentos", estado: "registrado" },
  { clave: "gestion_usuarios", icono: Users, nombre: "Gestión de usuarios", detalle: "Membresías y perfiles", ruta: "/panel/usuarios", estado: "registrado" },
  { clave: "socios", icono: UserCheck, nombre: "Aprobación de socios", detalle: "Cédula, título y matrícula", ruta: "/panel/socios", estado: "registrado" },
  { clave: "configuracion_negocio", icono: Settings, nombre: "Configuración del negocio", detalle: "Términos, locales y canales", ruta: "/panel/configuracion", estado: "registrado" },
  { clave: "auditoria", icono: ShieldCheck, nombre: "Auditoría de cambios", detalle: "Registro inalterable", ruta: "/panel/auditoria", estado: "registrado" },
  { clave: "emision_notificaciones", icono: Bell, nombre: "Emisión de notificaciones", detalle: "Despacho masivo", ruta: "/panel/emision-notificaciones", estado: "registrado" },
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

function fotoDe(detalle: unknown): string | null {
  const foto = (detalle as Record<string, unknown> | null | undefined)?.foto_url;
  return typeof foto === "string" ? foto : null;
}

function textoRol(modo: ModoRol): string {
  if (modo === "abogado") return "Socio Abogado";
  if (modo === "admin") return "Administrador";
  if (modo === "superadmin") return "SuperAdmin Plataforma";
  if (modo === "operador") return "Operador / Auxiliar";
  return modo.charAt(0).toUpperCase() + modo.slice(1);
}

export default async function PagePanel({ searchParams }: Props) {
  const perfil = await obtenerPerfilActual();
  const perfiles = await obtenerPerfiles(NEGOCIO);
  const puedeConmutar = Boolean(perfil?.usu_superadmin_plataforma);
  const rawParams = await searchParams;
  const modoURL = modoValido(rawParams?.modo);
  const cookieStore = await cookies();
  const modoCookie = modoValido(cookieStore.get("tranqi_modo_rol")?.value)
    || modoValido(cookieStore.get("tranqi_rol_favorito")?.value);

  const modo: ModoRol = puedeConmutar
    ? (modoURL ?? modoCookie ?? modoDePerfiles(perfiles))
    : modoDePerfiles(perfiles);

  const solicitudPropia = perfil ? await obtenerSolicitudPropia(perfil.usu_id) : null;
  const sPropia = solicitudPropia as unknown as { ssc_contrato_confirmado_en?: string | null; ssc_estado: string } | null;
  const tieneSolicitudEnProceso = Boolean(
    sPropia &&
    (!sPropia.ssc_contrato_confirmado_en || sPropia.ssc_estado !== "aceptada" || modo !== "abogado")
  );

  const saludo = await obtenerSaludo(perfil?.usu_nombres ?? "", perfil?.usu_apellidos ?? "");
  const nombre = perfil?.usu_nombres?.split(/\s+/)[0] ?? "Usuario";
  const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || "Usuario";
  const esAdminGlobal = puedeConmutar || perfiles.includes("ADMINISTRADOR");
  const nivelMaximo = await obtenerNivelMaximo(NEGOCIO);

  return (
    <div className="contenedor-panel">
      <div className="barra-superior-panel">
        <BuscadorModulosGlobal nivelUsuario={nivelMaximo} esSuperadmin={puedeConmutar} />

        {/* TRQ-013 (5A): menú de cuenta en vez del enlace suelto a /panel/cuenta. */}
        <MenuCuenta
          nombreCompleto={nombreCompleto}
          correo={perfil?.usu_correo ?? null}
          fotoUrl={fotoDe(perfil?.usu_detalle_usuario)}
          iniciales={iniciales(perfil?.usu_nombres, perfil?.usu_apellidos, perfil?.usu_correo)}
          rolTexto={textoRol(modo)}
          puedeConmutar={puedeConmutar}
          modoActual={modo}
        />
      </div>

      {/* POSICIÓN #1 EN PANEL HOME: Si existe una solicitud en proceso o pendiente de firma, aparece al inicio absoluto */}
      {tieneSolicitudEnProceso && solicitudPropia && (
        <TarjetaEstadoSolicitudHome solicitud={solicitudPropia as unknown as Record<string, unknown>} />
      )}

      {modo === "superadmin" ? (
        <ConsolaSuperAdminModular />
      ) : modo === "abogado" ? (
        <PanelAbogado nombreCompleto={nombreCompleto} />
      ) : modo === "admin" ? (
        <PanelAdministrador esSuperadmin={puedeConmutar} esAdminGlobal={esAdminGlobal} />
      ) : modo === "operador" ? (
        <PanelOperador nombreCompleto={nombreCompleto} />
      ) : (
        <PanelCliente saludo={saludo} nombre={nombre} usuarioId={perfil?.usu_id ?? null} />
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

/* ──────────────── 1. PANEL MODO CLIENTE ────────────────
   TRQ-013: rediseño con la maqueta v2 (demo/cliente-v2.html del taller).
   Todo lo que se ve sale de la base de datos del propio cliente; donde no
   hay dato, estado vacío (ver modulos/inicio-cliente/README.md). */
const FECHA_CORTA = new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Guayaquil" });
const HORA = new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });
const DIA_MES = new Intl.DateTimeFormat("es-EC", { day: "numeric", timeZone: "America/Guayaquil" });
const MES_CORTO = new Intl.DateTimeFormat("es-EC", { month: "short", timeZone: "America/Guayaquil" });

function vigenciaDocumento(d: DocumentoBilletera): { detalle: string; pildora: { texto: string; clase: string } | null } {
  if (d.estado === "vencido") return { detalle: `Venció hace ${Math.abs(d.diasParaVencer ?? 0)} días`, pildora: { texto: "Vencido", clase: "estado-pill es-urgente" } };
  if (d.estado === "por_vencer") return { detalle: `Vence en ${d.diasParaVencer} días`, pildora: { texto: "Por vencer", clase: "estado-pill es-urgente" } };
  if (d.estado === "vigente") return { detalle: "Vigente", pildora: { texto: "Vigente", clase: "estado-pill es-ok" } };
  return { detalle: "Sin fecha de caducidad", pildora: null };
}

async function PanelCliente({ saludo, nombre, usuarioId }: { saludo: string | null; nombre: string; usuarioId: string | null }) {
  const resumen = usuarioId ? await obtenerResumenInicioCliente(usuarioId) : null;
  const tramites = resumen?.tramitesAbiertos ?? null;
  const consultas = resumen?.consultasResueltas ?? null;
  const caso = resumen?.casoReciente ?? null;
  const billetera = resumen?.billetera ?? null;
  const cita = resumen?.proximaCita ?? null;
  const urgentesBilletera = billetera ? billetera.vencidos + billetera.porVencer : 0;

  const subtitulo = tramites
    ? `Tienes ${tramites === 1 ? "1 trámite" : `${tramites} trámites`} en marcha${cita ? ` y una cita el ${FECHA_CORTA.format(new Date(cita.inicio))}` : ""}.`
    : "¿Qué necesitas resolver hoy?";

  return (
    <>
      <div className="saludo-inicio">
        <div>
          <h1>{saludo ?? `Hola de nuevo, ${nombre}`}. Estás <i>tranqi</i>.</h1>
          <p className="inicio-cliente-sub">{subtitulo}</p>
        </div>
        <Link href="/panel/agendar" className="btn btn-primario btn-agendar">
          <Calendar size={16} aria-hidden="true" />
          Agendar cita
        </Link>
      </div>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          {/* 2B + 10A: cifras que cuentan. Solo las que se pudieron leer. */}
          {resumen && (
            <div className="cifras-inicio">
              {tramites !== null && (
                <div className="cifra-tarjeta">
                  <span className="cifra-cabecera"><span className="cifra-icono"><FileText size={15} aria-hidden="true" /></span>Mis trámites</span>
                  <b className="cifra-valor"><CifraQueCuenta valor={tramites} /><small>{tramites === 1 ? "abierto" : "abiertos"}</small></b>
                  <span className="cifra-pie">{tramites ? "Casos sin cerrar" : "Ninguno en curso"}</span>
                </div>
              )}
              {consultas !== null && (
                <div className="cifra-tarjeta">
                  <span className="cifra-cabecera"><span className="cifra-icono"><MessageCircle size={15} aria-hidden="true" /></span>Consultas</span>
                  <b className="cifra-valor"><CifraQueCuenta valor={consultas} /><small>{consultas === 1 ? "respondida" : "respondidas"}</small></b>
                  <span className="cifra-pie">Por tranqi y tu abogado</span>
                </div>
              )}
              {billetera && (
                <Link href="/panel/billetera-documentos" className={`cifra-tarjeta${urgentesBilletera ? " es-urgente" : ""}`}>
                  <span className="cifra-cabecera"><span className="cifra-icono"><Folder size={15} aria-hidden="true" /></span>Billetera</span>
                  <b className="cifra-valor"><CifraQueCuenta valor={billetera.total} /><small>{billetera.total === 1 ? "documento" : "documentos"}</small></b>
                  <span className="cifra-pie">
                    {urgentesBilletera ? <span className="punto-urgente" aria-hidden="true" /> : null}
                    {billetera.vencidos
                      ? `${billetera.vencidos} vencido${billetera.vencidos === 1 ? "" : "s"}`
                      : billetera.porVencer
                        ? `${billetera.porVencer} por vencer`
                        : billetera.total ? "Todo vigente" : "Aún vacía"}
                  </span>
                </Link>
              )}
              <Link href={cita ? "/panel/mis-citas" : "/panel/agendar"} className="cifra-tarjeta">
                <span className="cifra-cabecera"><span className="cifra-icono"><Calendar size={15} aria-hidden="true" /></span>Próxima cita</span>
                {cita ? (
                  <b className="cifra-valor es-fecha">{FECHA_CORTA.format(new Date(cita.inicio))}<small>{HORA.format(new Date(cita.inicio))}</small></b>
                ) : (
                  <b className="cifra-valor es-fecha">Sin citas</b>
                )}
                <span className="cifra-pie">{cita ? (cita.modalidad === "presencial" ? "En el despacho" : "Por videollamada") : "Agenda una"}</span>
              </Link>
            </div>
          )}

          {/* 6B + 4A: el caso abierto más reciente, o el estado vacío. */}
          {caso ? (
            <TarjetaCaso caso={caso} />
          ) : (
            <section className="tarjeta-seccion vacio-caso" aria-labelledby="t-vacio-caso">
              <div className="vacio-caso-cuerpo">
                <span className="vacio-caso-icono" aria-hidden="true"><Briefcase size={24} strokeWidth={1.6} /></span>
                <h2 id="t-vacio-caso">Aún no tienes casos abiertos</h2>
                <p>Agenda una cita y te asignamos al abogado que más sabe de tu tema.</p>
                <Link href="/panel/agendar" className="btn btn-primario">Agendar cita</Link>
              </div>
            </section>
          )}

          {/* 1) COBERTURA & PLAN ACTIVO DINÁMICO (PLT-009 / PLT-020) */}
          <SeccionCoberturaCliente negocio="tranqi" />

          {/* 3B: planes y servicios en rejilla con selector (sustituye al carrusel). */}
          <RejillaPlanes negocio="tranqi" />

          {/* 2) ACCESS GRID (Favoritos primero + Accesos predeterminados) */}
          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
            {ACCESOS_CLIENTE.map((acc, i) => (
              acc.href ? (
                <Link
                  key={i}
                  href={acc.href}
                  className="tarjeta-acceso"
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

        </div>

        {/* COLUMNA DERECHA. Salen "Tus casos" y "Tus abogados asignados",
            que eran texto fijo: el primero lo cubre ahora la tarjeta del caso
            y el segundo no tenía dato detrás. */}
        <aside className="columna-cliente">
          {cita && (
            <section className="tarjeta-seccion tarjeta-cita" aria-labelledby="t-cita">
              <header>
                <h2 id="t-cita">Próxima cita</h2>
                <Link href="/panel/mis-citas" className="enlace-accion">Ver agenda</Link>
              </header>
              <div className="cita-cuerpo">
                <span className="cita-fecha" aria-hidden="true">
                  <b>{DIA_MES.format(new Date(cita.inicio))}</b>
                  {MES_CORTO.format(new Date(cita.inicio)).replace(".", "")}
                </span>
                <div className="cita-texto">
                  <b>{cita.motivo || "Consulta legal"}</b>
                  <small>
                    {FECHA_CORTA.format(new Date(cita.inicio))} · {HORA.format(new Date(cita.inicio))} ·{" "}
                    {cita.modalidad === "presencial" ? (cita.lugar ?? "en el despacho") : "por videollamada"}
                  </small>
                </div>
              </div>
              {cita.modalidad !== "presencial" && cita.enlace && (
                <div className="cita-acciones">
                  <a href={cita.enlace} target="_blank" rel="noopener noreferrer" className="btn btn-primario btn-pequeno">Unirme</a>
                </div>
              )}
            </section>
          )}

          {billetera && (
            <section className="tarjeta-seccion tarjeta-billetera" aria-labelledby="t-billetera">
              <header>
                <h2 id="t-billetera">Billetera digital</h2>
                {billetera.total > 0 && (
                  <Link href="/panel/billetera-documentos" className="enlace-accion">
                    {billetera.total > 3 ? `Ver los ${billetera.total}` : "Abrir"}
                  </Link>
                )}
              </header>
              {billetera.total === 0 ? (
                <BilleteraVacia />
              ) : (
                <>
                  <ul className="documentos-inicio">
                    {billetera.recientes.map((d) => {
                      const v = vigenciaDocumento(d);
                      return (
                        <li key={d.id}>
                          <span className="documento-icono" aria-hidden="true"><FileText size={16} /></span>
                          <span className="documento-texto"><b>{d.titulo}</b><small>{v.detalle}</small></span>
                          {v.pildora && <span className={v.pildora.clase}>{v.pildora.texto}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="documentos-pie">
                    <Link href="/panel/billetera-documentos" className="btn btn-neutro btn-pequeno">
                      <Upload size={16} aria-hidden="true" />
                      Subir documento
                    </Link>
                  </div>
                </>
              )}
            </section>
          )}

          <SeccionNotificacionesEcosistema esAdmin={false} />
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
              <span className="badge-socio">Socio Activo</span>
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

/* ──────────────── 2.5 PANEL MODO OPERADOR / AUXILIAR ──────────────── */
function PanelOperador({ nombreCompleto }: { nombreCompleto: string }) {
  return (
    <>
      <h1>Portal Operativo & Atención — tranqi</h1>
      <p className="inicio-cliente-sub">Bienvenido(a) {nombreCompleto}. Bandeja de recepción, CRM, socios y trámites.</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">
          <section className="tarjeta-proteccion" style={{ background: "linear-gradient(135deg, #0369A1 0%, #0284C7 100%)", color: "#ffffff" }}>
            <div className="tarjeta-proteccion-fila">
              <div>
                <div className="eyebrow-cliente" style={{ color: "#E0F2FE" }}>Operaciones Ecosistema</div>
                <div className="tarjeta-proteccion-plan" style={{ color: "#ffffff" }}>Bandeja de Operador & Auxiliar</div>
                <div className="tarjeta-proteccion-meta" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Gestión integral de clientes, verificación de postulaciones, cobros y despacho de notificaciones.
                </div>
              </div>
              <span className="badge-activo" style={{ background: "#BAE6FD", color: "#075985" }}>Operativo</span>
            </div>
          </section>

          <div className="accesos-cliente">
            <TarjetasFavoritasGrid />
            {WIDGETS_OPERADOR.map((w) => (
              <Link
                key={w.clave}
                href={w.ruta}
                className="tarjeta-acceso"
              >
                <w.icono className="tarjeta-acceso-icono" aria-hidden="true" strokeWidth={1.6} />
                <strong>{w.nombre}</strong>
                <p>{w.detalle}</p>
              </Link>
            ))}
          </div>

          <section className="tarjeta-seccion">
            <header><h2>Trámites & Solicitudes Entrantes</h2></header>
            <div className="vacio-seccion">
              <b>Monitoreo en Tiempo Real</b>
              <span>Las solicitudes de socios y expedientes de clientes se sincronizan automáticamente.</span>
            </div>
          </section>
        </div>

        <aside className="columna-cliente">
          <SeccionNotificacionesEcosistema esAdmin={false} />
          <section className="tarjeta-seccion">
            <header><h2>Soporte & Turnos Operativos</h2></header>
            <div className="vacio-seccion">
              <b>Canal de Atención Activo</b>
              <span>Recepción y derivación multicanal WhatsApp / In-App.</span>
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
              <span className="badge-rol">Operativo</span>
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
