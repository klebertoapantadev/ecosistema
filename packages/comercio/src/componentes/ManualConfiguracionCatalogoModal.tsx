"use client";

import React from "react";
import {
  X,
  BookOpen,
  Flower2,
  Scale,
  Wrench,
  Layers,
  Image as ImageIcon,
  Clock,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Calculator,
  Truck,
  HeartHandshake,
  Tag,
} from "lucide-react";
import { detectarTipoNegocio } from "../utils/negocio";

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
  tinkay: {
    nombreNegocio: "Tinkay Floristería",
    etiquetaRubro: "FLORISTERÍA DE EXPORTACIÓN & ARREGLOS ON-DEMAND",
    colorTema: "#BE123C",
    colorBgBadge: "var(--cf-ffe4e6, #FFE4E6)",
    colorTextoBadge: "var(--ct-be123c, #BE123C)",
    icono: <Flower2 size={16} />,
    capa1Ejemplos: '"Bouquets Estilo Coreano", "Box Florales", "Para Florero", "Eventos y Ceremonias", "Condolencias"',
    capa1Desc: "(Agrupa colecciones de arreglos, ocasiones botánicas, banners y fotos reales de taller)",
    capa2Ejemplos: '"Bouquet Diseño Estilo Coreano", "Box Floral con Orquídea", "Ramo Clásico para Florero", "Aro Floral"',
    capa2Desc: "(El arreglo floral o montaje base con fotografías, tarjeta caligráfica y cuidados Chrysal)",
    capa3Ejemplos: '"Mediano 24 Rosas ($28)", "Grande 36 Rosas ($35)", "Gigante VIP 50 Rosas ($48)"',
    capa3Desc: "(Presentaciones por tallos o tamaño, foto propia de variante y precio PVP con IVA 0% o 15%)",
  },
  margaritas: {
    nombreNegocio: "Margaritas Floristería",
    etiquetaRubro: "FLORISTERÍA BOUTIQUE & SUSCRIPCIONES",
    colorTema: "#D97706",
    colorBgBadge: "var(--cf-fef3c7, #FEF3C7)",
    colorTextoBadge: "var(--ct-b45309, #B45309)",
    icono: <Flower2 size={16} />,
    capa1Ejemplos: '"Ramos Exclusivos", "Centros de Mesa", "Suscripciones Semanales", "Ocasiones Especiales"',
    capa1Desc: "(Agrupa colecciones de flores silvestres y ambientaciones florales boutique)",
    capa2Ejemplos: '"Composición Floral Silvestre", "Centro de Mesa Presidencial", "Ramo de Rosas de Jardín"',
    capa2Desc: "(El diseño floral base con flores de temporada y tarjeta caligráfica)",
    capa3Ejemplos: '"Ramo Mediano ($30)", "Ramo Deluxe ($50)", "Suscripción Mensual ($120)"',
    capa3Desc: "(Presentaciones por volumen o frecuencia semanal con entrega programada)",
  },
  tranqi: {
    nombreNegocio: "Tranqi Legaltech",
    etiquetaRubro: "SERVICIOS LEGALES & HONORARIOS PROFESIONALES",
    colorTema: "#5000BA",
    colorBgBadge: "var(--cf-ede9fe, #EDE9FE)",
    colorTextoBadge: "var(--ct-5000ba, #5000BA)",
    icono: <Scale size={16} />,
    capa1Ejemplos: '"Derecho Societario", "Inquilinato", "Laboral", "Contratos & Minutas", "Patrocinios"',
    capa1Desc: "(Agrupa áreas del derecho, trámites y servicios jurídicos)",
    capa2Ejemplos: '"Constitución de Compañía SAS", "Revisión de Contrato de Arrendamiento", "Divorcio por Mutuo Acuerdo"',
    capa2Desc: "(El servicio jurídico base con alcance, requisitos y entregables)",
    capa3Ejemplos: '"Asesoría Inicial ($35)", "Trámite Notarial ($150)", "Patrocinio Completo ($350)"',
    capa3Desc: "(Modalidades de contratación con tarifa fija u honorario profesional)",
  },
  fastfix: {
    nombreNegocio: "FastFix Home",
    etiquetaRubro: "MANTENIMIENTO DEL HOGAR & REPARACIONES",
    colorTema: "#0284C7",
    colorBgBadge: "var(--cf-e0f2fe, #E0F2FE)",
    colorTextoBadge: "var(--ct-0284c7, #0284C7)",
    icono: <Wrench size={16} />,
    capa1Ejemplos: '"Plomería & Fugas", "Electricidad", "Calefones & Bombas", "Cerrajería"',
    capa1Desc: "(Agrupa rubros técnicos de diagnóstico y reparación)",
    capa2Ejemplos: '"Mantenimiento de Calefón a Gas", "Diagnóstico de Fuga de Agua", "Cambio de Breakers"',
    capa2Desc: "(El servicio técnico base con herramientas y repuestos estándar)",
    capa3Ejemplos: '"Visita de Inspección ($25)", "Reparación Básica ($45)", "Emergencia 24/7 ($65)"',
    capa3Desc: "(Modalidades de servicio con SLA de llegada garantizado)",
  },
};

export function ManualConfiguracionCatalogoModal({
  abierto,
  onCerrar,
  negocio = "tranqi",
  mostrarSelectorNegocios = false,
}: Props) {
  const { identificadorNormalizado } = detectarTipoNegocio(negocio);
  const [tabActiva, setTabActiva] = React.useState<string>(identificadorNormalizado);

  React.useEffect(() => {
    setTabActiva(identificadorNormalizado);
  }, [identificadorNormalizado]);

  if (!abierto) return null;

  const datos = DATOS_POR_NEGOCIO[tabActiva] || DATOS_POR_NEGOCIO.tinkay!;

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
          background: "var(--cf-ffffff, #FFFFFF)",
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
            borderBottom: "1px solid var(--cb-e2e8f0, #E2E8F0)",
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
              <span style={{ fontSize: "0.75rem", color: "var(--ct-94a3b8, #94A3B8)" }}>
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
              color: "var(--ct-94a3b8, #94A3B8)",
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
              background: "var(--cf-f8fafc, #F8FAFC)",
              borderBottom: "1px solid var(--cb-e2e8f0, #E2E8F0)",
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
                border: tabActiva === "tinkay" ? "1.5px solid #E11D48" : "1px solid var(--cb-cbd5e1, #CBD5E1)",
                background: tabActiva === "tinkay" ? "var(--cf-fff1f2, #FFF1F2)" : "var(--cf-ffffff, #FFFFFF)",
                color: tabActiva === "tinkay" ? "var(--ct-be123c, #BE123C)" : "var(--ct-475569, #475569)",
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
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--cf-f8fafc, #F8FAFC)",
              borderBottom: "1px solid var(--cb-e2e8f0, #E2E8F0)",
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
            <span style={{ fontSize: "0.72rem", color: "var(--ct-64748b, #64748B)", fontWeight: 600 }}>
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
            color: "var(--ct-334155, #334155)",
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
              <div style={{ color: "var(--ct-94a3b8, #94A3B8)" }}>
                {"                                       "}{datos.capa1Desc}
              </div>
              <div style={{ color: "#38BDF8" }}>              │</div>
              <div style={{ color: "#E2E8F0" }}>
                [ <strong style={{ color: "#38BDF8" }}>CAPA 2: PRODUCTO MASTER</strong> ]        ➔  {datos.capa2Ejemplos}
              </div>
              <div style={{ color: "var(--ct-94a3b8, #94A3B8)" }}>
                {"                                       "}{datos.capa2Desc}
              </div>
              <div style={{ color: "#38BDF8" }}>              │</div>
              <div style={{ color: "#E2E8F0" }}>
                [ <strong style={{ color: "#38BDF8" }}>CAPA 3: VARIANTES / SKUs</strong> ]       ➔  {datos.capa3Ejemplos}
              </div>
              <div style={{ color: "var(--ct-94a3b8, #94A3B8)" }}>
                {"                                       "}{datos.capa3Desc}
              </div>
            </div>

            {/* Paso a paso de configuración */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--cb-ffffff-a100, rgba(255,255,255,0.1))" }}>
                <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  1️⃣ Paso 1: Colección
                </div>
                <div style={{ fontSize: "0.74rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  Crea la categoría agrupando la línea. Agrega portada/banner o video promocional si aplica.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--cb-ffffff-a100, rgba(255,255,255,0.1))" }}>
                <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  2️⃣ Paso 2: Producto Master
                </div>
                <div style={{ fontSize: "0.74rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  Registra el diseño base. Define nombre oficial, descripción, dedicatoria y cuidados.
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--cb-ffffff-a100, rgba(255,255,255,0.1))" }}>
                <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.78rem", marginBottom: "3px" }}>
                  3️⃣ Paso 3: Variantes / SKUs
                </div>
                <div style={{ fontSize: "0.74rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  Configura precios finales PVP, tarifa IVA (0% flores / 15% extras), foto de variante y SLA.
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              CONTENIDO ESPECÍFICO DE TINKAY FLORISTERÍA
             ========================================================================= */}
          {tabActiva === "tinkay" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "var(--cf-ffe4e6, #FFE4E6)",
                    color: "var(--ct-be123c, #BE123C)",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  FLORISTERÍA DE ALTA GAMA & ON-DEMAND
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--ct-0f172a, #0F172A)" }}>
                Manual de Catálogo: Tinkay Floristería
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--ct-64748b, #64748B)" }}>
                En Tinkay el catálogo comercial se estructura en torno al{" "}
                <strong>impacto visual, frescura botánica de exportación e inmediatez de entrega</strong>. A continuación se detallan las reglas oficiales de configuración:
              </p>

              {/* Sección 1: Multivariantes y Reglas Impositivas SRI */}
              <div style={{ background: "var(--cf-fffdf8, #FFFDF8)", border: "1px solid var(--cb-fed7aa, #FED7AA)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--ct-9a3412, #9A3412)" }}>
                  <Layers size={17} />
                  <span>1. Configuración Multivariante e Impuestos SRI Ecuador</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.84rem" }}>
                  Un arreglo floral se registra como <strong>producto maestro</strong> (ej. <em>Bouquet Diseño Estilo Coreano</em>) y contiene sus presentaciones como <strong>modalidades / variantes independientes</strong>:
                </p>
                <ul style={{ margin: "0 0 10px 0", paddingLeft: "18px", fontSize: "0.82rem", color: "var(--ct-431407, #431407)" }}>
                  <li><strong>Mediano (24 Rosas):</strong> $28.00 PVP | Tarifa IVA 0% (PVP = Base $28.00) | SKU: <code>TIN-VAR-2</code></li>
                  <li><strong>Grande (36 Rosas):</strong> $35.00 PVP | Tarifa IVA 0% (PVP = Base $35.00) | SKU: <code>TIN-VAR-3</code></li>
                  <li><strong>Gigante VIP (50 Rosas + Corona + Mariposas):</strong> $48.00 PVP | Tarifa IVA 0% (PVP = Base $48.00) | SKU: <code>TIN-VAR-5</code></li>
                  <li><strong>Box Floral (M):</strong> $40.00 PVP | Tarifa IVA 0% (PVP = Base $40.00) | SKU: <code>TIN-VAR-10</code></li>
                </ul>
                <div style={{ background: "var(--cf-fef3c7, #FEF3C7)", border: "1px solid var(--cb-fde68a, #FDE68A)", borderRadius: "8px", padding: "8px 12px", fontSize: "0.78rem", color: "var(--ct-92400e, #92400E)" }}>
                  <strong>⚖️ Regla Tributaria SRI Ecuador:</strong> Las flores naturales y arreglos botánicos aplican <strong>Tarifa IVA 0%</strong> (art. 55 LRTI). Los complementos gourmet (chocolates Ferrero, peluches, globos) y servicios de montaje especial aplican <strong>Tarifa IVA 15%</strong>.
                </div>
              </div>

              {/* Sección 2: Verticales de Catálogo (Flores, Renta y Eventos) */}
              <div style={{ background: "var(--cf-f0fdf4, #F0FDF4)", border: "1px solid var(--cb-bbf7d0, #BBF7D0)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--ct-166534, #166534)" }}>
                  <Tag size={17} />
                  <span>2. Verticales Comerciales de Tinkay</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", fontSize: "0.8rem" }}>
                  <div style={{ background: "var(--cf-ffffff, #FFFFFF)", padding: "10px", borderRadius: "8px", border: "1px solid var(--cb-dcfce7, #DCFCE7)" }}>
                    <strong style={{ color: "var(--ct-15803d, #15803D)" }}>🌸 Flores Retail:</strong> Compra directa en carrito con dedicatoria gratuita y opción de complementos florales.
                  </div>
                  <div style={{ background: "var(--cf-ffffff, #FFFFFF)", padding: "10px", borderRadius: "8px", border: "1px solid var(--cb-dcfce7, #DCFCE7)" }}>
                    <strong style={{ color: "var(--ct-0369a1, #0369A1)" }}>✨ Eventos y Ceremonias:</strong> Opera bajo flujo de <strong>Proforma Personalizada</strong> con cotización multi-variación.
                  </div>
                  <div style={{ background: "var(--cf-ffffff, #FFFFFF)", padding: "10px", borderRadius: "8px", border: "1px solid var(--cb-dcfce7, #DCFCE7)" }}>
                    <strong style={{ color: "var(--ct-b45309, #B45309)" }}>🪑 Mobiliario en Renta:</strong> Estructuras, atriles y backings en calidad de alquiler con entrega y retiro coordinado.
                  </div>
                </div>
              </div>

              {/* Sección 3: Tiempos de Entrega */}
              <div style={{ background: "var(--cf-f8fafc, #F8FAFC)", border: "1px solid var(--cb-e2e8f0, #E2E8F0)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--ct-0f172a, #0F172A)" }}>
                  <Clock size={17} />
                  <span>3. Promesas y Tiempos de Entrega (SLAs Florales)</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.84rem" }}>
                  El 80% de los compradores solicitan entrega para hoy o con franja horaria programada:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.8rem" }}>
                  <div style={{ background: "var(--cf-ffffff, #FFFFFF)", padding: "8px", borderRadius: "6px", border: "1px solid var(--cb-e2e8f0, #E2E8F0)" }}>
                    <strong>⚡ Entrega Inmediata (45–90 min):</strong> Para ramos listos de vitrina con stock del día en taller.
                  </div>
                  <div style={{ background: "var(--cf-ffffff, #FFFFFF)", padding: "8px", borderRadius: "6px", border: "1px solid var(--cb-e2e8f0, #E2E8F0)" }}>
                    <strong>🌸 Pide Hoy, Recibe Hoy:</strong> Pedidos regulares con despacho en franjas (09:00–13:00 / 14:00–18:00).
                  </div>
                </div>
              </div>

              {/* Sección 4: Recursos Digitales y Multimedia */}
              <div style={{ background: "var(--cf-eff6ff, #EFF6FF)", border: "1px solid var(--cb-bfdbfe, #BFDBFE)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--ct-1e40af, #1E40AF)" }}>
                  <ImageIcon size={17} />
                  <span>4. Recursos Digitales y Muestras Reales de Taller</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.84rem" }}>
                  Para maximizar la tasa de conversión en la vitrina e-commerce y en las conversaciones de Mía (ARIA) en WhatsApp y Web Chat:
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "var(--ct-1e3a8a, #1E3A8A)" }}>
                  <li><strong>URL Imagen / Portada:</strong> Fotografía vertical nítida del arreglo real en taller (formato 4:5 o 1:1).</li>
                  <li><strong>URL Álbum de Ejemplos:</strong> Enlace a Google Photos o Instagram (ej. <code>https://photos.app.goo.gl/...</code>) con fotos de entregas reales a clientes.</li>
                  <li><strong>Video / GIF Demostrativo:</strong> Enlace a video corto que exhiba la apertura de las rosas o el desempaque del box.</li>
                </ul>
              </div>
            </div>
          )}

          {/* =========================================================================
              CONTENIDO ESPECÍFICO DE MARGARITAS FLORISTERÍA
             ========================================================================= */}
          {tabActiva === "margaritas" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "var(--cf-fef3c7, #FEF3C7)",
                    color: "var(--ct-b45309, #B45309)",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  FLORISTERÍA BOUTIQUE & SUSCRIPCIONES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--ct-0f172a, #0F172A)" }}>
                Manual de Catálogo: Margaritas Floristería
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--ct-64748b, #64748B)" }}>
                En Margaritas el catálogo se enfoca en <strong>flores boutique de temporada, composiciones silvestres y suscripciones florales</strong> para hogares y oficinas.
              </p>

              <div style={{ background: "var(--cf-fffdf8, #FFFDF8)", border: "1px solid var(--cb-fed7aa, #FED7AA)", borderRadius: "10px", padding: "14px" }}>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "var(--ct-431407, #431407)" }}>
                  <li><strong>Ramos Boutique:</strong> Diseños con margaritas, liliums y follajes andinos con tarifa IVA 0%.</li>
                  <li><strong>Suscripciones Semanales:</strong> Entrega periódica de flores frescas los días lunes o jueves.</li>
                  <li><strong>Centros de Mesa:</strong> Diseños para recepciones, cenas y eventos corporativos.</li>
                </ul>
              </div>
            </div>
          )}

          {/* =========================================================================
              CONTENIDO ESPECÍFICO DE TRANQI LEGALTECH
             ========================================================================= */}
          {tabActiva === "tranqi" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "var(--cf-ede9fe, #EDE9FE)",
                    color: "var(--ct-5000ba, #5000BA)",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  SERVICIOS LEGALES & HONORARIOS PROFESIONALES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--ct-0f172a, #0F172A)" }}>
                Manual de Catálogo: Tranqi Legal
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--ct-64748b, #64748B)" }}>
                En Tranqi el catálogo comercial liquida <strong>honorarios profesionales, patrocinios jurídicos y planes de retención legal</strong> con desglose tributario SRI y Payphone.
              </p>

              <div style={{ background: "var(--cf-f8fafc, #F8FAFC)", border: "1px solid var(--cb-e2e8f0, #E2E8F0)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--ct-334155, #334155)" }}>
                  <Scale size={17} />
                  <span>1. Tipos de Honorarios y Servicios Jurídicos</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem" }}>
                  <li><strong>Servicio / Trámite Puntual:</strong> Consultas legales 1-a-1, redacción de contratos, minutas notariales.</li>
                  <li><strong>Suscripción / Plan Mensual:</strong> Blindaje legal para PYMEs y Startups con horas prepagadas de asesoría continua.</li>
                  <li><strong>Físico / Entrega Notarial:</strong> Documentos legalizados con entrega en notaría o casillero judicial.</li>
                </ul>
              </div>

              <div style={{ background: "var(--cf-f5f3ff, #F5F3FF)", border: "1px solid var(--cb-ddd6fe, #DDD6FE)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 800, color: "var(--ct-5b21b6, #5B21B6)" }}>
                  <Calculator size={17} />
                  <span>2. Facturación Electrónica e IVA 15% SRI</span>
                </div>
                <p style={{ margin: "0", fontSize: "0.82rem", color: "var(--ct-4c1d95, #4C1D95)" }}>
                  Todo honorario cobrado liquida automáticamente el comprobante con la base imponible y el IVA desglosado. Si el servicio goza de exención tributaria (art. 56 LRTI), configurar como <code>IVA 0% (Exento SRI)</code>.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              CONTENIDO ESPECÍFICO DE FASTFIX HOME
             ========================================================================= */}
          {tabActiva === "fastfix" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "var(--cf-e0f2fe, #E0F2FE)",
                    color: "var(--ct-0284c7, #0284C7)",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  MANTENIMIENTO DEL HOGAR & REPARACIONES
                </span>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "var(--ct-0f172a, #0F172A)" }}>
                Manual de Catálogo: FastFix Home
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--ct-64748b, #64748B)" }}>
                En FastFix el catálogo tarifario gestiona <strong>visitas técnicas de diagnóstico, reparaciones por rubro y planes de mantenimiento preventivo</strong>.
              </p>

              <div style={{ background: "var(--cf-f0f9ff, #F0F9FF)", border: "1px solid var(--cb-bae6fd, #BAE6FD)", borderRadius: "10px", padding: "14px" }}>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "var(--ct-0369a1, #0369A1)" }}>
                  <li><strong>Visita de Diagnóstico / Tarifa Básica:</strong> Costo fijo de inspección que se descuenta si el cliente aprueba la reparación.</li>
                  <li><strong>Tiempos de Atención:</strong> Seleccionar <code>⚡ Emergencia Técnica (45-60 min)</code> para fugas de agua o cortes de luz.</li>
                  <li><strong>Planes Preventivos:</strong> Suscripciones semestrales de limpieza de calefones, cisternas y tableros eléctricos.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Pie de modal */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--cb-e2e8f0, #E2E8F0)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--cf-f8fafc, #F8FAFC)",
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
