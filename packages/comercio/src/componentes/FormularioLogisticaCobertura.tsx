"use client";

import React, { useState, useTransition } from "react";
import {
  CheckCircle2,
  Link2,
  Loader2,
  MapPin,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import {
  crearConfiguracionLogisticaPorDefecto,
  ZONAS_PICHINCHA_POR_DEFECTO,
  type ConfiguracionLogisticaNegocio,
  type CoordenadaGeo,
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

const estiloInput: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  borderRadius: "8px",
  border: "1px solid #D4D4D8",
  fontSize: "0.84rem",
  color: "#18181B",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

const estiloLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#3F3F46",
  marginBottom: "4px",
};

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

  // Estado de edición/dibujo de polígonos en el mapa
  const [zonaResaltadaId, setZonaResaltadaId] = useState<string | null>(
    form.zonas[0]?.id ?? null
  );
  const [zonaDibujandoId, setZonaDibujandoId] = useState<string | null>(null);
  const [verticesBorrador, setVerticesBorrador] = useState<[number, number][]>([]);

  // Simulador en vivo
  const [enlaceSimulador, setEnlaceSimulador] = useState("");
  const [puntoSimulador, setPuntoSimulador] = useState<CoordenadaGeo | null>(null);
  const [resultadoSimulador, setResultadoSimulador] = useState<ResultadoCotizacionEnvio | null>(
    null
  );
  const [simulando, setSimulando] = useState(false);

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
        setMensajeOk(`Coordenadas del taller actualizadas (${res.lat.toFixed(6)}, ${res.lng.toFixed(6)}).`);
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

  function agregarNuevaZona() {
    const num = form.zonas.length + 1;
    const nuevaId = `zon-custom-${Date.now()}`;
    const nueva: ZonaCoberturaLogistica = {
      id: nuevaId,
      codigo: `zona_personalizada_${num}`,
      nombre: `Nueva Zona Pichincha ${num}`,
      provincia: "Pichincha",
      modoCobro: "TARIFA_FIJA",
      tarifaFija: 5.0,
      prioridad: num,
      activo: true,
      color: "#0EA5E9",
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
  }

  function eliminarZona(id: string) {
    if (form.zonas.length <= 1) {
      setMensajeError("Debe mantenerse al menos una zona de cobertura activa.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      zonas: prev.zonas.filter((z) => z.id !== id),
    }));
    if (zonaDibujandoId === id) {
      setZonaDibujandoId(null);
      setVerticesBorrador([]);
    }
  }

  function aplicarPoligonoDibujado() {
    if (!zonaDibujandoId || verticesBorrador.length < 3) {
      setMensajeError("Haz al menos 3 clics en el mapa para cerrar el polígono de la zona.");
      return;
    }
    actualizarZona(zonaDibujandoId, { poligono: verticesBorrador });
    setZonaDibujandoId(null);
    setVerticesBorrador([]);
    setMensajeOk("Polígono actualizado en el borrador. Pulsa «Guardar Cambios» para publicarlo.");
  }

  function restaurarZonasPichincha() {
    setForm((prev) => ({
      ...prev,
      zonaGratisNombre: "Centro-Norte de Quito",
      zonas: ZONAS_PICHINCHA_POR_DEFECTO.map((z) => ({
        ...z,
        sectoresReferencia: [...z.sectoresReferencia],
        poligono: z.poligono.map(([lat, lng]) => [lat, lng]),
      })),
    }));
    setMensajeOk("Zonas base de Pichincha restauradas en pantalla.");
  }

  async function simularPuntoOEnlace(puntoDirecto?: CoordenadaGeo) {
    setSimulando(true);
    setMensajeError(null);
    try {
      let destino = puntoDirecto ?? null;
      if (!destino && enlaceSimulador.trim()) {
        const res = await cotizarEnvioDesdeEntradaAction({
          negocio,
          enlaceOTexto: enlaceSimulador.trim(),
        });
        if (!res.ok) {
          setMensajeError(res.error);
          return;
        }
        destino = res.cotizacion.destino;
      }

      if (!destino) {
        setMensajeError("Haz clic en cualquier punto del mapa o pega un enlace de Google Maps / Waze.");
        return;
      }

      setPuntoSimulador(destino);
      // Evaluar con los valores EN PANTALLA (incluso antes de guardar) pero usando distancia vial OSRM real
      const resVial = await cotizarEnvioDesdeEntradaAction({
        negocio,
        lat: destino.lat,
        lng: destino.lng,
      });

      const vialKm = resVial.ok ? resVial.cotizacion.distanciaVialKm : undefined;
      const geom = resVial.ok ? resVial.cotizacion.rutaGeometria : undefined;
      const { cotizarEnvioDomicilio } = await import("../logistica");
      const cotLocal = cotizarEnvioDomicilio({
        config: form,
        destino,
        distanciaVialKm: vialKm,
        fuenteDistancia: resVial.ok ? resVial.cotizacion.fuenteDistancia : "ESTIMACION_VIAL",
        rutaGeometria: geom,
      });

      setResultadoSimulador(cotLocal);
      if (cotLocal.zonaDetectada?.id) {
        setZonaResaltadaId(cotLocal.zonaDetectada.id);
      }
    } finally {
      setSimulando(false);
    }
  }

  function manejarGuardar(e: React.FormEvent) {
    e.preventDefault();
    setMensajeOk(null);
    setMensajeError(null);

    iniciarGuardado(async () => {
      const res = await guardarConfiguracionLogisticaAction(negocio, form);
      if (!res.ok) {
        setMensajeError(res.error);
        return;
      }
      setMensajeOk("Configuración de logística, zonas de Pichincha y tarifas guardada correctamente.");
    });
  }

  return (
    <form onSubmit={manejarGuardar} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Bloque 1: Taller / Punto de Origen */}
      <div
        style={{
          background: "#FAFAFA",
          border: "1px solid #E4E4E7",
          borderRadius: "12px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={17} color="#18181B" />
            <strong style={{ fontSize: "0.92rem", color: "#18181B" }}>
              1. Punto de Partida (Taller / Tienda Física)
            </strong>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#3F3F46", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.permitirRetiroLocal}
              onChange={(e) => setForm({ ...form, permitirRetiroLocal: e.target.checked })}
            />
            <span>Habilitar Retiro Gratis en Tienda ($0.00)</span>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "10px", alignItems: "end" }}>
          <div>
            <label style={estiloLabel}>Enlace Oficial de Google Maps / Waze del Taller</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={form.origenMapaUrl}
                onChange={(e) => setForm({ ...form, origenMapaUrl: e.target.value })}
                placeholder="https://maps.app.goo.gl/..."
                style={estiloInput}
              />
              <button
                type="button"
                disabled={resolviendoTaller}
                onClick={() => void extraerCoordenadasTaller()}
                title="Extraer latitud y longitud automáticamente desde el enlace"
                aria-label="Extraer coordenadas del enlace"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #D4D4D8",
                  background: "#FFFFFF",
                  color: "#18181B",
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

          <div>
            <label style={estiloLabel}>Latitud Taller</label>
            <input
              type="number"
              step="0.0000001"
              value={form.origenLat}
              onChange={(e) => setForm({ ...form, origenLat: Number(e.target.value) })}
              style={estiloInput}
            />
          </div>

          <div>
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
          background: "#FFFFFF",
          border: "1px solid #E4E4E7",
          borderRadius: "12px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Truck size={17} color="#16A34A" />
          <strong style={{ fontSize: "0.92rem", color: "#18181B" }}>
            2. Zona Envío Gratis por Defecto y Fórmula por Kilómetro
          </strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
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

        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "9px",
            padding: "10px 12px",
            fontSize: "0.78rem",
            color: "#166534",
            lineHeight: 1.45,
          }}
        >
          <strong>Fórmula activa fuera de «{form.zonaGratisNombre}»:</strong>{" "}
          <code>
            Máx(${form.recargoMinimoExtra.toFixed(2)}, (Distancia vial desde taller × $
            {form.tarifaPorKm.toFixed(2)}/km) − ${form.subsidioBaseUsd.toFixed(2)})
          </code>
          . Si una zona de Pichincha está en modo <strong>Tarifa Fija</strong>, se cobra el valor fijo de esa zona.
        </div>
      </div>

      {/* Bloque 3: Mapa Interactivo de Zonas en Pichincha + Simulador */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4E4E7",
          borderRadius: "12px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <strong style={{ fontSize: "0.92rem", color: "#18181B" }}>
              3. Zonas de Cobertura en Pichincha y Simulador GPS
            </strong>
            <div style={{ fontSize: "0.76rem", color: "#71717A" }}>
              Haz clic en el mapa o pega un enlace de Google Maps / Waze para probar el cálculo exacto en vivo.
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={agregarNuevaZona}
              title="Crear una nueva zona geográfica en Pichincha"
              aria-label="Nueva Zona"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 12px",
                borderRadius: "8px",
                border: "1px solid #18181B",
                background: "#18181B",
                color: "#FFFFFF",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              <span>Nueva Zona</span>
            </button>

            <button
              type="button"
              onClick={restaurarZonasPichincha}
              title="Restaurar los polígonos sugeridos de Quito y Valles"
              aria-label="Zonas Base"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 11px",
                borderRadius: "8px",
                border: "1px solid #D4D4D8",
                background: "#FFFFFF",
                color: "#3F3F46",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Zonas Base</span>
            </button>
          </div>
        </div>

        {/* Barra del Simulador Rápido */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={enlaceSimulador}
            onChange={(e) => setEnlaceSimulador(e.target.value)}
            placeholder="Simulador: pega un link de Google Maps, Apple Maps o Waze para probar tarifa..."
            style={{ ...estiloInput, flex: "1 1 280px" }}
          />
          <button
            type="button"
            disabled={simulando}
            onClick={() => void simularPuntoOEnlace()}
            title="Probar cotización con las reglas actuales"
            aria-label="Simular Envío"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "0 14px",
              borderRadius: "8px",
              border: "1px solid #16A34A",
              background: "#16A34A",
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

        {zonaDibujandoId && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "9px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "0.78rem",
              color: "#991B1B",
            }}
          >
            <span>
              ✏️ <strong>Modo dibujo activo:</strong> haz clic en el mapa marcando las esquinas de la zona ({verticesBorrador.length} vértices marcados).
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={aplicarPoligonoDibujado}
                title="Aplicar los vértices marcados a la zona"
                aria-label="Aplicar Polígono"
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Aplicar Polígono
              </button>
              <button
                type="button"
                onClick={() => {
                  setZonaDibujandoId(null);
                  setVerticesBorrador([]);
                }}
                title="Cancelar dibujo de polígono"
                aria-label="Cancelar"
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #FCA5A5",
                  background: "#FFFFFF",
                  color: "#991B1B",
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

        <MapaCoberturaPichincha
          origen={{ lat: form.origenLat, lng: form.origenLng }}
          origenNombre={form.origenNombre}
          destino={puntoSimulador}
          zonas={form.zonas}
          zonaResaltadaId={zonaResaltadaId}
          rutaGeometria={resultadoSimulador?.rutaGeometria}
          alturaPx={340}
          modoDibujoPoligono={Boolean(zonaDibujandoId)}
          verticesDibujo={verticesBorrador}
          onSeleccionarPunto={(pt) => {
            void simularPuntoOEnlace(pt);
          }}
          onAgregarVerticePoligono={(pt) => {
            setVerticesBorrador((prev) => [...prev, [pt.lat, pt.lng]]);
          }}
        />

        {resultadoSimulador && (
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: "9px",
              padding: "10px 12px",
              fontSize: "0.8rem",
              color: "#0F172A",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <strong>Resultado Simulación:</strong> {resultadoSimulador.etiquetaResumen}
              <div style={{ fontSize: "0.73rem", color: "#475569" }}>
                {resultadoSimulador.formulaDetalle}
              </div>
            </div>
            <strong style={{ fontSize: "0.95rem", color: resultadoSimulador.costoTotalEnvio === 0 ? "#16A34A" : "#0F172A" }}>
              ${resultadoSimulador.costoTotalEnvio.toFixed(2)} USD
            </strong>
          </div>
        )}

        {/* Tabla / Tarjetas de Zonas Configurables */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
          {form.zonas.map((z) => {
            const seleccionada = zonaResaltadaId === z.id;
            return (
              <div
                key={z.id}
                onClick={() => setZonaResaltadaId(z.id)}
                style={{
                  border: seleccionada ? `1.5px solid ${z.color || "#18181B"}` : "1px solid #E4E4E7",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  background: z.activo ? "#FFFFFF" : "#FAFAFA",
                  opacity: z.activo ? 1 : 0.65,
                  display: "grid",
                  gridTemplateColumns: "auto 1.5fr 1fr 110px auto",
                  gap: "10px",
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={z.activo}
                  title="Activar o desactivar esta zona"
                  onChange={(e) => actualizarZona(z.id, { activo: e.target.checked })}
                />

                <div>
                  <input
                    type="text"
                    value={z.nombre}
                    onChange={(e) => actualizarZona(z.id, { nombre: e.target.value })}
                    style={{
                      ...estiloInput,
                      padding: "5px 8px",
                      fontWeight: 700,
                      fontSize: "0.81rem",
                    }}
                  />
                  {z.sectoresReferencia.length > 0 && (
                    <div style={{ fontSize: "0.69rem", color: "#71717A", marginTop: "3px" }}>
                      {z.sectoresReferencia.join(" · ")}
                    </div>
                  )}
                </div>

                <select
                  value={z.modoCobro}
                  onChange={(e) =>
                    actualizarZona(z.id, { modoCobro: e.target.value as ModoCobroZona })
                  }
                  style={{ ...estiloInput, padding: "6px 8px", fontSize: "0.78rem", fontWeight: 600 }}
                >
                  <option value="GRATIS">🟢 Envío Gratis ($0)</option>
                  <option value="TARIFA_FIJA">🏷️ Tarifa Fija Zona</option>
                  <option value="POR_KM">📏 Cálculo por Km</option>
                </select>

                <div>
                  {z.modoCobro === "TARIFA_FIJA" ? (
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={z.tarifaFija}
                      onChange={(e) =>
                        actualizarZona(z.id, { tarifaFija: Number(e.target.value) })
                      }
                      style={{ ...estiloInput, padding: "5px 8px", fontSize: "0.8rem", fontWeight: 700 }}
                    />
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: z.modoCobro === "GRATIS" ? "#16A34A" : "#52525B",
                      }}
                    >
                      {z.modoCobro === "GRATIS" ? "$0.00" : `$${form.tarifaPorKm.toFixed(2)}/km`}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "5px" }}>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setZonaDibujandoId(z.id);
                      setVerticesBorrador([]);
                    }}
                    title="Redibujar límites de esta zona sobre el mapa"
                    aria-label="Editar Polígono"
                    style={{
                      padding: "6px 8px",
                      borderRadius: "7px",
                      border: "1px solid #D4D4D8",
                      background: "#FFFFFF",
                      color: "#27272A",
                      cursor: "pointer",
                    }}
                  >
                    <PenTool size={13} />
                  </button>

                  {z.codigo !== "centro_norte_quito" && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        eliminarZona(z.id);
                      }}
                      title="Eliminar zona"
                      aria-label="Eliminar Zona"
                      style={{
                        padding: "6px 8px",
                        borderRadius: "7px",
                        border: "1px solid #FECACA",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mensajes de estado y Botón Guardar */}
      {mensajeError && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#B91C1C",
          }}
        >
          {mensajeError}
        </div>
      )}

      {mensajeOk && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "#166534",
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
          title="Guardar zonas de cobertura y tarifas de transporte"
          aria-label="Guardar Cambios"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "1px solid #18181B",
            background: "#18181B",
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

