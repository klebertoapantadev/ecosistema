"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Music,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Tv,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  extraerImagenesAlbumGoogleFotosAction,
  guardarConfigTvTallerAction,
  obtenerConfigTvTallerAction,
  reordenarPrioridadTallerAction,
} from "../acciones-operaciones-taller";
import {
  CONFIG_TV_TALLER_DEFECTO,
  ordenarPedidosPorPrioridadTaller,
  parsearColoresPedido,
  type AlbumGoogleFotosTv,
  type ConfiguracionTvTaller,
  type DensidadLayoutTv,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";

export interface PropsControlRemotoTvTaller {
  negocio: string;
  ordenesPendientes: OrdenTrabajoTaller[];
  abierto: boolean;
  onCerrar: () => void;
  onPrioridadActualizada?: () => void;
}

type TabControlTv = "prioridad" | "tv_taller" | "eventos";

export function ControlRemotoTvTaller({
  negocio,
  ordenesPendientes,
  abierto,
  onCerrar,
  onPrioridadActualizada,
}: PropsControlRemotoTvTaller) {
  const [tab, setTab] = useState<TabControlTv>("prioridad");
  const [config, setConfig] = useState<ConfiguracionTvTaller>(CONFIG_TV_TALLER_DEFECTO);
  const [cargandoCfg, setCargandoCfg] = useState<boolean>(false);
  const [guardandoCfg, setGuardandoCfg] = useState<boolean>(false);
  const [guardandoOrden, setGuardandoOrden] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiadoKiosco, setCopiadoKiosco] = useState<boolean>(false);

  // Nuevo álbum Google Fotos
  const [nuevoAlbTitulo, setNuevoAlbTitulo] = useState<string>("");
  const [nuevoAlbUrl, setNuevoAlbUrl] = useState<string>("");
  const [probandoAlbumId, setProbandoAlbumId] = useState<string | null>(null);
  const [resultadoPruebaAlbum, setResultadoPruebaAlbum] = useState<Record<string, string>>({});

  // Cola ordenable local de pendientes de taller
  const [colaLocal, setColaLocal] = useState<OrdenTrabajoTaller[]>([]);

  const pendientesOrdenados = useMemo(
    () =>
      ordenarPedidosPorPrioridadTaller(
        ordenesPendientes.filter(
          (o) => o.estadoTaller === "ENVIADO_TALLER" || o.estadoTaller === "EN_PREPARACION"
        )
      ),
    [ordenesPendientes]
  );

  useEffect(() => {
    setColaLocal(pendientesOrdenados);
  }, [pendientesOrdenados]);

  const cargarConfig = useCallback(async () => {
    setCargandoCfg(true);
    setError(null);
    const res = await obtenerConfigTvTallerAction(negocio);
    setCargandoCfg(false);
    if (res.ok) {
      setConfig(res.config);
    } else {
      setError(res.error);
    }
  }, [negocio]);

  useEffect(() => {
    if (abierto) {
      void cargarConfig();
      setMensaje(null);
      setError(null);
    }
  }, [abierto, cargarConfig]);

  if (!abierto) return null;

  const guardarCambiosConfig = async (
    parcial?: Partial<ConfiguracionTvTaller> & { regenerarToken?: boolean },
    msgExito = "Configuración enviada a la Smart TV."
  ) => {
    setGuardandoCfg(true);
    setError(null);
    setMensaje(null);
    const payload = parcial ? { ...config, ...parcial } : config;
    const res = await guardarConfigTvTallerAction({
      negocio,
      config: payload,
    });
    setGuardandoCfg(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfig(res.config);
    setMensaje(msgExito);
  };

  const moverEnCola = async (indice: number, destino: number) => {
    if (destino < 0 || destino >= colaLocal.length || indice === destino) return;
    const nueva = [...colaLocal];
    const [movido] = nueva.splice(indice, 1);
    if (!movido) return;
    nueva.splice(destino, 0, movido);
    setColaLocal(nueva);

    setGuardandoOrden(true);
    setError(null);
    const res = await reordenarPrioridadTallerAction({
      negocio,
      ordenIds: nueva.map((o) => o.id),
    });
    setGuardandoOrden(false);
    if (!res.ok) {
      setError(res.error);
      setColaLocal(pendientesOrdenados);
      return;
    }
    setMensaje(`Orden de elaboración actualizado (#1: ${nueva[0]?.codigo ?? ""}).`);
    onPrioridadActualizada?.();
  };

  const agregarAlbumGoogleFotos = () => {
    const url = nuevoAlbUrl.trim();
    if (!url) {
      setError("Pega la URL compartida del álbum de Google Fotos.");
      return;
    }
    const nuevo: AlbumGoogleFotosTv = {
      id: `alb-${Date.now()}`,
      titulo: nuevoAlbTitulo.trim() || `Álbum Eventos ${config.albumesGoogleFotos.length + 1}`,
      url,
    };
    setConfig((prev) => ({
      ...prev,
      albumesGoogleFotos: [...prev.albumesGoogleFotos, nuevo],
    }));
    setNuevoAlbTitulo("");
    setNuevoAlbUrl("");
    setError(null);
  };

  const eliminarAlbum = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      albumesGoogleFotos: prev.albumesGoogleFotos.filter((a) => a.id !== id),
    }));
  };

  const probarAlbum = async (album: AlbumGoogleFotosTv) => {
    setProbandoAlbumId(album.id);
    const res = await extraerImagenesAlbumGoogleFotosAction(album.url);
    setProbandoAlbumId(null);
    setResultadoPruebaAlbum((prev) => ({
      ...prev,
      [album.id]: res.ok
        ? `✓ ${res.imagenes.length} fotos HD detectadas`
        : `⚠ ${res.error}`,
    }));
  };

  const enlaceKiosco =
    typeof window !== "undefined" && config.tokenKiosco
      ? `${window.location.origin}/tv-taller?key=${encodeURIComponent(config.tokenKiosco)}`
      : "";

  const copiarEnlaceKiosco = async () => {
    if (!enlaceKiosco) return;
    try {
      await navigator.clipboard.writeText(enlaceKiosco);
      setCopiadoKiosco(true);
      setTimeout(() => setCopiadoKiosco(false), 2500);
    } catch {
      setError("No se pudo copiar automáticamente. Copia el enlace manualmente.");
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "5px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: "9px",
    border: "1px solid #CBD5E1",
    fontSize: "0.84rem",
    color: "#0F172A",
    background: "#FFFFFF",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "780px",
          maxHeight: "90vh",
          background: "#FFFFFF",
          borderRadius: "16px",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: "16px 20px",
            background: "#0F172A",
            color: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Tv size={22} color="#38BDF8" />
            <div>
              <h2 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700 }}>
                Control Remoto Smart TV Taller & Eventos
              </h2>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#94A3B8" }}>
                Los cambios se reflejan en vivo en la pantalla del taller.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href="/panel/taller/tv"
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir Pantalla TV en nueva pestaña"
              aria-label="Abrir Pantalla TV"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "8px",
                background: "#0284C7",
                color: "#FFFFFF",
                fontSize: "0.78rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <ExternalLink size={14} />
              Abrir TV
            </a>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar Control TV"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#F8FAFC",
                borderRadius: "8px",
                padding: "7px",
                cursor: "pointer",
                display: "inline-flex",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Selector rápido de Modo Activo en TV */}
        <div
          style={{
            padding: "12px 20px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
            Modo actual en la Smart TV:
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              disabled={guardandoCfg}
              onClick={() =>
                void guardarCambiosConfig(
                  { modoActivo: "TALLER" },
                  "Smart TV cambiada a Modo Producción Taller."
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "9px",
                border:
                  config.modoActivo === "TALLER" ? "2px solid #0F766E" : "1px solid #CBD5E1",
                background: config.modoActivo === "TALLER" ? "#CCFBF1" : "#FFFFFF",
                color: config.modoActivo === "TALLER" ? "#115E59" : "#475569",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Monitor size={15} />
              Modo Taller
            </button>
            <button
              type="button"
              disabled={guardandoCfg}
              onClick={() =>
                void guardarCambiosConfig(
                  { modoActivo: "EVENTOS" },
                  "Smart TV cambiada a Modo Showroom Eventos."
                )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "9px",
                border:
                  config.modoActivo === "EVENTOS" ? "2px solid #BE185D" : "1px solid #CBD5E1",
                background: config.modoActivo === "EVENTOS" ? "#FCE7F3" : "#FFFFFF",
                color: config.modoActivo === "EVENTOS" ? "#9D174D" : "#475569",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Sparkles size={15} />
              Modo Eventos
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #E2E8F0",
            padding: "0 20px",
            gap: "6px",
            background: "#FFFFFF",
          }}
        >
          {(
            [
              { id: "prioridad", label: `Prioridad Taller (${colaLocal.length})` },
              { id: "tv_taller", label: "YouTube y Layout TV" },
              { id: "eventos", label: `Showroom Eventos (${config.albumesGoogleFotos.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "11px 14px",
                border: "none",
                borderBottom: tab === t.id ? "2.5px solid #0284C7" : "2.5px solid transparent",
                background: "transparent",
                color: tab === t.id ? "#0369A1" : "#64748B",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "9px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "0.82rem",
                marginBottom: "14px",
              }}
            >
              {error}
            </div>
          )}
          {mensaje && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "9px",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontSize: "0.82rem",
                marginBottom: "14px",
              }}
            >
              {mensaje}
            </div>
          )}

          {cargandoCfg ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>
              <Loader2 size={22} /> Cargando configuración de TV...
            </div>
          ) : tab === "prioridad" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>
                  Define el orden exacto de elaboración (<strong>#1, #2, #3...</strong>). La TV
                  reflejará este orden al instante.
                </p>
                {guardandoOrden && (
                  <span style={{ fontSize: "0.78rem", color: "#0284C7", fontWeight: 700 }}>
                    Guardando...
                  </span>
                )}
              </div>

              {colaLocal.length === 0 ? (
                <div
                  style={{
                    padding: "28px",
                    textAlign: "center",
                    borderRadius: "12px",
                    border: "1px dashed #CBD5E1",
                    color: "#64748B",
                    fontSize: "0.85rem",
                  }}
                >
                  No hay pedidos pendientes en taller en este momento.
                </div>
              ) : (
                colaLocal.map((o, idx) => {
                  const colores = parsearColoresPedido(o.colores);
                  return (
                    <div
                      key={o.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "11px",
                        border: idx === 0 ? "1.5px solid #F59E0B" : "1px solid #E2E8F0",
                        background: idx === 0 ? "#FFFBEB" : "#FFFFFF",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div
                          style={{
                            minWidth: "34px",
                            height: "34px",
                            borderRadius: "9px",
                            background: idx === 0 ? "#D97706" : "#0F172A",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "0.9rem",
                          }}
                        >
                          #{idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              color: "#0F172A",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>{o.codigo}</span>
                            <span style={{ color: "#64748B", fontWeight: 500 }}>·</span>
                            <span>{o.productoResumen}</span>
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#475569",
                              marginTop: "2px",
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <span>
                              🕒 {o.horaEspecifica || o.franjaHoraria || "Horario estándar"}
                            </span>
                            {colores.length > 0 && (
                              <span>🎨 {colores.map((c) => c.etiqueta).join(", ")}</span>
                            )}
                            {o.extras && <span>🎁 {o.extras}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        {idx > 0 && (
                          <button
                            type="button"
                            disabled={guardandoOrden}
                            onClick={() => void moverEnCola(idx, 0)}
                            title="Poner como Prioridad #1 (Urgente)"
                            aria-label="Prioridad #1"
                            style={{
                              padding: "6px 8px",
                              borderRadius: "7px",
                              border: "1px solid #F59E0B",
                              background: "#FEF3C7",
                              color: "#92400E",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Zap size={13} /> #1
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={guardandoOrden || idx === 0}
                          onClick={() => void moverEnCola(idx, idx - 1)}
                          title="Subir prioridad"
                          aria-label="Subir"
                          style={{
                            padding: "6px",
                            borderRadius: "7px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: idx === 0 ? "#CBD5E1" : "#334155",
                            cursor: idx === 0 ? "not-allowed" : "pointer",
                            display: "inline-flex",
                          }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={guardandoOrden || idx === colaLocal.length - 1}
                          onClick={() => void moverEnCola(idx, idx + 1)}
                          title="Bajar prioridad"
                          aria-label="Bajar"
                          style={{
                            padding: "6px",
                            borderRadius: "7px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: idx === colaLocal.length - 1 ? "#CBD5E1" : "#334155",
                            cursor: idx === colaLocal.length - 1 ? "not-allowed" : "pointer",
                            display: "inline-flex",
                          }}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : tab === "tv_taller" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>
                  URL de YouTube o Playlist para Taller (video + música)
                </label>
                <input
                  type="url"
                  value={config.youtubeUrlTaller}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, youtubeUrlTaller: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=... o playlist?list=..."
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Posición de Pedidos Pendientes</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(["izquierda", "derecha"] as const).map((lado) => (
                      <button
                        key={lado}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({ ...prev, posicionLateral: lado }))
                        }
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "8px",
                          border:
                            config.posicionLateral === lado
                              ? "2px solid #0284C7"
                              : "1px solid #CBD5E1",
                          background: config.posicionLateral === lado ? "#E0F2FE" : "#FFFFFF",
                          color: config.posicionLateral === lado ? "#0369A1" : "#334155",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {lado}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Densidad / Espacio de YouTube</label>
                  <select
                    value={config.densidadLayout}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        densidadLayout: e.target.value as DensidadLayoutTv,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="AUTO">Automático (Elástico según pedidos)</option>
                    <option value="NORMAL">Normal (70% YouTube / 1 col.)</option>
                    <option value="PICO">Día Pico (50% YouTube / 2 cols.)</option>
                    <option value="SOLO_AUDIO">Fecha Especial (Solo audio / 100% Grid)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>
                    Volumen YouTube ({config.volumenYoutube}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={config.volumenYoutube}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        volumenYoutube: Number(e.target.value),
                      }))
                    }
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Auto-ocultar entregados tras (minutos)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={config.ocultarEntregadosMinutos}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        ocultarEntregadosMinutos: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "0.82rem",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.mostrarFranjaListos}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        mostrarFranjaListos: e.target.checked,
                      }))
                    }
                  />
                  Mostrar franja inferior de Pedidos Listos
                </label>

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "0.82rem",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.sonidoAlertas}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, sonidoAlertas: e.target.checked }))
                    }
                  />
                  {config.sonidoAlertas ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  Campana y atenuación de YouTube al llegar pedido
                </label>
              </div>

              {/* Sección Kiosco sin login */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "11px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <strong style={{ fontSize: "0.83rem", color: "#0F172A" }}>
                    Enlace Kiosco Smart TV (opcional, sin iniciar sesión)
                  </strong>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <label style={{ fontSize: "0.78rem", display: "flex", gap: "5px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={config.kioscoActivo}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, kioscoActivo: e.target.checked }))
                        }
                      />
                      Activo
                    </label>
                    <label style={{ fontSize: "0.78rem", display: "flex", gap: "5px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={config.permitirCambiarEstadoKiosco}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            permitirCambiarEstadoKiosco: e.target.checked,
                          }))
                        }
                      />
                      Permitir marcar Listo con control TV
                    </label>
                  </div>
                </div>

                {enlaceKiosco ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      readOnly
                      value={enlaceKiosco}
                      style={{ ...inputStyle, flex: 1, minWidth: "220px", fontSize: "0.76rem", background: "#FFFFFF" }}
                    />
                    <button
                      type="button"
                      onClick={() => void copiarEnlaceKiosco()}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      {copiadoKiosco ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                      {copiadoKiosco ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      disabled={guardandoCfg}
                      onClick={() =>
                        void guardarCambiosConfig(
                          { regenerarToken: true },
                          "Nuevo enlace Kiosco generado (el anterior fue revocado)."
                        )
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #FCA5A5",
                        background: "#FEF2F2",
                        color: "#991B1B",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <RefreshCw size={14} />
                      Rotar Enlace
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748B" }}>
                    Haz clic en &quot;Guardar Cambios&quot; para generar automáticamente el enlace
                    Kiosco revocable para la Smart TV.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>
                  <Music size={14} style={{ verticalAlign: "middle", marginRight: "5px" }} />
                  URL de YouTube Solo Audio Ambiental (para visitas de clientes de Eventos)
                </label>
                <input
                  type="url"
                  value={config.youtubeUrlEventosAudio}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, youtubeUrlEventosAudio: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=... (música instrumental / piano / jazz)"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "center" }}>
                <div>
                  <label style={labelStyle}>Segundos por diapositiva</label>
                  <input
                    type="number"
                    min={4}
                    max={60}
                    value={config.segundosSlideEventos}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        segundosSlideEventos: Math.max(4, Math.min(60, Number(e.target.value) || 10)),
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginTop: "18px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.mostrarPreciosEventos}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        mostrarPreciosEventos: e.target.checked,
                      }))
                    }
                  />
                  Mostrar precios referenciales en la TV
                </label>
              </div>

              {/* Álbumes de Google Fotos */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <ImageIcon size={16} color="#BE185D" />
                  <strong style={{ fontSize: "0.85rem", color: "#0F172A" }}>
                    Álbumes de Google Fotos (Presentación + QR compartible)
                  </strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: "8px" }}>
                  <input
                    type="text"
                    value={nuevoAlbTitulo}
                    onChange={(e) => setNuevoAlbTitulo(e.target.value)}
                    placeholder="Ej. Bodas 2026"
                    style={inputStyle}
                  />
                  <input
                    type="url"
                    value={nuevoAlbUrl}
                    onChange={(e) => setNuevoAlbUrl(e.target.value)}
                    placeholder="https://photos.app.goo.gl/..."
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={agregarAlbumGoogleFotos}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "9px",
                      border: "none",
                      background: "#BE185D",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Plus size={15} />
                    Agregar
                  </button>
                </div>

                {config.albumesGoogleFotos.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748B" }}>
                    Aún no has agregado álbumes de Google Fotos. El Showroom mostrará los productos
                    de Eventos de tu catálogo automáticamente.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {config.albumesGoogleFotos.map((alb) => (
                      <div
                        key={alb.id}
                        style={{
                          padding: "9px 11px",
                          borderRadius: "9px",
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#0F172A" }}>
                            {alb.titulo}
                          </div>
                          <div
                            style={{
                              fontSize: "0.73rem",
                              color: "#64748B",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {alb.url}
                          </div>
                          {resultadoPruebaAlbum[alb.id] && (
                            <div
                              style={{
                                fontSize: "0.73rem",
                                fontWeight: 600,
                                marginTop: "3px",
                                color: resultadoPruebaAlbum[alb.id]?.startsWith("✓")
                                  ? "#047857"
                                  : "#B45309",
                              }}
                            >
                              {resultadoPruebaAlbum[alb.id]}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            disabled={probandoAlbumId === alb.id}
                            onClick={() => void probarAlbum(alb)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "7px",
                              border: "1px solid #CBD5E1",
                              background: "#F8FAFC",
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {probandoAlbumId === alb.id ? "Probando..." : "Probar"}
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Mira nuestro portafolio "${alb.titulo}": ${alb.url}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Compartir álbum por WhatsApp"
                            style={{
                              padding: "6px 9px",
                              borderRadius: "7px",
                              border: "1px solid #86EFAC",
                              background: "#DCFCE7",
                              color: "#166534",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Share2 size={13} /> WA
                          </a>
                          <button
                            type="button"
                            onClick={() => eliminarAlbum(alb.id)}
                            aria-label="Eliminar álbum"
                            style={{
                              padding: "6px",
                              borderRadius: "7px",
                              border: "1px solid #FECACA",
                              background: "#FEF2F2",
                              color: "#DC2626",
                              cursor: "pointer",
                              display: "inline-flex",
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        {tab !== "prioridad" && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={onCerrar}
              style={{
                padding: "9px 14px",
                borderRadius: "9px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={guardandoCfg}
              onClick={() => void guardarCambiosConfig()}
              style={{
                padding: "9px 16px",
                borderRadius: "9px",
                border: "none",
                background: "#0284C7",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {guardandoCfg ? <Loader2 size={15} /> : <Save size={15} />}
              Guardar Cambios
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
