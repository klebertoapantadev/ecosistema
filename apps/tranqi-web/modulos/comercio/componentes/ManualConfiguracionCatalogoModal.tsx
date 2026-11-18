"use client";

import React from "react";
import {
  X,
  BookOpen,
  Flower2,
  Scale,
  Wrench,
  Layers,
  Calculator,
} from "lucide-react";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  negocio?: string;
  mostrarSelectorNegocios?: boolean;
}

interface DatosManualNegocio {
  nombreNegocio: string;
  etiquetaRubro: string;
  colorTema: string;
  colorBgBadge: string;
  colorTextoBadge: string;
  icono: React.ReactNode;
  capa1Ejemplos: string;
  capa1Desc: string;
  capa2Ejemplos: string;
  capa2Desc: string;
  capa3Ejemplos: string;
  capa3Desc: string;
}

const DATOS_POR_NEGOCIO: Record<string, DatosManualNegocio> = {
  tranqi: {
    nombreNegocio: "Tranqi Legaltech",
    etiquetaRubro: "SERVICIOS LEGALES & HONORARIOS PROFESIONALES",
    colorTema: "#5000BA",
    colorBgBadge: "#EDE9FE",
    colorTextoBadge: "#5000BA",
    icono: <Scale size={16} />,
    capa1Ejemplos: '"Derecho Societario", "Inquilinato", "Laboral", "Contratos & Minutas", "Patrocinios"',
    capa1Desc: "(Agrupa áreas del derecho, trámites y servicios jurídicos)",
    capa2Ejemplos: '"Constitución de Compañía SAS", "Revisión de Contrato de Arrendamiento", "Divorcio por Mutuo Acuerdo"',
    capa2Desc: "(El servicio jurídico base con alcance, requisitos y entregables)",
    capa3Ejemplos: '"Asesoría Inicial ($35)", "Trámite Notarial ($150)", "Patrocinio Completo ($350)"',
    capa3Desc: "(Modalidades de contratación con tarifa fija u honorario profesional)",
  },
  tinkay: {
    nombreNegocio: "Tinkay Floristería",
    etiquetaRubro: "FLORISTERÍA DE EXPORTACIÓN & ARREGLOS ON-DEMAND",
    colorTema: "#BE123C",
    colorBgBadge: "#FFE4E6",
    colorTextoBadge: "#BE123C",
    icono: <Flower2 size={16} />,
    capa1Ejemplos: '"Bouquets Estilo Coreano", "Box Florales", "Para Florero", "Eventos y Ceremonias", "Condolencias"',
    capa1Desc: "(Agrupa colecciones de arreglos, ocasiones botánicas, banners y fotos reales de taller)",
    capa2Ejemplos: '"Bouquet Diseño Estilo Coreano", "Box Floral con Orquídea", "Ramo Clásico para Florero", "Aro Floral"',
    capa2Desc: "(El arreglo floral o montaje base con fotografías, tarjeta caligráfica y cuidados Chrysal)",
    capa3Ejemplos: '"Mediano 24 Rosas ($28)", "Grande 36 Rosas ($35)", "Gigante VIP 50 Rosas ($48)"',
    capa3Desc: "(Presentaciones por tallos o tamaño, foto propia de variante y precio PVP con IVA 0% o 15%)",
  },
  fastfix: {
    nombreNegocio: "FastFix Home",
    etiquetaRubro: "MANTENIMIENTO DEL HOGAR & REPARACIONES",
    colorTema: "#0284C7",
    colorBgBadge: "#E0F2FE",
    colorTextoBadge: "#0284C7",
    icono: <Wrench size={16} />,
    capa1Ejemplos: '"Plomería & Fugas", "Electricidad", "Calefones & Bombas", "Cerrajería"',
    capa1Desc: "(Agrupa rubros técnicos de diagnóstico y reparación)",
    capa2Ejemplos: '"Mantenimiento de Calefón a Gas", "Diagnóstico de Fuga de Agua", "Cambio de Breakers"',
    capa2Desc: "(El servicio técnico base con herramientas y repuestos estándar)",
    capa3Ejemplos: '"Visita de Inspección ($25)", "Reparación Básica ($45)", "Emergencia 24/7 ($65)"',
    capa3Desc: "(Modalidades de servicio con SLA de llegada garantizado)",
  },
  margaritas: {
    nombreNegocio: "Margaritas Floristería",
    etiquetaRubro: "FLORISTERÍA BOUTIQUE & SUSCRIPCIONES",
    colorTema: "#D97706",
    colorBgBadge: "#FEF3C7",
    colorTextoBadge: "#B45309",
    icono: <Flower2 size={16} />,
    capa1Ejemplos: '"Ramos Exclusivos", "Centros de Mesa", "Suscripciones Semanales", "Ocasiones Especiales"',
    capa1Desc: "(Agrupa colecciones de flores silvestres y ambientaciones florales boutique)",
    capa2Ejemplos: '"Composición Floral Silvestre", "Centro de Mesa Presidencial", "Ramo de Rosas de Jardín"',
    capa2Desc: "(El diseño floral base con flores de temporada y tarjeta caligráfica)",
    capa3Ejemplos: '"Ramo Mediano ($30)", "Ramo Deluxe ($50)", "Suscripción Mensual ($120)"',
    capa3Desc: "(Presentaciones por volumen o frecuencia semanal con entrega programada)",
  },
};

export function ManualConfiguracionCatalogoModal({
  abierto,
  onCerrar,
  negocio = "tranqi",
  mostrarSelectorNegocios = false,
}: Props) {
  const norm = (negocio || "tranqi").toLowerCase().trim();
  const clave = norm.includes("tinkay")
    ? "tinkay"
    : norm.includes("margarita")
    ? "margaritas"
    : norm.includes("fastfix")
    ? "fastfix"
    : "tranqi";

  const [tabActiva, setTabActiva] = React.useState<string>(clave);

  React.useEffect(() => {
    setTabActiva(clave);
  }, [clave]);

  if (!abierto) return null;

  const datos = DATOS_POR_NEGOCIO[tabActiva] || DATOS_POR_NEGOCIO.tranqi!;

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
      onClick={onCerrar}
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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0F172A",
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
                color: "#38BDF8",
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                Manual de Configuración de Catálogo Comercial (PLT-009)
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
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
              color: "#94A3B8",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Identificador exclusivo del negocio (Cero referencias a otras empresas) */}
        {mostrarSelectorNegocios ? (
          <div
            style={{
              display: "flex",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              padding: "8px 16px",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setTabActiva("tranqi")}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                border: tabActiva === "tranqi" ? "1.5px solid #5000BA" : "1px solid #CBD5E1",
                background: tabActiva === "tranqi" ? "#F5F3FF" : "#FFFFFF",
                color: tabActiva === "tranqi" ? "#5000BA" : "#475569",
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
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              padding: "10px 20px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "4px 12px",
                borderRadius: "999px",
                background: datos.colorBgBadge,
                color: datos.colorTextoBadge,
                fontSize: "0.78rem",
                fontWeight: 800,
              }}
            >
              {datos.icono}
              <span>{datos.nombreNegocio}</span>
            </div>
            <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>
              {datos.etiquetaRubro}
            </span>
          </div>
        )}

        {/* Contenido del Manual */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            fontSize: "0.88rem",
            color: "#334155",
            lineHeight: 1.5,
          }}
        >
          {/* Guía Conceptual: Arquitectura de 3 Capas de Catálogo */}
          <div
            style={{
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              color: "#F8FAFC",
              borderRadius: "14px",
              padding: "18px 20px",
              marginBottom: "20px",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#38BDF8",
                fontWeight: 800,
                fontSize: "0.95rem",
                marginBottom: "10px",
              }}
            >
              <Layers size={18} />
              <span>MODELO MENTAL & ARQUITECTURA EN 3 CAPAS (ESTÁNDAR DEL CATÁLOGO)</span>
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
              <div style={{ color: "#E2E8F0" }}>
                [ <strong style={{ color: "#38BDF8" }}>CAPA 1: CATEGORÍA / COLECCIÓN</strong> ]  ➔  {datos.capa1Ejemplos}
              </div>
              <div style={{ color: "#94A3B8" }}>
                {"                                       "}{datos.capa1Desc}
              </div>
              <div style={{ color: "#38BDF8" }}>              │</div>
              <div style={{ color: "#E2E8F0" }}>
                [ <strong style={{ color: "#38BDF8" }}>CAPA 2: PRODUCTO MASTER</strong> ]        ➔  {datos.capa2Ejemplos}
              </div>
              <div style={{ color: "#94A3B8" }}>
                {"                                       "}{datos.capa2Desc}
              </div>
              <div style={{ color: "#38BDF8" }}>              │</div>
              <div style={{ color: "#E2E8F0" }}>
                [ <strong style={{ color: "#38BDF8" }}>CAPA 3: VARIANTES / SKUs</strong> ]       ➔  {datos.capa3Ejemplos}
              </div>
              <div style={{ color: "#94A3B8" }}>
                {"                                       "}{datos.capa3Desc}
              </div>
            </div>

            {/* Paso a paso de configuración */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  1️⃣ Paso 1: Colección
                </div>
                <div style={{ fontSize: "0.74rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  Crea la categoría agrupando la línea. Agrega portada/banner o video promocional si aplica.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  2️⃣ Paso 2: Producto Master
                </div>
                <div style={{ fontSize: "0.74rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  Registra el servicio/diseño base. Define nombre oficial, descripción y requisitos.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  3️⃣ Paso 3: Variantes / SKUs
                </div>
                <div style={{ fontSize: "0.74rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  Configura precios finales PVP, desglose de IVA SRI, foto de variante y SLA de entrega.
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              CONTENIDO ESPECÍFICO DE TRANQI LEGALTECH
             ========================================================================= */}
          {tabActiva === "tranqi" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "#EDE9FE",
                    color: "#5000BA",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  SERVICIOS LEGALES & HONORARIOS PROFESIONALES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "#0F172A" }}>
                Manual de Catálogo: Tranqi Legal
              </h3>
              <p style={{ margin: "0 0 16px", color: "#64748B" }}>
                En Tranqi el catálogo comercial liquida <strong>honorarios profesionales, patrocinios jurídicos y planes de retención legal</strong> con desglose tributario SRI y Payphone.
              </p>

              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "#334155" }}>
                  <Scale size={17} />
                  <span>1. Tipos de Honorarios y Servicios Jurídicos</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                  <li><strong>Servicio / Trámite Puntual:</strong> Consultas legales 1-a-1, redacción de contratos, minutas notariales.</li>
                  <li><strong>Suscripción / Plan Mensual:</strong> Blindaje legal para PYMEs y Startups con horas prepagadas de asesoría continua.</li>
                  <li><strong>Físico / Entrega Notarial:</strong> Documentos legalizados con entrega en notaría o casillero judicial.</li>
                </ul>
              </div>

              <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "#5B21B6" }}>
                  <Calculator size={17} />
                  <span>2. Facturación Electrónica e IVA 15% SRI</span>
                </div>
                <p style={{ margin: "0", fontSize: "0.82rem", color: "#4C1D95" }}>
                  Todo honorario cobrado liquida automáticamente el comprobante con la base imponible y el IVA desglosado. Si el servicio goza de exención tributaria (art. 56 LRTI), configurar como <code>IVA 0% (Exento SRI)</code>.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              CONTENIDO ESPECÍFICO DE TINKAY FLORISTERÍA
             ========================================================================= */}
          {tabActiva === "tinkay" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "#FFE4E6",
                    color: "#BE123C",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  FLORISTERÍA DE ALTA GAMA & ON-DEMAND
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "#0F172A" }}>
                Manual de Catálogo: Tinkay Floristería
              </h3>
              <p style={{ margin: "0 0 16px", color: "#64748B" }}>
                En Tinkay el catálogo comercial se estructura en torno a{" "}
                <strong>flores frescas de exportación, regalos on-demand y montajes de eventos</strong>.
              </p>

              <div style={{ background: "#FFFDF8", border: "1px solid #FED7AA", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "#9A3412" }}>
                  <Layers size={17} />
                  <span>1. Multivariantes y Tarifa IVA 0% / 15% SRI</span>
                </div>
                <ul style={{ margin: "0 0 10px 0", paddingLeft: "18px", fontSize: "0.82rem", color: "#431407" }}>
                  <li><strong>Bouquets y Box Florales:</strong> Tarifa IVA 0% (PVP = Base Imponible).</li>
                  <li><strong>Complementos (Chocolates, Peluches, Globos):</strong> Tarifa IVA 15%.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Pie de modal */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
            background: "#F8FAFC",
          }}
        >
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "#0F172A",
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
