// Muestra visual del sistema de marca de Tinkay -- ver
// gobernanza/productos/tinkay/sistema-visual.md. Sin funcionalidad real: no
// hay catalogo (comun_comercio sin poblar para este negocio todavia), los
// productos y precios son de ejemplo para mostrar hacia donde va el trabajo.
// Los enlaces a /registro y /ingresar siguen activos para seguir probando
// @eco/identidad contra Supabase.

import Link from "next/link";

const PRODUCTOS_MUESTRA = [
  { nombre: "Box de rosas", categoria: "Box Flower", precio: "$32", emoji: "🌹", estado: "disponible" as const },
  { nombre: "Ramo de orquídeas blancas", categoria: "Orquídeas", precio: "$45", emoji: "🌸", estado: "nuevo" as const },
  { nombre: "Centro floral de evento", categoria: "Eventos", precio: "$120", emoji: "💐", estado: "disponible" as const },
  { nombre: "Ramo sorpresa del día", categoria: "Bouquets", precio: "$28", emoji: "🌷", estado: "urgente" as const },
  { nombre: "Arreglo peonías rosa", categoria: "Especiales", precio: "$56", emoji: "🌺", estado: "agotado" as const },
];

const ETIQUETA_ESTADO: Record<string, string> = {
  disponible: "Disponible",
  nuevo: "Nuevo",
  urgente: "Entrega hoy",
  agotado: "Agotado",
};

export default function Page() {
  return (
    <div>
      <header className="muestra-encabezado">
        <span className="logo-auth">tinkay</span>
        <nav className="muestra-encabezado-enlaces">
          <Link href="/ingresar">Ingresar</Link>
          <Link href="/registro" className="btn btn-primario">Registrarme</Link>
        </nav>
      </header>

      <section className="muestra-hero">
        <span className="muestra-etiqueta">Flores &amp; Eventos</span>
        <h1>Flores con historia, para cada momento</h1>
        <p>
          Arreglos florales y decoración de eventos en Quito — de la caja que
          sorprende hasta el altar completo. Esta es una muestra visual del
          nuevo sistema de marca, todavía sin catálogo real conectado.
        </p>
        <span className="btn btn-primario">Ver catálogo (próximamente)</span>
      </section>

      <section className="muestra-seccion">
        <div className="muestra-seccion-titulo">
          <h2>Lo más pedido</h2>
          <span>Productos de ejemplo — no representan inventario real</span>
        </div>
        <div className="grid-productos">
          {PRODUCTOS_MUESTRA.map((p) => (
            <div key={p.nombre} className="tarjeta-producto">
              <div className="tarjeta-producto-foto">
                <span className={`chip-estado chip-${p.estado}`}>{ETIQUETA_ESTADO[p.estado]}</span>
                <span aria-hidden="true">{p.emoji}</span>
              </div>
              <div className="tarjeta-producto-info">
                <span>{p.categoria}</span>
                <strong>{p.nombre}</strong>
                <span className="tarjeta-producto-precio">{p.precio}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="seccion-condolencias">
        <h2>Condolencias</h2>
        <p>
          Un acompañamiento sobrio en los momentos difíciles — coronas y
          arreglos de condolencia con entrega puntual. Tratamiento visual
          deliberadamente distinto al resto del catálogo.
        </p>
        <span className="btn btn-condolencias">Ver arreglos de condolencia</span>
      </section>

      <footer className="muestra-pie">
        Muestra visual del sistema de marca de Tinkay — sin funcionalidad de
        compra todavía. Ver <Link href="/terminos">Términos de Servicio</Link>.
      </footer>
    </div>
  );
}
