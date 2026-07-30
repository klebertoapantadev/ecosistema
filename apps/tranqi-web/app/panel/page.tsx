import type { Metadata } from "next";
import { Search, Calendar, Upload, Coins, MessageCircle, type LucideIcon } from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

// Accesos rapidos de la maqueta (maqueta-cliente.html, seccion .accesos): son
// CUATRO, no ocho -- la maqueta reserva el ancho de la columna para los tramites
// y deja los accesos como una fila de atajos. Sin destino real todavia, por eso
// van etiquetados "Proximamente" y no como enlaces rotos.
const ACCESOS_CLIENTE: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: Calendar, nombre: "Agendar cita", detalle: "Presencial o por video" },
  { icono: Upload, nombre: "Subir documento", detalle: "Contratos, cédulas, actas" },
  { icono: Coins, nombre: "Financiamiento", detalle: "Cuotas para tu caso" },
  { icono: MessageCircle, nombre: "Preguntar a tranqi", detalle: "Respuesta en minutos" },
];

export default async function PaginaPanel() {
  const perfil = await obtenerPerfilActual();
  const widgets = perfil
    ? await obtenerWidgetsVisibles(perfil.usu_id, perfil.usu_superadmin_plataforma, NEGOCIO)
    : [];

  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre) : null;

  // Un ADMINISTRADOR/SUPERADMIN ya tiene su consola en el rail (Configuración,
  // Gestión de usuarios) -- el inicio de cliente es para quien no tiene nada
  // de eso todavia, el caso comun de un CLIENTE recien registrado.
  if (widgets.length > 0) {
    return (
      <div>
        <h1>{saludo ?? `Hola, ${nombre}`}</h1>
        <p>Tienes acceso a {widgets.length} función{widgets.length === 1 ? "" : "es"} en este panel.</p>
      </div>
    );
  }

  const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || nombre;

  return (
    <div className="inicio-cliente">
      {/* Barra superior de la maqueta. El buscador va deshabilitado: sin tablas
          de tramites ni documentos no hay nada que buscar, y un campo vivo
          devolveria siempre vacio. */}
      <div className="barra-cliente">
        <div className="buscador-cliente">
          <Search aria-hidden="true" strokeWidth={1.7} />
          <input type="search" placeholder="La búsqueda llegará pronto" aria-label="Buscar" disabled />
        </div>
        <div className="usuario-barra">
          <div className="usuario-barra-foto">
            {iniciales(perfil?.usu_nombres, perfil?.usu_apellidos, perfil?.usu_correo)}
          </div>
          <div className="usuario-barra-txt">
            <b>{nombreCompleto}</b>
            <span>Cliente</span>
          </div>
        </div>
      </div>

      {/* El saludo de la maqueta es "Hola, X. Estás tranqi." con "tranqi" en
          violeta. Se conserva el saludo dinámico de calcularSaludo() -- cambia
          según cuándo entraste por última vez y lo comparten las 4 apps -- y se
          le añade encima la línea de marca. */}
      <h1>{saludo ?? `Hola, ${nombre}`}. Estás <i>tranqi</i>.</h1>
      {/* La maqueta dice aquí "Tu protección jurídica está activa y sin
          pendientes de tu parte". No se copia: sin póliza contratada sería
          falso. */}
      <p className="inicio-cliente-sub">Tu protección jurídica y tus trámites, en un solo lugar.</p>

      <div className="rejilla-cliente">
        <div className="columna-cliente">

          {/* PROTECCIÓN — la única superficie de color pleno de la pantalla
              (§3 regla 1). Ocupa el sitio que la maqueta da a la póliza. */}
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

          {/* BUDDIE en reposo — el bloque menta de la maqueta */}
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

      <footer className="pie-panel">
        <span>© tranqi® 2026</span>
        <a href="/terminos">Términos</a>
      </footer>
    </div>
  );
}

/** Iniciales para el círculo de la barra superior. Con un solo nombre usa sus
 *  dos primeras letras; sin nombres cae al correo. Nunca devuelve vacío, para
 *  que el círculo no quede en blanco. */
function iniciales(nombres?: string | null, apellidos?: string | null, correo?: string | null): string {
  const [primero, segundo] = [nombres, apellidos]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  if (primero && segundo) return (primero.charAt(0) + segundo.charAt(0)).toUpperCase();
  if (primero) return primero.slice(0, 2).toUpperCase();
  return (correo ?? "?").slice(0, 2).toUpperCase();
}
