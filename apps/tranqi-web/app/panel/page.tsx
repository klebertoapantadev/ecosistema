import type { Metadata } from "next";
import { MessageCircle, ClipboardList, Scale, Users, FolderOpen, CreditCard, Bell, Landmark, type LucideIcon } from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

// Accesos que un cliente esperaria en una app tecnico-legal (Red de
// Abogados + Tecnologia Juridica + Financiamiento Legal, los 3 pilares de
// la landing). Temporal hasta tener PLT-xxx/TRQ-xxx propios de cada uno --
// por eso son tarjetas sin destino real ("Proximamente"), no enlaces rotos.
// Iconos lucide-react (trazo fino, sin relleno) en vez de emoji -- mismo
// registro visual que los iconos SVG de las maquetas de referencia
// (gobernanza/productos/tranqi/maquetas/*.html).
const ACCESOS_CLIENTE: { icono: LucideIcon; nombre: string; detalle: string }[] = [
  { icono: MessageCircle, nombre: "Asistente Legal IA", detalle: "Cuéntanos tu problema, te orientamos" },
  { icono: ClipboardList, nombre: "Mis Trámites", detalle: "Consultas y gestiones en curso" },
  { icono: Scale, nombre: "Seguimiento de mi caso", detalle: "Estado y próximos pasos" },
  { icono: Users, nombre: "Mis Abogados", detalle: "Tu red de confianza" },
  { icono: FolderOpen, nombre: "Documentos", detalle: "Contratos, poderes, escrituras" },
  { icono: CreditCard, nombre: "Mis Pagos", detalle: "Financiamiento y facturas" },
  { icono: Bell, nombre: "Recordatorios", detalle: "Vencimientos y plazos" },
  { icono: Landmark, nombre: "Notarías y Multas", detalle: "Trámites rápidos" },
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

  return (
    <div className="inicio-cliente">
      <h1>{saludo ?? `Hola, ${nombre}`}</h1>
      <p className="inicio-cliente-sub">¿Qué necesitas resolver hoy?</p>

      {/* Rejilla principal + lateral, como la maqueta (§ maqueta-cliente.html).
          La lateral es lo que acompaña sin competir: hoy solo buddie, mañana
          la próxima cita y los documentos recientes. */}
      <div className="rejilla-cliente">
        <div className="columna-cliente">
          <div className="tarjeta-legal-score">
            <div className="legal-score-numero">—</div>
            <div>
              <strong>Tu Legal Score</strong>
              <p>Aún no tenemos suficiente información para calcularlo.</p>
            </div>
          </div>

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
        </div>

        <aside className="columna-cliente">
          {/* Buddie en reposo: el bloque menta de la maqueta y la cara de la
              marca dentro del portal. Sin botón vivo -- el chat con ARIA existe
              en la landing pero todavía no aquí dentro. */}
          <section className="bloque-ayuda" aria-labelledby="titulo-ayuda">
            <div className="bloque-ayuda-cabeza">
              <div className="bloque-ayuda-ojitos" aria-hidden="true" />
              <strong id="titulo-ayuda">¿Una duda rápida?</strong>
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
