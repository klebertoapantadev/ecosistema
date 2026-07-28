import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";

export const metadata: Metadata = { title: "Panel — tranqi" };

const NEGOCIO = "tranqi";

// Accesos que un cliente esperaria en una app tecnico-legal (Red de
// Abogados + Tecnologia Juridica + Financiamiento Legal, los 3 pilares de
// la landing). Temporal hasta tener PLT-xxx/TRQ-xxx propios de cada uno --
// por eso son tarjetas sin destino real ("Proximamente"), no enlaces rotos.
const ACCESOS_CLIENTE = [
  { icono: "💬", nombre: "Asistente Legal IA", detalle: "Cuéntanos tu problema, te orientamos" },
  { icono: "📋", nombre: "Mis Trámites", detalle: "Consultas y gestiones en curso" },
  { icono: "⚖️", nombre: "Seguimiento de mi caso", detalle: "Estado y próximos pasos" },
  { icono: "👤", nombre: "Mis Abogados", detalle: "Tu red de confianza" },
  { icono: "📁", nombre: "Documentos", detalle: "Contratos, poderes, escrituras" },
  { icono: "💳", nombre: "Mis Pagos", detalle: "Financiamiento y facturas" },
  { icono: "🔔", nombre: "Recordatorios", detalle: "Vencimientos y plazos" },
  { icono: "🏛️", nombre: "Notarías y Multas", detalle: "Trámites rápidos" },
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
            <span className="tarjeta-acceso-icono" aria-hidden="true">{a.icono}</span>
            <strong>{a.nombre}</strong>
            <p>{a.detalle}</p>
            <span className="chip-proximamente">Próximamente</span>
          </div>
        ))}
      </div>
    </div>
  );
}
