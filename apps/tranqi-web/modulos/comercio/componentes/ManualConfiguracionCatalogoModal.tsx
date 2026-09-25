"use client";

import React, { useState } from "react";
import {
  X,
  BookOpen,
  Flower2,
  Scale,
  Wrench,
  Layers,
  Image as ImageIcon,
  Clock,
  Calculator,
} from "lucide-react";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  negocio?: string;
}

export function ManualConfiguracionCatalogoModal({ abierto, onCerrar, negocio = "tranqi" }: Props) {
  const [tabActiva, setTabActiva] = useState<string>(negocio);

  if (!abierto) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--linea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--texto)",
            color: "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--acento)",
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                Manual de Configuración de Catálogo Comercial (PLT-009)
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--texto-tenue)" }}>
                Guía oficial de administración, recursos digitales, multivariantes e impuestos SRI
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--texto-tenue)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Selector de Negocio */}
        <div
          style={{
            display: "flex",
            background: "var(--fondo-suave)",
            borderBottom: "1px solid var(--linea)",
            padding: "8px 16px",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setTabActiva("tinkay")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: tabActiva === "tinkay" ? "1.5px solid var(--error)" : "1px solid var(--linea-fuerte)",
              background: tabActiva === "tinkay" ? "var(--error-diluido)" : "#FFFFFF",
              color: tabActiva === "tinkay" ? "var(--error-texto)" : "var(--texto-2)",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Flower2 size={15} />
            <span>Tinkay Floristería</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("tranqi")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: tabActiva === "tranqi" ? "1.5px solid #5000BA" : "1px solid var(--linea-fuerte)",
              background: tabActiva === "tranqi" ? "var(--acento-diluido)" : "#FFFFFF",
              color: tabActiva === "tranqi" ? "#5000BA" : "var(--texto-2)",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Scale size={15} />
            <span>Tranqi Legal</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("fastfix")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: tabActiva === "fastfix" ? "1.5px solid var(--acento)" : "1px solid var(--linea-fuerte)",
              background: tabActiva === "fastfix" ? "var(--acento-diluido)" : "#FFFFFF",
              color: tabActiva === "fastfix" ? "var(--acento-hondo)" : "var(--texto-2)",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Wrench size={15} />
            <span>FastFix Home</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("margaritas")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: tabActiva === "margaritas" ? "1.5px solid var(--aviso)" : "1px solid var(--linea-fuerte)",
              background: tabActiva === "margaritas" ? "var(--aviso-diluido)" : "#FFFFFF",
              color: tabActiva === "margaritas" ? "var(--aviso-texto)" : "var(--texto-2)",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Flower2 size={15} />
            <span>Margaritas Floristería</span>
          </button>
        </div>

        {/* Contenido del Manual */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, fontSize: "0.88rem", color: "var(--texto-2)", lineHeight: 1.5 }}>
          {/* Guía Conceptual: Arquitectura de 3 Capas de Catálogo */}
          <div
            style={{
              background: "linear-gradient(135deg, var(--texto) 0%, var(--texto) 100%)",
              color: "var(--fondo-suave)",
              borderRadius: "14px",
              padding: "18px 20px",
              marginBottom: "20px",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--acento)", fontWeight: 800, fontSize: "0.95rem", marginBottom: "10px" }}>
              <Layers size={18} />
              <span>MODELO MENTAL & ARQUITECTURA EN 3 CAPAS (ESTÁNDAR DEL ECOSISTEMA)</span>
            </div>

            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.82rem",
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                lineHeight: 1.5,
                marginBottom: "14px",
              }}
            >
              <div style={{ color: "var(--linea)" }}>[ <strong style={{ color: "var(--acento)" }}>CAPA 1: CATEGORÍA / COLECCIÓN</strong> ]  ➔  "Estilo Coreano", "Floreros", "Condolencias", "Honorarios"</div>
              <div style={{ color: "var(--texto-tenue)" }}>                                        (Agrupa decenas de productos, banners, videos y galerías)</div>
              <div style={{ color: "var(--acento)" }}>              │</div>
              <div style={{ color: "var(--linea)" }}>[ <strong style={{ color: "var(--acento)" }}>CAPA 2: PRODUCTO MASTER</strong> ]        ➔  "Bouquet Diseño Estilo Coreano", "Constitución SAS"</div>
              <div style={{ color: "var(--texto-tenue)" }}>                                        (El producto o servicio base con fotos y textos comunes)</div>
              <div style={{ color: "var(--acento)" }}>              │</div>
              <div style={{ color: "var(--linea)" }}>[ <strong style={{ color: "var(--acento)" }}>CAPA 3: VARIANTES / SKUs</strong> ]       ➔  "Pequeño 12 rosas ($25)", "Gigante VIP ($60)"</div>
              <div style={{ color: "var(--texto-tenue)" }}>                                        (Opciones de compra con precio, foto propia y promesa de entrega)</div>
            </div>

            {/* Paso a paso de configuración */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "var(--acento)", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  1️⃣ Paso 1: Colección
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--linea-fuerte)", lineHeight: 1.4 }}>
                  Crea la categoría agrupando la línea. Agrega portada/banner o video promocional si aplica.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "var(--acento)", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  2️⃣ Paso 2: Producto Master
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--linea-fuerte)", lineHeight: 1.4 }}>
                  Registra el diseño/servicio. Define el nombre oficial, descripción general y portada base.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "var(--acento)", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  3️⃣ Paso 3: Variantes / SKUs
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--linea-fuerte)", lineHeight: 1.4 }}>
                  Configura precios finales PVP (calcula base imponible e IVA 15%). Asigna fotos o SLAs puntuales si difieren.
                </div>
              </div>
            </div>
          </div>

          {tabActiva === "tinkay" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ background: "var(--error-diluido)", color: "var(--error)", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 800 }}>
                  FLORISTERÍA DE ALTA GAMA & ON-DEMAND
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--texto)" }}>
                Manual de Catálogo: Tinkay Floristería
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--texto-suave)" }}>
                En Tinkay el catálogo comercial se estructura en torno al <strong>impacto visual y la inmediatez de entrega</strong>. A continuación se detallan las reglas de configuración:
              </p>

              {/* Sección 1: Multivariantes */}
              <div style={{ background: "#FFFDF8", border: "1px solid #FED7AA", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "#9A3412" }}>
                  <Layers size={17} />
                  <span>1. Configuración Multivariante (Ejemplo: Bouquet Coreano)</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.84rem" }}>
                  Un arreglo floral debe crearse como un <strong>producto maestro</strong> (ej. <em>Bouquet Diseño Estilo Coreano</em>) y contener sus diferentes tamaños o número de rosas como <strong>modalidades / variantes independientes</strong>:
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "#431407" }}>
                  <li><strong>Pequeño (12 Rosas):</strong> Base $21.7391 + IVA 15% ($3.26) = <strong>$25.00 PVP</strong> | SKU: <code>TNK-COR-PEQ</code></li>
                  <li><strong>Mediano (24 Rosas):</strong> Base $30.4348 + IVA 15% ($4.57) = <strong>$35.00 PVP</strong> | SKU: <code>TNK-COR-MED</code></li>
                  <li><strong>Grande (36 Rosas):</strong> Base $39.1304 + IVA 15% ($5.87) = <strong>$45.00 PVP</strong> | SKU: <code>TNK-COR-GRA</code></li>
                  <li><strong>Gigante VIP (50 Rosas + Corona + Mariposas):</strong> Base $52.1739 + IVA 15% ($7.83) = <strong>$60.00 PVP</strong> | SKU: <code>TNK-COR-GIG</code></li>
                </ul>
              </div>

              {/* Sección 2: Tiempos de Entrega */}
              <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito-linea)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--exito-texto)" }}>
                  <Clock size={17} />
                  <span>2. Promesas y Tiempos de Entrega (SLAs Florales)</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.84rem" }}>
                  El 80% de las ventas son de entrega urgente o el mismo día. Selecciona siempre el preset correspondiente:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.8rem" }}>
                  <div style={{ background: "#FFFFFF", padding: "8px", borderRadius: "6px", border: "1px solid var(--exito-diluido)" }}>
                    <strong>⚡ Entrega Inmediata (45-90 min):</strong> Para ramos de vitrina y floreros con stock diario.
                  </div>
                  <div style={{ background: "#FFFFFF", padding: "8px", borderRadius: "6px", border: "1px solid var(--exito-diluido)" }}>
                    <strong>🌸 Pide Hoy, Recibe Hoy:</strong> Pedidos regulares ingresados antes de las 17:00.
                  </div>
                </div>
              </div>

              {/* Sección 3: Recursos Digitales */}
              <div style={{ background: "var(--acento-diluido)", border: "1px solid var(--acento-linea)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--acento-hondo)" }}>
                  <ImageIcon size={17} />
                  <span>3. Recursos Digitales y Muestras Reales</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.84rem" }}>
                  Para maximizar la tasa de conversión en la vitrina y en los chats de Tranqi:
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "var(--acento-hondo)" }}>
                  <li><strong>URL Imagen / Portada:</strong> Fotografía vertical nítida con buena iluminación (formato 4:5 o 1:1).</li>
                  <li><strong>URL Álbum de Ejemplos:</strong> Enlace a Google Photos o Instagram (ej. <code>https://photos.app.goo.gl/...</code>) con fotos de entregas reales a clientes.</li>
                  <li><strong>Video / GIF Demostrativo:</strong> Enlace a YouTube o archivo MP4/GIF que muestre el brillo de los papeles coreanos o el desempaque.</li>
                </ul>
              </div>
            </div>
          )}

          {tabActiva === "tranqi" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ background: "var(--acento-diluido)", color: "#5000BA", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 800 }}>
                  SERVICIOS LEGALES & HONORARIOS PROFESIONALES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--texto)" }}>
                Manual de Catálogo: Tranqi Legal
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--texto-suave)" }}>
                En Tranqi el catálogo comercial liquida <strong>honorarios profesionales, patrocinios jurídicos y planes de retención legal</strong> con desglose tributario SRI y Payphone.
              </p>

              <div style={{ background: "var(--fondo-suave)", border: "1px solid var(--linea)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--texto-2)" }}>
                  <Scale size={17} />
                  <span>1. Tipos de Honorarios y Servicios Jurídicos</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                  <li><strong>Servicio / Trámite Puntual:</strong> Consultas legales 1-a-1, redacción de contratos, minutas notariales (ej. <em>Divorcio por Mutuo Acuerdo</em> $130.43 + IVA = $150.00).</li>
                  <li><strong>Suscripción / Plan Mensual:</strong> Blindaje legal para PYMEs y Startups con horas prepagadas de asesoría continua.</li>
                  <li><strong>Físico / Entrega Notarial:</strong> Documentos legalizados con entrega en notaría o casillero judicial.</li>
                </ul>
              </div>

              <div style={{ background: "var(--acento-diluido)", border: "1px solid var(--acento-linea)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--acento-hondo)" }}>
                  <Calculator size={17} />
                  <span>2. Facturación Electrónica e IVA 15% SRI</span>
                </div>
                <p style={{ margin: "0", fontSize: "0.82rem", color: "#4C1D95" }}>
                  Todo honorario cobrado vía Payphone liquida automáticamente el comprobante con la base imponible y el IVA desglosado. Si el servicio goza de exención tributaria (art. 56 LRTI), configurar como <code>IVA 0% (Exento SRI)</code>.
                </p>
              </div>
            </div>
          )}

          {tabActiva === "fastfix" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ background: "var(--acento-diluido)", color: "var(--acento)", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 800 }}>
                  MANTENIMIENTO DEL HOGAR & REPARACIONES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--texto)" }}>
                Manual de Catálogo: FastFix Home
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--texto-suave)" }}>
                En FastFix el catálogo tarifario gestiona <strong>visitas técnicas de diagnóstico, reparaciones por rubro y planes de mantenimiento preventivo</strong>.
              </p>

              <div style={{ background: "var(--acento-diluido)", border: "1px solid var(--acento-linea)", borderRadius: "10px", padding: "14px" }}>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "var(--acento-hondo)" }}>
                  <li><strong>Visita de Diagnóstico / Tarifa Básica:</strong> Costo fijo de inspección que se descuenta si el cliente aprueba la reparación.</li>
                  <li><strong>Tiempos de Atención:</strong> Seleccionar <code>⚡ Emergencia Técnica (45-60 min)</code> para fugas de agua o cortes de luz.</li>
                  <li><strong>Planes Preventivos:</strong> Suscripciones semestrales de limpieza de calefones, cisternas y tableros eléctricos.</li>
                </ul>
              </div>
            </div>
          )}

          {tabActiva === "margaritas" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ background: "var(--aviso-diluido)", color: "var(--aviso-texto)", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 800 }}>
                  FLORISTERÍA BOUTIQUE & SUSCRIPCIONES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--texto)" }}>
                Manual de Catálogo: Margaritas Floristería
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--texto-suave)" }}>
                Sigue el mismo estándar multivariante y de recursos digitales que Tinkay, enfocado en ramos para ocasiones especiales, centros de mesa y suscripciones florales semanales para oficinas y hogares.
              </p>
            </div>
          )}
        </div>

        {/* Pie de modal */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--linea)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--fondo-suave)",
          }}
        >
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "var(--texto)",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
