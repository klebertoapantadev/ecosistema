"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  Crosshair,
  Layers,
  Link2,
  Loader2,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Truck,
  Undo2,
} from "lucide-react";
import {
  cotizarEnvioDomicilio,
  crearConfiguracionLogisticaPorDefecto,
  ZONAS_PICHINCHA_POR_DEFECTO,
  type ConfiguracionLogisticaNegocio,
  type CoordenadaGeo,
  type DetalleDireccionGeoespacial,
  type ModoCobroZona,
  type ResultadoCotizacionEnvio,
  type ZonaCoberturaLogistica,
} from "../logistica";
import {
  cotizarEnvioDesdeEntradaAction,
  guardarConfiguracionLogisticaAction,
  resolverEnlaceMapaAction,
} from "../acciones-logistica";
import { MapaCoberturaPichincha } from "./MapaCoberturaPichincha";

export interface PropsFormularioLogisticaCobertura {
  negocio: string;
  configuracionInicial?: ConfiguracionLogisticaNegocio | null;
}

const PALETA_COLORES_ZONAS = [
  "#4A453F",
  "#2F4737",
  "#4A453F",
  "#8F6A2E",
  "#EC4899",
  "#4A453F",
  "#2F4737",
  "#8F6A2E",
];

const estiloInput: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  borderRadius: "8px",
  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
  fontSize: "0.84rem",
  color: "var(--ct-221e1b, #221E1B)",
  background: "var(--cf-ffffff, #FFFFFF)",
  boxSizing: "border-box",
};

const estiloLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "var(--ct-57524c, #57524C)",
  marginBottom: "4px",
};

function resumirTarifaZona(zona: ZonaCoberturaLogistica, tarifaPorKm: number): string {
  if (!zona.activo) return "Inactiva";
  if (zona.modoCobro === "GRATIS") return "Envío Gratis ($0.00)";
  if (zona.modoCobro === "TARIFA_FIJA") return `$${zona.tarifaFija.toFixed(2)} USD`;
  return `Por Km ($${tarifaPorKm.toFixed(2)}/km)`;
}

function iconoTextoModo(zona: ZonaCoberturaLogistica): string {
  if (!zona.activo) return "⚪";
  if (zona.modoCobro === "GRATIS") return "🟢";
  if (zona.modoCobro === "TARIFA_FIJA") return "🏷️";
  return "📏";
}

export function FormularioLogisticaCobertura({
  negocio,
  configuracionInicial,
}: PropsFormularioLogisticaCobertura) {
  const [form, setForm] = useState<ConfiguracionLogisticaNegocio>(() =>
    configuracionInicial ?? crearConfiguracionLogisticaPorDefecto(negocio)
  );

  const [guardando, iniciarGuardado] = useTransition();
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const [resolviendoTaller, setResolviendoTaller] = useState(false);

  // Estado de selección, enfoque y dibujo de polígonos en el mapa
  const [zonaResaltadaId, setZonaResaltadaId] = useState<string | null>(
    form.zonas[0]?.id ?? null
  );
  const [zonaDibujandoId, setZonaDibujandoId] = useState<string | null>(null);
  const [verticesBorrador, setVerticesBorrador] = useState<[number, number][]>([]);
  const [secuenciaEnfoqueZona, setSecuenciaEnfoqueZona] = useState(0);
  const [secuenciaVerTodo, setSecuenciaVerTodo] = useState(0);
  const [secuenciaCentrarSimulador, setSecuenciaCentrarSimulador] = useState(0);

  // Controles de ampliación del mapa (alto ampliado en página + modo pantalla completa)
  const [mapaAltoAmpliado, setMapaAltoAmpliado] = useState(false);
  const [mapaPantallaCompleta, setMapaPantallaCompleta] = useState(false);

  // Simulador en vivo
  const [enlaceSimulador, setEnlaceSimulador] = useState("");
  const [puntoSimulador, setPuntoSimulador] = useState<CoordenadaGeo | null>(null);
  const [datosRutaSimulada, setDatosRutaSimulada] = useState<{
    distanciaVialKm?: number;
    fuenteDistancia: "OSRM" | "ESTIMACION_VIAL";
    rutaGeometria?: [number, number][];
    detalleDireccion?: DetalleDireccionGeoespacial | null;
  }>({ fuenteDistancia: "ESTIMACION_VIAL" });
  const [resultadoSimulador, setResultadoSimulador] = useState<ResultadoCotizacionEnvio | null>(
    null
  );
  const [simulando, setSimulando] = useState(false);

  // Salir de pantalla completa con tecla Escape
  useEffect(() => {
    if (!mapaPantallaCompleta) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setMapaPantallaCompleta(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapaPantallaCompleta]);

  // Recalcular automáticamente la simulación activa cuando se editan tarifas, polígonos o solapamientos
  useEffect(() => {
    if (!puntoSimulador) return;
    setResultadoSimulador(
      cotizarEnvioDomicilio({
        config: form,
        destino: puntoSimulador,
        distanciaVialKm: datosRutaSimulada.distanciaVialKm,
        fuenteDistancia: datosRutaSimulada.fuenteDistancia,
        rutaGeometria: datosRutaSimulada.rutaGeometria,
        detalleDireccion: datosRutaSimulada.detalleDireccion,
      })
    );
  }, [form, puntoSimulador, datosRutaSimulada]);

  const zonaSeleccionada =
    form.zonas.find((z) => z.id === zonaResaltadaId) ?? form.zonas[0] ?? null;

  const zonaEnDibujo = zonaDibujandoId
    ? form.zonas.find((z) => z.id === zonaDibujandoId) ?? null
    : null;

  async function extraerCoordenadasTaller() {
    if (!form.origenMapaUrl.trim()) return;
    setResolviendoTaller(true);
    setMensajeError(null);
    try {
      const res = await resolverEnlaceMapaAction(form.origenMapaUrl);
      if (res.ok && typeof res.lat === "number" && typeof res.lng === "number") {
        setForm((prev) => ({
          ...prev,
          origenLat: res.lat!,
          origenLng: res.lng!,
        }));
        setMensajeOk(
          `Coordenadas del taller actualizadas (${res.lat.toFixed(6)}, ${res.lng.toFixed(6)}).`
        );
      } else {
        setMensajeError(res.error ?? "No se pudo leer el enlace del taller.");
      }
    } finally {
      setResolviendoTaller(false);
    }
  }

  function actualizarZona(id: string, cambios: Partial<ZonaCoberturaLogistica>) {
    setForm((prev) => {
      const nuevasZonas = prev.zonas.map((z) => (z.id === id ? { ...z, ...cambios } : z));
      const primeraGratis = nuevasZonas.find((z) => z.activo && z.modoCobro === "GRATIS");
      return {
        ...prev,
        zonaGratisNombre: primeraGratis ? primeraGratis.nombre : prev.zonaGratisNombre,
        zonas: nuevasZonas,
      };
    });
  }

  function seleccionarZonaDropdown(id: string) {
    setZonaResaltadaId(id);
    if (zonaDibujandoId && zonaDibujandoId !== id) {
      setZonaDibujandoId(null);
      setVerticesBorrador([]);
    }
    setSecuenciaEnfoqueZona((s) => s + 1);
  }

  function agregarNuevaZona() {
    const num = form.zonas.length + 1;
    const nuevaId = `zon-custom-${Date.now()}`;
    const colorSugerido =
      PALETA_COLORES_ZONAS[(num - 1) % PALETA_COLORES_ZONAS.length] ?? "var(--ct-4a453f, #4A453F)";
    const nueva: ZonaCoberturaLogistica = {
      id: nuevaId,
      codigo: `zona_personalizada_${num}`,
      nombre: `Nueva Área ${num}`,
      provincia: "Pichincha",
      modoCobro: "TARIFA_FIJA",
      tarifaFija: 5.0,
      prioridad: num,
      activo: true,
      color: colorSugerido,
      sectoresReferencia: [],
      poligono: [
        [-0.21, -78.49],
        [-0.21, -78.46],
        [-0.18, -78.46],
        [-0.18, -78.49],
      ],
    };
    setForm((prev) => ({ ...prev, zonas: [...prev.zonas, nueva] }));
    setZonaResaltadaId(nuevaId);
    setZonaDibujandoId(nuevaId);
    setVerticesBorrador([]);
    setMensajeError(null);
  }

  function eliminarZona(id: string) {
    if (form.zonas.length <= 1) {
      setMensajeError("Debe mantenerse al menos un área de cobertura configurada.");
      return;
    }
    const restantes = form.zonas.filter((z) => z.id !== id);
    setForm((prev) => ({
      ...prev,
      zonas: restantes,
    }));
    if (zonaResaltadaId === id) {
      setZonaResaltadaId(restantes[0]?.id ?? null);
    }
    if (zonaDibujandoId === id) {
      setZonaDibujandoId(null);
      setVerticesBorrador([]);
    }
  }

  function aplicarPoligonoDibujado() {
    if (!zonaDibujandoId || verticesBorrador.length < 3) {
      setMensajeError("Marca al menos 3 esquinas en el mapa para cerrar el polígono del área.");
      return;
    }
    actualizarZona(zonaDibujandoId, { poligono: verticesBorrador });
    setZonaResaltadaId(zonaDibujandoId);
    setZonaDibujandoId(null);
    setVerticesBorrador([]);
    setSecuenciaEnfoqueZona((s) => s + 1);
    setMensajeError(null);
    setMensajeOk("Área actualizada en el mapa. Pulsa «Guardar Cambios» para publicarla.");
  }

  function restaurarZonasPichincha() {
    const restauradas = ZONAS_PICHINCHA_POR_DEFECTO.map((z) => ({
      ...z,
      sectoresReferencia: [...z.sectoresReferencia],
      poligono: z.poligono.map(([lat, lng]) => [lat, lng] as [number, number]),
    }));
    setForm((prev) => ({
      ...prev,
      zonaGratisNombre: "Centro-Norte de Quito",
      zonas: restauradas,
    }));
    setZonaResaltadaId(restauradas[0]?.id ?? null);
    setZonaDibujandoId(null);
    setVerticesBorrador([]);
    setSecuenciaVerTodo((s) => s + 1);
    setMensajeOk("Áreas base de Pichincha restauradas en pantalla.");
  }

  async function simularPuntoOEnlace(puntoDirecto?: CoordenadaGeo) {
    setSimulando(true);
    setMensajeError(null);
    if (puntoDirecto) {
      setPuntoSimulador(puntoDirecto);
    }
    try {
      if (!puntoDirecto && !enlaceSimulador.trim()) {
        setMensajeError(
          "Haz clic en cualquier punto del mapa o pega un enlace de Google Maps / Waze."
        );
        return;
      }

      const resCot = puntoDirecto
        ? await cotizarEnvioDesdeEntradaAction({
            negocio,
            lat: puntoDirecto.lat,
            lng: puntoDirecto.lng,
          })
        : await cotizarEnvioDesdeEntradaAction({
            negocio,
            enlaceOTexto: enlaceSimulador.trim(),
          });

      if (!resCot.ok) {
        setMensajeError(resCot.error);
        return;
      }

      const destino = resCot.cotizacion.destino;
      const vialKm = resCot.cotizacion.distanciaVialKm;
      const geom = resCot.cotizacion.rutaGeometria;
      const fuente = resCot.cotizacion.fuenteDistancia;
      const detalleDir = resCot.cotizacion.detalleDireccion ?? null;

      setDatosRutaSimulada({
        distanciaVialKm: vialKm,
        fuenteDistancia: fuente,
        rutaGeometria: geom,
        detalleDireccion: detalleDir,
      });
      setPuntoSimulador(destino);
      if (!puntoDirecto) {
        setSecuenciaCentrarSimulador((s) => s + 1);
      }

      const cotLocal = cotizarEnvioDomicilio({
        config: form,
        destino,
        distanciaVialKm: vialKm,
        fuenteDistancia: fuente,
        rutaGeometria: geom,
        detalleDireccion: detalleDir,
      });

      setResultadoSimulador(cotLocal);
      if (cotLocal.zonaDetectada?.id) {
        setZonaResaltadaId(cotLocal.zonaDetectada.id);
      }
    } finally {
      setSimulando(false);
    }
  }

  function ejecutarGuardadoDirecto() {
    setMensajeOk(null);
    setMensajeError(null);

    iniciarGuardado(async () => {
      const res = await guardarConfiguracionLogisticaAction(negocio, form);
      if (!res.ok) {
        setMensajeError(res.error);
        return;
      }
      setMensajeOk(
        "Configuración de logística, áreas de cobertura y tarifas guardada correctamente."
      );
    });
  }

  function manejarGuardar(e: React.FormEvent) {
    e.preventDefault();
    ejecutarGuardadoDirecto();
  }

  const totalActivas = form.zonas.filter((z) => z.activo).length;
  const alturaMapaInline = mapaAltoAmpliado ? 680 : 480;

  return (
    <form
      onSubmit={manejarGuardar}
      style={{ display: "flex", flexDirection: "column", gap: "22px" }}
    >
      {/* Bloque 1: Taller / Punto de Origen */}
      <div
        style={{
          background: "var(--cf-f8f7f4, #F8F7F4)",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          borderRadius: "12px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={17} color="#221E1B" />
            <strong style={{ fontSize: "0.92rem", color: "var(--ct-221e1b, #221E1B)" }}>
              1. Punto de Partida (Taller / Tienda Física)
            </strong>
          </div>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--ct-57524c, #57524C)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.permitirRetiroLocal}
              onChange={(e) => setForm({ ...form, permitirRetiroLocal: e.target.checked })}
            />
            <span>Habilitar Retiro Gratis en Tienda ($0.00)</span>
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label style={estiloLabel}>Nombre del Taller / Local</label>
            <input
              type="text"
              value={form.origenNombre}
              onChange={(e) => setForm({ ...form, origenNombre: e.target.value })}
              style={estiloInput}
            />
          </div>
          <div>
            <label style={estiloLabel}>Dirección Referencial</label>
            <input
              type="text"
              value={form.origenDireccion}
              onChange={(e) => setForm({ ...form, origenDireccion: e.target.value })}
              style={estiloInput}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "2 1 240px", minWidth: 0 }}>
            <label style={estiloLabel}>Enlace Oficial de Google Maps / Waze del Taller</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={form.origenMapaUrl}
                onChange={(e) => setForm({ ...form, origenMapaUrl: e.target.value })}
                placeholder="https://maps.app.goo.gl/..."
                style={{ ...estiloInput, flex: "1 1 180px", minWidth: 0 }}
              />
              <button
                type="button"
                disabled={resolviendoTaller}
                onClick={() => void extraerCoordenadasTaller()}
                title="Extraer latitud y longitud automáticamente desde el enlace"
                aria-label="Extraer Pin"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-221e1b, #221E1B)",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {resolviendoTaller ? <Loader2 size={14} /> : <Link2 size={14} />}
                <span>Extraer Pin</span>
              </button>
            </div>
          </div>

          <div style={{ flex: "1 1 140px", minWidth: 0 }}>
            <label style={estiloLabel}>Latitud Taller</label>
            <input
              type="number"
              step="0.0000001"
              value={form.origenLat}
              onChange={(e) => setForm({ ...form, origenLat: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div style={{ flex: "1 1 140px", minWidth: 0 }}>
            <label style={estiloLabel}>Longitud Taller</label>
            <input
              type="number"
              step="0.0000001"
              value={form.origenLng}
              onChange={(e) => setForm({ ...form, origenLng: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>
        </div>
      </div>

      {/* Bloque 2: Zona por Defecto y Regla Tarifaria por Kilómetro */}
      <div
        style={{
          background: "var(--cf-ffffff, #FFFFFF)",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          borderRadius: "12px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Truck size={17} color="#2F4737" />
          <strong style={{ fontSize: "0.92rem", color: "var(--ct-221e1b, #221E1B)" }}>
            2. Zona Envío Gratis por Defecto y Fórmula por Kilómetro
          </strong>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label style={estiloLabel}>Zona o Sector por Defecto («Envío Gratis»)</label>
            <input
              type="text"
              value={form.zonaGratisNombre}
              onChange={(e) => setForm({ ...form, zonaGratisNombre: e.target.value })}
              placeholder="Centro-Norte de Quito"
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Etiqueta Visible por Defecto en Productos</label>
            <input
              type="text"
              value={form.etiquetaEnvioGratis}
              onChange={(e) => setForm({ ...form, etiquetaEnvioGratis: e.target.value })}
              placeholder="🌸 Envío Gratis en Centro-Norte de Quito"
              style={estiloInput}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px",
          }}
        >
          <div>
            <label style={estiloLabel}>Costo por Km (USD)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              value={form.tarifaPorKm}
              onChange={(e) => setForm({ ...form, tarifaPorKm: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Descuento Fijo Base (-USD)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={form.subsidioBaseUsd}
              onChange={(e) => setForm({ ...form, subsidioBaseUsd: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Mínimo Extra Fuera Zona (USD)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={form.recargoMinimoExtra}
              onChange={(e) => setForm({ ...form, recargoMinimoExtra: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Tarifa si No Incluye Envío</label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={form.tarifaBaseNoIncluido}
              onChange={(e) => setForm({ ...form, tarifaBaseNoIncluido: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Hora Exacta (+USD)</label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={form.recargoHoraExacta}
              onChange={(e) => setForm({ ...form, recargoHoraExacta: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div>
            <label style={estiloLabel}>Radio Máximo (km)</label>
            <input
              type="number"
              step="1"
              min="5"
              value={form.radioMaximoKm}
              onChange={(e) => setForm({ ...form, radioMaximoKm: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            background: "var(--cf-f8f7f4, #F8F7F4)",
            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
            borderRadius: "9px",
            padding: "10px 12px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.mostrarKilometrosCliente !== false}
            onChange={(e) => setForm({ ...form, mostrarKilometrosCliente: e.target.checked })}
            style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "var(--ct-2f4737, #2F4737)" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Mostrar número de kilómetros (km) al cliente en cotizaciones y chat
            </span>
            <span style={{ fontSize: "0.74rem", color: "var(--ct-847d74, #847D74)", lineHeight: 1.4 }}>
              La fórmula interna (costo por km y descuento absorbido) nunca es visible para el
              cliente y se guarda únicamente en el pedido de la tienda.
            </span>
          </div>
        </label>

        {/* Beneficio Exclusivo para Clientes Registrados vs Visitantes sin Cuenta */}
        <div
          style={{
            background: "var(--cf-faf6ee, #FAF6EE)",
            border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
            borderRadius: "9px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.envioGratisSoloRegistrados !== false}
              onChange={(e) =>
                setForm({ ...form, envioGratisSoloRegistrados: e.target.checked })
              }
              style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "var(--ct-2f4737, #2F4737)" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ct-745622, #745622)" }}>
                Zona de cobertura gratuita exclusiva para Clientes Registrados
              </span>
              <span style={{ fontSize: "0.74rem", color: "var(--ct-745622, #745622)", lineHeight: 1.4 }}>
                Cuando está activo, los compradores invitados sin cuenta no cuentan con cobertura
                gratuita y pagan la tarifa mínima base + costo por kilómetro.
              </span>
            </div>
          </label>

          {form.envioGratisSoloRegistrados !== false && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
                paddingTop: "4px",
              }}
            >
              <div>
                <label style={estiloLabel}>Tarifa Mínima No Registrado (USD)</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={form.tarifaBaseNoRegistradoUsd ?? 1.0}
                  onChange={(e) =>
                    setForm({ ...form, tarifaBaseNoRegistradoUsd: Number(e.target.value) })
                  }
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloLabel}>Costo por Km No Registrado (USD)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={form.tarifaPorKmNoRegistradoUsd ?? 0.5}
                  onChange={(e) =>
                    setForm({ ...form, tarifaPorKmNoRegistradoUsd: Number(e.target.value) })
                  }
                  style={estiloInput}
                />
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            background: "var(--cf-f2f6f3, #F2F6F3)",
            border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
            borderRadius: "9px",
            padding: "10px 12px",
            fontSize: "0.78rem",
            color: "var(--ct-2b4a36, #2B4A36)",
            lineHeight: 1.45,
          }}
        >
          <strong>
            Fórmula interna fuera de «{form.zonaGratisNombre}» (solo visible en pedido de tienda):
          </strong>{" "}
          <code>
            Máx(${form.recargoMinimoExtra.toFixed(2)}, (Distancia vial desde taller × $
            {form.tarifaPorKm.toFixed(2)}/km) − ${form.subsidioBaseUsd.toFixed(2)})
          </code>
          . Redondeo comercial automático: menos de $0.25 baja al entero ($X.00), entre $0.25 y
          $0.50 aproxima a $X.50, y más de $0.50 sube al entero superior. En áreas solapadas gana la{" "}
          <strong>tarifa más baja</strong>.
        </div>
      </div>

      {/* Bloque 3: Workspace de Configuración de Áreas (con opción Pantalla Completa y Dropdown compacto) */}
      <div
        style={
          mapaPantallaCompleta
            ? {
                position: "fixed",
                inset: "12px",
                zIndex: 9990,
                background: "var(--cf-ffffff, #FFFFFF)",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                borderRadius: "14px",
                padding: "16px 20px",
                boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.38)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowY: "auto",
              }
            : {
                background: "var(--cf-ffffff, #FFFFFF)",
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                borderRadius: "12px",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }
        }
      >
        {/* Cabecera del Workspace + Botones de Mapa / Creación */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "0.94rem", color: "var(--ct-221e1b, #221E1B)" }}>
                3. Áreas de Cobertura en Pichincha y Simulador GPS
              </strong>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "2px 9px",
                  borderRadius: "999px",
                  background: "var(--cf-f4f2ee, #F4F2EE)",
                  border: "1px solid var(--cb-ddd8ce, #DDD8CE)",
                  color: "var(--ct-221e1b, #221E1B)",
                  fontSize: "0.71rem",
                  fontWeight: 700,
                }}
              >
                <Layers size={12} />
                <span>Solapamiento activo: gana tarifa menor</span>
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ct-847d74, #847D74)" }}>
              Selecciona un área en el desplegable para editar su precio o dibujar sus límites sobre
              el mapa ({totalActivas} de {form.zonas.length} activas).
            </div>
          </div>

          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={agregarNuevaZona}
              title="Crear una nueva área de cobertura y dibujarla en el mapa"
              aria-label="Nueva Área"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 12px",
                borderRadius: "8px",
                border: "1px solid var(--cb-221e1b, #221E1B)",
                background: "#221E1B",
                color: "#FFFFFF",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              <span>Nueva Área</span>
            </button>

            <button
              type="button"
              onClick={restaurarZonasPichincha}
              title="Restaurar las áreas base sugeridas de Quito y Valles"
              aria-label="Zonas Base"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 11px",
                borderRadius: "8px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: "var(--cf-ffffff, #FFFFFF)",
                color: "var(--ct-57524c, #57524C)",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Zonas Base</span>
            </button>

            {!mapaPantallaCompleta && (
              <button
                type="button"
                onClick={() => setMapaAltoAmpliado((v) => !v)}
                title={
                  mapaAltoAmpliado
                    ? "Volver al alto estándar del mapa"
                    : "Ampliar la altura del mapa en esta pantalla"
                }
                aria-label={mapaAltoAmpliado ? "Alto Normal" : "Ampliar Mapa"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 11px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: mapaAltoAmpliado ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-221e1b, #221E1B)",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <MapIcon size={13} />
                <span>{mapaAltoAmpliado ? "Alto Normal" : "Ampliar Mapa"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMapaPantallaCompleta((v) => !v)}
              title={
                mapaPantallaCompleta
                  ? "Salir de pantalla completa (Esc)"
                  : "Abrir mapa y editor de áreas a pantalla completa"
              }
              aria-label={mapaPantallaCompleta ? "Cerrar Vista" : "Pantalla Completa"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 12px",
                borderRadius: "8px",
                border: mapaPantallaCompleta ? "1px solid #8A2E2E" : "1px solid var(--cb-221e1b, #221E1B)",
                background: mapaPantallaCompleta ? "var(--cf-faf2f2, #FAF2F2)" : "var(--cf-f4f2ee, #F4F2EE)",
                color: mapaPantallaCompleta ? "var(--ct-8a2e2e, #8A2E2E)" : "var(--ct-3a3530, #3A3530)",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {mapaPantallaCompleta ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{mapaPantallaCompleta ? "Cerrar Vista" : "Pantalla Completa"}</span>
            </button>

            {mapaPantallaCompleta && (
              <button
                type="button"
                disabled={guardando}
                onClick={ejecutarGuardadoDirecto}
                title="Guardar configuración de áreas y tarifas"
                aria-label="Guardar Cambios"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 13px",
                  borderRadius: "8px",
                  border: "1px solid #2F4737",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: guardando ? "wait" : "pointer",
                }}
              >
                {guardando ? <Loader2 size={14} /> : <Save size={14} />}
                <span>Guardar Cambios</span>
              </button>
            )}
          </div>
        </div>

        {/* Panel Compacto de Selección por Dropdown + Edición del Área Seleccionada */}
        {zonaSeleccionada && (
          <div
            style={{
              background: "var(--cf-f8f7f4, #F8F7F4)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderLeft: `4px solid ${zonaSeleccionada.color || "var(--cb-221e1b, #221E1B)"}`,
              borderRadius: "10px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Fila 1: Dropdown selector de área + Enfocar / Ver todas / Dibujar / Eliminar */}
            <div
              style={{
                display: "flex",
                alignItems: "end",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 280px" }}>
                <label style={estiloLabel}>Seleccionar Área a Editar</label>
                <SelectConBuscador
                  value={zonaSeleccionada.id}
                  onChange={(e) => seleccionarZonaDropdown(e.target.value)}
                  style={{
                    ...estiloInput,
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    borderColor: "var(--cb-d5cfc4, #D5CFC4)",
                    cursor: "pointer",
                  }}
                >
                  {form.zonas.map((z) => (
                    <option key={z.id} value={z.id}>
                      {iconoTextoModo(z)} {z.nombre} — {resumirTarifaZona(z, form.tarifaPorKm)}
                    </option>
                  ))}
                </SelectConBuscador>
              </div>

              <button
                type="button"
                onClick={() => setSecuenciaEnfoqueZona((s) => s + 1)}
                title="Centrar y acercar el mapa al área seleccionada"
                aria-label="Enfocar Área"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  height: "36px",
                  padding: "0 11px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-1f1c19, #1F1C19)",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Crosshair size={14} />
                <span>Enfocar Área</span>
              </button>

              <button
                type="button"
                onClick={() => setSecuenciaVerTodo((s) => s + 1)}
                title="Encuadrar todas las áreas activas de Pichincha en el mapa"
                aria-label="Ver Todas"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  height: "36px",
                  padding: "0 11px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-57524c, #57524C)",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Layers size={14} />
                <span>Ver Todas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (zonaDibujandoId === zonaSeleccionada.id) {
                    setZonaDibujandoId(null);
                    setVerticesBorrador([]);
                  } else {
                    setZonaDibujandoId(zonaSeleccionada.id);
                    setVerticesBorrador([]);
                  }
                }}
                title={`Dibujar o redibujar en el mapa los límites de «${zonaSeleccionada.nombre}» (${zonaSeleccionada.poligono.length} vértices actuales)`}
                aria-label="Dibujar Área"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border:
                    zonaDibujandoId === zonaSeleccionada.id
                      ? "1px solid #8A2E2E"
                      : "1px solid var(--cb-221e1b, #221E1B)",
                  background:
                    zonaDibujandoId === zonaSeleccionada.id ? "#8A2E2E" : "#221E1B",
                  color: "#FFFFFF",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <PenTool size={13} />
                <span>
                  {zonaDibujandoId === zonaSeleccionada.id ? "Dibujando..." : "Dibujar Área"}
                </span>
              </button>

              {zonaSeleccionada.codigo !== "centro_norte_quito" && form.zonas.length > 1 && (
                <button
                  type="button"
                  onClick={() => eliminarZona(zonaSeleccionada.id)}
                  title={`Eliminar el área «${zonaSeleccionada.nombre}»`}
                  aria-label="Eliminar Área"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    height: "36px",
                    padding: "0 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-e5caca, #E5CACA)",
                    background: "var(--cf-faf2f2, #FAF2F2)",
                    color: "var(--ct-8a2e2e, #8A2E2E)",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Eliminar Área</span>
                </button>
              )}
            </div>

            {/* Fila 2: Campos compactos del área seleccionada */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(175px, 100%), 1fr))",
                gap: "10px",
                alignItems: "end",
              }}
            >
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <label
                  title="Habilitar o deshabilitar temporalmente esta área"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "35px",
                    padding: "0 10px",
                    borderRadius: "8px",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--ct-1f1c19, #1F1C19)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flex: "1 1 auto",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={zonaSeleccionada.activo}
                    onChange={(e) =>
                      actualizarZona(zonaSeleccionada.id, { activo: e.target.checked })
                    }
                  />
                  <span>Activa</span>
                </label>

                <div>
                  <label style={estiloLabel}>Color</label>
                  <input
                    type="color"
                    value={zonaSeleccionada.color || "#221E1B"}
                    title="Color del polígono en el mapa (útil para distinguir áreas solapadas)"
                    onChange={(e) =>
                      actualizarZona(zonaSeleccionada.id, { color: e.target.value })
                    }
                    style={{
                      width: "44px",
                      height: "35px",
                      padding: "2px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      cursor: "pointer",
                      display: "block",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={estiloLabel}>Nombre del Área</label>
                <input
                  type="text"
                  value={zonaSeleccionada.nombre}
                  onChange={(e) =>
                    actualizarZona(zonaSeleccionada.id, { nombre: e.target.value })
                  }
                  style={{ ...estiloInput, fontWeight: 700, padding: "7px 10px" }}
                />
              </div>

              <div>
                <label style={estiloLabel}>Modalidad de Cobro</label>
                <SelectConBuscador
                  value={zonaSeleccionada.modoCobro}
                  onChange={(e) =>
                    actualizarZona(zonaSeleccionada.id, {
                      modoCobro: e.target.value as ModoCobroZona,
                    })
                  }
                  style={{ ...estiloInput, fontWeight: 600, padding: "7px 9px" }}
                >
                  <option value="GRATIS">🟢 Envío Gratis ($0)</option>
                  <option value="TARIFA_FIJA">🏷️ Tarifa Fija Zona</option>
                  <option value="POR_KM">📏 Cálculo por Km</option>
                </SelectConBuscador>
              </div>

              <div>
                <label style={estiloLabel}>
                  {zonaSeleccionada.modoCobro === "TARIFA_FIJA" ? "Tarifa (USD)" : "Valor Aplicado"}
                </label>
                {zonaSeleccionada.modoCobro === "TARIFA_FIJA" ? (
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={zonaSeleccionada.tarifaFija}
                    onChange={(e) =>
                      actualizarZona(zonaSeleccionada.id, {
                        tarifaFija: Number(e.target.value),
                      })
                    }
                    style={{ ...estiloInput, fontWeight: 700, padding: "7px 10px" }}
                  />
                ) : (
                  <div
                    style={{
                      height: "35px",
                      padding: "0 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color:
                        zonaSeleccionada.modoCobro === "GRATIS" ? "var(--ct-2f4737, #2F4737)" : "var(--ct-57524c, #57524C)",
                    }}
                  >
                    {zonaSeleccionada.modoCobro === "GRATIS"
                      ? "$0.00 USD"
                      : `$${form.tarifaPorKm.toFixed(2)}/km`}
                  </div>
                )}
              </div>

              <div>
                <label style={estiloLabel}>Barrios / Sectores Referenciales</label>
                <input
                  type="text"
                  value={zonaSeleccionada.sectoresReferencia.join(", ")}
                  onChange={(e) =>
                    actualizarZona(zonaSeleccionada.id, {
                      sectoresReferencia: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Ej. Nayón, Tanda, Miravalle"
                  style={{ ...estiloInput, padding: "7px 10px", fontSize: "0.79rem" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Barra de Dibujo Activo pegada justo encima del mapa */}
        {zonaEnDibujo && (
          <div
            style={{
              background: "var(--cf-faf2f2, #FAF2F2)",
              border: "1px solid var(--cb-e5caca, #E5CACA)",
              borderRadius: "9px",
              padding: "9px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "0.79rem",
              color: "var(--ct-8a2e2e, #8A2E2E)",
            }}
          >
            <span>
              ✏️ <strong>Dibujando «{zonaEnDibujo.nombre}»:</strong> haz clic en el mapa marcando
              cada esquina ({verticesBorrador.length} vértices). Puedes solapar con otras áreas
              libremente.
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={verticesBorrador.length === 0}
                onClick={() => setVerticesBorrador((prev) => prev.slice(0, -1))}
                title="Quitar el último punto marcado en el mapa"
                aria-label="Deshacer Punto"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--cb-debaba, #DEBABA)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-8a2e2e, #8A2E2E)",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: verticesBorrador.length === 0 ? "not-allowed" : "pointer",
                  opacity: verticesBorrador.length === 0 ? 0.5 : 1,
                }}
              >
                <Undo2 size={13} />
                <span>Deshacer Punto</span>
              </button>

              <button
                type="button"
                onClick={aplicarPoligonoDibujado}
                title="Guardar las esquinas marcadas en esta área"
                aria-label="Aplicar Área"
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#8A2E2E",
                  color: "#FFFFFF",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Aplicar Área
              </button>

              <button
                type="button"
                onClick={() => {
                  setZonaDibujandoId(null);
                  setVerticesBorrador([]);
                }}
                title="Salir del modo dibujo conservando el polígono anterior"
                aria-label="Cancelar"
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--cb-debaba, #DEBABA)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-8a2e2e, #8A2E2E)",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Mapa Cartográfico Amplio / Pantalla Completa */}
        <div style={{ flex: mapaPantallaCompleta ? "1 1 auto" : undefined }}>
          <MapaCoberturaPichincha
            origen={{ lat: form.origenLat, lng: form.origenLng }}
            origenNombre={form.origenNombre}
            destino={puntoSimulador}
            zonas={form.zonas}
            zonaResaltadaId={zonaSeleccionada?.id ?? zonaResaltadaId}
            rutaGeometria={resultadoSimulador?.rutaGeometria}
            alturaPx={alturaMapaInline}
            alturaCss={mapaPantallaCompleta ? "calc(100vh - 310px)" : undefined}
            modoDibujoPoligono={Boolean(zonaDibujandoId)}
            verticesDibujo={verticesBorrador}
            secuenciaEnfoqueZona={secuenciaEnfoqueZona}
            secuenciaVerTodo={secuenciaVerTodo}
            secuenciaCentrarDestino={secuenciaCentrarSimulador}
            onSeleccionarPunto={(pt) => {
              void simularPuntoOEnlace(pt);
            }}
            onAgregarVerticePoligono={(pt) => {
              setVerticesBorrador((prev) => [...prev, [pt.lat, pt.lng]]);
            }}
          />
        </div>

        {/* Barra del Simulador Rápido + Resultado en Vivo */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={enlaceSimulador}
            onChange={(e) => setEnlaceSimulador(e.target.value)}
            placeholder="Simulador: haz clic en cualquier punto del mapa o pega un link de Google Maps / Apple Maps / Waze..."
            style={{ ...estiloInput, flex: "1 1 280px" }}
          />
          <button
            type="button"
            disabled={simulando}
            onClick={() => void simularPuntoOEnlace()}
            title="Probar cotización con las reglas y áreas actuales"
            aria-label="Simular Envío"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "0 14px",
              borderRadius: "8px",
              border: "1px solid #2F4737",
              background: "#2F4737",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {simulando ? <Loader2 size={14} /> : <MapPin size={14} />}
            <span>Simular Envío</span>
          </button>
        </div>

        {resultadoSimulador && (
          <div
            style={{
              background: "var(--cf-f8f7f4, #F8F7F4)",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              borderRadius: "9px",
              padding: "10px 12px",
              fontSize: "0.8rem",
              color: "var(--ct-1f1c19, #1F1C19)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span>
                  <strong>Vista Cliente:</strong> {resultadoSimulador.etiquetaResumen}
                </span>
                {(resultadoSimulador.zonasCoincidentes?.length ?? 0) > 1 && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "var(--cf-faf6ee, #FAF6EE)",
                      border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                      color: "var(--ct-745622, #745622)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    {resultadoSimulador.zonasCoincidentes!.length} áreas solapadas → menor tarifa
                    aplicada
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--ct-57524c, #57524C)" }}>
                <strong>Auditoría en Pedido de Tienda (oculto al cliente):</strong>{" "}
                {resultadoSimulador.formulaDetalle}
              </div>
              {resultadoSimulador.detalleDireccion && (
                <div
                  style={{
                    fontSize: "0.74rem",
                    color: "var(--ct-2f4737, #2F4737)",
                    marginTop: "2px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <strong>📍 Dirección detectada:</strong>
                  <span>{resultadoSimulador.detalleDireccion.resumenDireccion}</span>
                  {resultadoSimulador.detalleDireccion.sectorBarrio && (
                    <span style={{ color: "var(--ct-57524c, #57524C)" }}>
                      · <strong>Sector:</strong> {resultadoSimulador.detalleDireccion.sectorBarrio}
                    </span>
                  )}
                  {resultadoSimulador.detalleDireccion.parroquia && (
                    <span style={{ color: "var(--ct-57524c, #57524C)" }}>
                      · <strong>Parroquia:</strong> {resultadoSimulador.detalleDireccion.parroquia}
                    </span>
                  )}
                </div>
              )}
            </div>
            <strong
              style={{
                fontSize: "0.98rem",
                color: resultadoSimulador.costoTotalEnvio === 0 ? "var(--ct-2f4737, #2F4737)" : "var(--ct-1f1c19, #1F1C19)",
              }}
            >
              ${resultadoSimulador.costoTotalEnvio.toFixed(2)} USD
            </strong>
          </div>
        )}
      </div>

      {/* Mensajes de estado y Botón Guardar */}
      {mensajeError && (
        <div
          style={{
            background: "var(--cf-faf2f2, #FAF2F2)",
            border: "1px solid var(--cb-e5caca, #E5CACA)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "var(--ct-8a2e2e, #8A2E2E)",
          }}
        >
          {mensajeError}
        </div>
      )}

      {mensajeOk && (
        <div
          style={{
            background: "var(--cf-f2f6f3, #F2F6F3)",
            border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "var(--ct-2b4a36, #2B4A36)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{mensajeOk}</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={guardando}
          title="Guardar áreas de cobertura y tarifas de transporte"
          aria-label="Guardar Cambios"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "1px solid var(--cb-221e1b, #221E1B)",
            background: "#221E1B",
            color: "#FFFFFF",
            fontSize: "0.86rem",
            fontWeight: 700,
            cursor: guardando ? "wait" : "pointer",
          }}
        >
          {guardando ? <Loader2 size={16} /> : <Save size={16} />}
          <span>Guardar Cambios</span>
        </button>
      </div>
    </form>
  );
}
