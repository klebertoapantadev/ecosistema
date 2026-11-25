"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Maximize2,
  RefreshCw,
  Search,
  Store,
  Truck,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  crearConfiguracionLogisticaPorDefecto,
  type ConfiguracionLogisticaNegocio,
  type CoordenadaGeo,
  type DetalleDireccionGeoespacial,
  type ResultadoCotizacionEnvio,
  type SugerenciaDireccionMapa,
} from "../logistica";
import {
  buscarDireccionesMapaAction,
  cotizarEnvioDesdeEntradaAction,
  obtenerConfiguracionLogisticaAction,
  obtenerEstadoRegaloPrimeraCompraAction,
} from "../acciones-logistica";
import { MapaCoberturaPichincha } from "./MapaCoberturaPichincha";

export interface EventoCotizacionUbicacion {
  cotizacion: ResultadoCotizacionEnvio;
  enlaceMapa: string;
  direccionSugerida?: string;
  detalleDireccionGeo?: DetalleDireccionGeoespacial | null;
  retiroEnLocal: boolean;
}

export interface PropsSelectorUbicacionEntrega {
  negocio: string;
  configuracionInicial?: ConfiguracionLogisticaNegocio | null;
  deliveryIncluidoProducto?: boolean;
  recargoLogisticoProducto?: number;
  permitirModoRetiro?: boolean;
  retiroEnLocal?: boolean;
  enlaceMapaInicial?: string;
  coordenadasIniciales?: CoordenadaGeo | null;
  cotizacionInicial?: ResultadoCotizacionEnvio | null;
  mostrarMapaPorDefecto?: boolean;
  /** Si se indica explícitamente, define si el comprador tiene cuenta registrada activa en el negocio */
  clienteRegistrado?: boolean;
  /** Si es true (o si el usuario autenticado es Operador/Admin/Ventas), muestra el detalle interno de ruta (KM reales, costo delivery, fórmula y ubicación) */
  mostrarDetalleRutaStaff?: boolean;
  onCambioCotizacion: (evento: EventoCotizacionUbicacion) => void;
}

export function SelectorUbicacionEntrega({
  negocio,
  configuracionInicial,
  deliveryIncluidoProducto = true,
  recargoLogisticoProducto = 0,
  permitirModoRetiro = true,
  retiroEnLocal: retiroInicial = false,
  enlaceMapaInicial = "",
  coordenadasIniciales = null,
  cotizacionInicial = null,
  mostrarMapaPorDefecto = false,
  clienteRegistrado,
  mostrarDetalleRutaStaff,
  onCambioCotizacion,
}: PropsSelectorUbicacionEntrega) {
  const [config, setConfig] = useState<ConfiguracionLogisticaNegocio>(
    () => configuracionInicial ?? crearConfiguracionLogisticaPorDefecto(negocio)
  );
  const [registradoDetectado, setRegistradoDetectado] = useState<boolean>(
    typeof clienteRegistrado === "boolean" ? clienteRegistrado : false
  );
  const [esStaffDetectado, setEsStaffDetectado] = useState<boolean>(
    typeof mostrarDetalleRutaStaff === "boolean" ? mostrarDetalleRutaStaff : false
  );
  const [verificandoRegistro, setVerificandoRegistro] = useState<boolean>(
    typeof clienteRegistrado !== "boolean"
  );
  const recienEnfocadoUrlRef = useRef<boolean>(false);
  const [retiroLocal, setRetiroLocal] = useState<boolean>(retiroInicial);
  const [enlaceTexto, setEnlaceTexto] = useState<string>(enlaceMapaInicial);
  const [coordenadas, setCoordenadas] = useState<CoordenadaGeo | null>(coordenadasIniciales);
  const [cotizacion, setCotizacion] = useState<ResultadoCotizacionEnvio | null>(cotizacionInicial);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(mostrarMapaPorDefecto);
  const [mapaAmpliadoAbierto, setMapaAmpliadoAbierto] = useState<boolean>(false);
  const [secuenciaCentrarDestino, setSecuenciaCentrarDestino] = useState<number>(0);

  const [consultaMapa, setConsultaMapa] = useState<string>("");
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccionMapa[]>([]);
  const [buscandoSugerencias, setBuscandoSugerencias] = useState<boolean>(false);

  const [calculando, setCalculando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (configuracionInicial) {
      setConfig(configuracionInicial);
      return;
    }
    let activo = true;
    obtenerConfiguracionLogisticaAction(negocio)
      .then((cfg) => {
        if (activo && cfg) setConfig(cfg);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [negocio, configuracionInicial]);

  useEffect(() => {
    const necesitaRegistro = typeof clienteRegistrado !== "boolean";
    const necesitaStaff = typeof mostrarDetalleRutaStaff !== "boolean";
    if (!necesitaRegistro) {
      setRegistradoDetectado(clienteRegistrado);
      setVerificandoRegistro(false);
    }
    if (!necesitaStaff) {
      setEsStaffDetectado(mostrarDetalleRutaStaff);
    }
    if (!necesitaRegistro && !necesitaStaff) {
      return;
    }
    let activo = true;
    if (necesitaRegistro) setVerificandoRegistro(true);
    obtenerEstadoRegaloPrimeraCompraAction(negocio)
      .then((res) => {
        if (!activo) return;
        if (necesitaRegistro) setRegistradoDetectado(Boolean(res.autenticado));
        if (necesitaStaff) setEsStaffDetectado(Boolean(res.esStaffNegocio));
      })
      .catch(() => {})
      .finally(() => {
        if (activo && necesitaRegistro) setVerificandoRegistro(false);
      });
    return () => {
      activo = false;
    };
  }, [negocio, clienteRegistrado, mostrarDetalleRutaStaff]);

  const esClienteRegistradoEfectivo =
    typeof clienteRegistrado === "boolean" ? clienteRegistrado : registradoDetectado;
  const esStaffRutaEfectivo =
    typeof mostrarDetalleRutaStaff === "boolean" ? mostrarDetalleRutaStaff : esStaffDetectado;

  // Recalcular si cambian condiciones de los ítems o el estado de registro del cliente
  useEffect(() => {
    if (retiroLocal || verificandoRegistro) return;
    if (coordenadas) {
      void ejecutarCotizacionPorCoordenadas(coordenadas, enlaceTexto, undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryIncluidoProducto, recargoLogisticoProducto, esClienteRegistradoEfectivo, verificandoRegistro]);

  async function ejecutarCotizacionPorCoordenadas(
    punto: CoordenadaGeo,
    enlacePreferido?: string,
    direccionSugerida?: string,
    silencioso = false
  ) {
    if (!silencioso) setCalculando(true);
    setErrorMsg(null);
    setCoordenadas(punto);

    try {
      const res = await cotizarEnvioDesdeEntradaAction({
        negocio,
        lat: punto.lat,
        lng: punto.lng,
        deliveryIncluidoProducto,
        recargoLogisticoProducto,
        retiroEnLocal: false,
        clienteRegistrado: esClienteRegistradoEfectivo,
      });

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      const urlMaps =
        enlacePreferido && /^https?:\/\//i.test(enlacePreferido.trim())
          ? enlacePreferido.trim()
          : res.cotizacion.urlGoogleMapsDestino;

      setEnlaceTexto(urlMaps);
      setCotizacion(res.cotizacion);
      onCambioCotizacion({
        cotizacion: res.cotizacion,
        enlaceMapa: urlMaps,
        direccionSugerida:
          direccionSugerida ||
          res.direccionDetectada ||
          res.cotizacion.detalleDireccion?.resumenDireccion,
        detalleDireccionGeo: res.cotizacion.detalleDireccion ?? null,
        retiroEnLocal: false,
      });
    } catch {
      setErrorMsg("No fue posible calcular la distancia en este momento. Intenta nuevamente.");
    } finally {
      if (!silencioso) setCalculando(false);
    }
  }

  async function manejarResolverEnlace(textoManual?: string) {
    const valor = (textoManual ?? enlaceTexto).trim();
    if (!valor) {
      setErrorMsg("Pega un enlace de Google Maps, Apple Maps o Waze, o elige el punto en el mapa.");
      return;
    }

    setCalculando(true);
    setErrorMsg(null);

    try {
      const res = await cotizarEnvioDesdeEntradaAction({
        negocio,
        enlaceOTexto: valor,
        deliveryIncluidoProducto,
        recargoLogisticoProducto,
        retiroEnLocal: false,
        clienteRegistrado: esClienteRegistradoEfectivo,
      });

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setCoordenadas(res.cotizacion.destino);
      setSecuenciaCentrarDestino((n) => n + 1);
      setCotizacion(res.cotizacion);
      const urlFinal = /^https?:\/\//i.test(valor)
        ? valor
        : res.cotizacion.urlGoogleMapsDestino;
      setEnlaceTexto(urlFinal);

      onCambioCotizacion({
        cotizacion: res.cotizacion,
        enlaceMapa: urlFinal,
        direccionSugerida:
          res.direccionDetectada || res.cotizacion.detalleDireccion?.resumenDireccion,
        detalleDireccionGeo: res.cotizacion.detalleDireccion ?? null,
        retiroEnLocal: false,
      });
    } catch {
      setErrorMsg("Error al verificar el enlace de ubicación.");
    } finally {
      setCalculando(false);
    }
  }

  async function cambiarModoEntrega(esRetiro: boolean) {
    setRetiroLocal(esRetiro);
    setErrorMsg(null);

    if (esRetiro) {
      const res = await cotizarEnvioDesdeEntradaAction({
        negocio,
        retiroEnLocal: true,
      });
      if (res.ok) {
        setCotizacion(res.cotizacion);
        onCambioCotizacion({
          cotizacion: res.cotizacion,
          enlaceMapa: config.origenMapaUrl || res.cotizacion.urlGoogleMapsDestino,
          direccionSugerida: `Retiro en ${config.origenNombre}`,
          retiroEnLocal: true,
        });
      }
    } else if (coordenadas) {
      void ejecutarCotizacionPorCoordenadas(coordenadas, enlaceTexto);
    } else {
      setCotizacion(null);
    }
  }

  async function manejarBuscarEnMapa(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = consultaMapa.trim();
    if (q.length < 3) return;
    setBuscandoSugerencias(true);
    setErrorMsg(null);
    try {
      const lista = await buscarDireccionesMapaAction(q);
      setSugerencias(lista);
      if (lista.length === 0) {
        setErrorMsg("Sin coincidencias en Pichincha. Prueba con barrio o calle principal, o mueve el pin rojo.");
      }
    } finally {
      setBuscandoSugerencias(false);
    }
  }

  function usarMiUbicacionGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMsg("Tu navegador no permite geolocalización directa. Pega el link de Maps o busca en el mapa.");
      return;
    }
    setCalculando(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setCoordenadas(punto);
        setSecuenciaCentrarDestino((n) => n + 1);
        void ejecutarCotizacionPorCoordenadas(punto);
      },
      () => {
        setCalculando(false);
        setErrorMsg("Permiso de GPS denegado. Puedes pegar el link de Google Maps/Waze o buscar en el mapa.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4E4E7",
        borderRadius: "12px",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Selector Domicilio vs Retiro en Tienda */}
      {permitirModoRetiro && config.permitirRetiroLocal && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(135px, 100%), 1fr))",
            gap: "6px",
            background: "#F4F4F5",
            padding: "4px",
            borderRadius: "9px",
          }}
        >
          <button
            type="button"
            onClick={() => void cambiarModoEntrega(false)}
            title="Entrega a domicilio calculada por ubicación"
            aria-label="Entrega a domicilio"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "7px 10px",
              borderRadius: "7px",
              border: !retiroLocal ? "1px solid #E4E4E7" : "1px solid transparent",
              background: !retiroLocal ? "#FFFFFF" : "transparent",
              color: !retiroLocal ? "#18181B" : "#52525B",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: !retiroLocal ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <Truck size={14} />
            <span>A domicilio</span>
          </button>

          <button
            type="button"
            onClick={() => void cambiarModoEntrega(true)}
            title="Retirar gratis en nuestra tienda física"
            aria-label="Retiro gratis en tienda"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "7px 10px",
              borderRadius: "7px",
              border: retiroLocal ? "1px solid #BBF7D0" : "1px solid transparent",
              background: retiroLocal ? "#F0FDF4" : "transparent",
              color: retiroLocal ? "#166534" : "#52525B",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Store size={14} />
            <span>Retiro gratis</span>
          </button>
        </div>
      )}

      {retiroLocal ? (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "0.8rem",
            color: "#166534",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <strong>🏪 {config.origenNombre} — $0.00</strong>
            {config.origenMapaUrl && (
              <a
                href={config.origenMapaUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "#15803D",
                  fontWeight: 700,
                  fontSize: "0.76rem",
                  textDecoration: "underline",
                }}
              >
                <span>Ver mapa</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          {config.origenDireccion && (
            <span style={{ fontSize: "0.75rem", color: "#15803D" }}>{config.origenDireccion}</span>
          )}
        </div>
      ) : (
        <>
          {/* Indicador compacto de Zona Gratuita (ocupa mínimo espacio vertical) */}
          {esClienteRegistradoEfectivo || config.envioGratisSoloRegistrados === false ? (
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "9px",
                padding: "7px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    color: "#166534",
                  }}
                >
                  <CheckCircle2 size={14} color="#16A34A" style={{ flexShrink: 0 }} />
                  <span>Zona gratuita</span>
                </span>
                <span
                  style={{
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    color: "#15803D",
                    background: "#DCFCE7",
                    padding: "1px 7px",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                  }}
                >
                  $0.00
                </span>
              </div>
              <span style={{ fontSize: "0.69rem", color: "#15803D", lineHeight: 1.3 }}>
                El área en verde en el mapa es gratuita.
              </span>
            </div>
          ) : (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: "9px",
                padding: "7px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    color: "#92400E",
                  }}
                >
                  <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0 }} />
                  <span>Regístrate para activar la zona gratuita</span>
                </span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <a
                    href="/registro?destino=%2F%3Fcheckout%3D1%26obsequio%3D1&obsequio=1"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        document.cookie = `tranqi_destino=${encodeURIComponent(
                          "/?checkout=1&obsequio=1"
                        )}; path=/; max-age=86400`;
                      }
                    }}
                    title="Crear cuenta gratis para activar la zona gratuita"
                    aria-label="Registrarme"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "#2D4734",
                      color: "#FFFFFF",
                      fontSize: "0.69rem",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Registrarme
                  </a>
                  <a
                    href="/ingresar?destino=%2F%3Fcheckout%3D1%26obsequio%3D1"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        document.cookie = `tranqi_destino=${encodeURIComponent(
                          "/?checkout=1&obsequio=1"
                        )}; path=/; max-age=86400`;
                      }
                    }}
                    title="Iniciar sesión con mi cuenta para activar la zona gratuita"
                    aria-label="Ingresar"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 9px",
                      borderRadius: "999px",
                      border: "1px solid #D6D3D1",
                      background: "#FFFFFF",
                      color: "#1C1917",
                      fontSize: "0.69rem",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Ingresar
                  </a>
                </div>
              </div>
              <span style={{ fontSize: "0.68rem", color: "#78350F", lineHeight: 1.3 }}>
                El área en verde en el mapa es gratuita ($0.00) para clientes registrados.
              </span>
            </div>
          )}

          {/* Campo de link Google Maps / Apple Maps / Waze (auto-selecciona al enfocar + botón claro Actualizar) */}
          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <Link2
                size={14}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#71717A",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={enlaceTexto}
                onFocus={(e) => {
                  recienEnfocadoUrlRef.current = true;
                  const inputEl = e.currentTarget;
                  if (inputEl.value) {
                    inputEl.select();
                    // Respaldo para navegadores móviles que colocan el cursor tras focus
                    window.setTimeout(() => {
                      try {
                        inputEl.select();
                      } catch {
                        // Ignorar si perdió el foco
                      }
                    }, 0);
                  }
                }}
                onMouseUp={(e) => {
                  if (recienEnfocadoUrlRef.current && e.currentTarget.value) {
                    e.preventDefault();
                    recienEnfocadoUrlRef.current = false;
                  }
                }}
                onBlur={() => {
                  recienEnfocadoUrlRef.current = false;
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setEnlaceTexto(val);
                  if (
                    /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.[^/]+\/maps|maps\.google\.|waze\.com\/ul|ul\.waze\.com|maps\.apple\.com)/i.test(
                      val.trim()
                    )
                  ) {
                    void manejarResolverEnlace(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void manejarResolverEnlace();
                  }
                }}
                placeholder="Pega aquí la dirección de Google Maps"
                aria-label="Enlace de dirección en Google Maps"
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 30px",
                  borderRadius: "8px",
                  border: "1px solid #D4D4D8",
                  fontSize: "0.8rem",
                  color: "#18181B",
                  boxSizing: "border-box",
                  background: "#FAFAFA",
                }}
              />
            </div>

            <button
              type="button"
              disabled={calculando}
              onClick={() => void manejarResolverEnlace()}
              title="Actualizar ubicación y envío desde el enlace de Maps"
              aria-label="Actualizar ubicación desde Maps"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "0 11px",
                borderRadius: "8px",
                border: "1px solid #18181B",
                background: "#18181B",
                color: "#FFFFFF",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: calculando ? "wait" : "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {calculando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
              <span>Actualizar</span>
            </button>
          </div>

          {/* Acciones rápidas: Seleccionar en Mapa ampliado o GPS */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <button
              type="button"
              onClick={() => {
                if (coordenadas) {
                  setSecuenciaCentrarDestino((n) => n + 1);
                }
                setMapaAmpliadoAbierto(true);
              }}
              title="Abrir mapa ampliado para buscar tu calle o marcar el punto exacto"
              aria-label="Seleccionar en Mapa"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "999px",
                border: "1px solid #16A34A",
                background: "#F0FDF4",
                color: "#166534",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <MapIcon size={13} />
              <span>Seleccionar en Mapa</span>
            </button>

            <button
              type="button"
              onClick={usarMiUbicacionGps}
              title="Usar ubicación GPS actual de mi dispositivo"
              aria-label="Usar mi GPS"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "999px",
                border: "1px solid #D4D4D8",
                background: "#FFFFFF",
                color: "#27272A",
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <LocateFixed size={13} />
              <span>Mi GPS</span>
            </button>
          </div>

          {/* Buscador + Mapa Interactivo OpenStreetMap (solo si explícitamente se solicita mostrar por defecto inline) */}
          {mostrarMapaPorDefecto && mapaAbierto && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                paddingTop: "4px",
                borderTop: "1px solid #F4F4F5",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  value={consultaMapa}
                  onChange={(e) => setConsultaMapa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void manejarBuscarEnMapa();
                    }
                  }}
                  placeholder="Buscar barrio, avenida o edificio (ej. La Carolina, USFQ, San Rafael)..."
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D4D4D8",
                    fontSize: "0.78rem",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  disabled={buscandoSugerencias}
                  onClick={() => void manejarBuscarEnMapa()}
                  title="Buscar sector en el mapa de Pichincha"
                  aria-label="Buscar sector"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "0 11px",
                    borderRadius: "8px",
                    border: "1px solid #D4D4D8",
                    background: "#F4F4F5",
                    color: "#18181B",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {buscandoSugerencias ? <Loader2 size={13} /> : <Search size={13} />}
                  <span>Buscar</span>
                </button>
              </div>

              {sugerencias.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    maxHeight: "145px",
                    overflowY: "auto",
                    border: "1px solid #E4E4E7",
                    borderRadius: "8px",
                    padding: "4px",
                    background: "#FAFAFA",
                  }}
                >
                  {sugerencias.map((sug, i) => (
                    <button
                      key={`${sug.lat}-${sug.lng}-${i}`}
                      type="button"
                      onClick={() => {
                        const pt = { lat: sug.lat, lng: sug.lng };
                        setSugerencias([]);
                        setConsultaMapa(sug.nombreCorto);
                        setCoordenadas(pt);
                        setSecuenciaCentrarDestino((n) => n + 1);
                        void ejecutarCotizacionPorCoordenadas(
                          pt,
                          undefined,
                          sug.direccionCompleta
                        );
                      }}
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#FFFFFF",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        color: "#18181B",
                      }}
                    >
                      <strong>{sug.nombreCorto}</strong>
                      <div style={{ fontSize: "0.69rem", color: "#71717A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sug.direccionCompleta}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <MapaCoberturaPichincha
                origen={{ lat: config.origenLat, lng: config.origenLng }}
                origenNombre={config.origenNombre}
                destino={coordenadas}
                zonas={config.zonas}
                zonaResaltadaId={cotizacion?.zonaDetectada?.id ?? null}
                rutaGeometria={cotizacion?.rutaGeometria}
                secuenciaCentrarDestino={secuenciaCentrarDestino}
                alturaPx={235}
                onSeleccionarPunto={(pt) => {
                  void ejecutarCotizacionPorCoordenadas(pt);
                }}
              />
              <span style={{ fontSize: "0.7rem", color: "#71717A" }}>
                Toca la calle exacta en el mapa o arrastra el pin rojo de <strong>Punto de entrega</strong> (se mantiene tu nivel de zoom).
              </span>
            </div>
          )}

          {/* Mensaje de error si hubo */}
          {errorMsg && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "0.75rem",
                color: "#B91C1C",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Resultado verificado de la cotización */}
          {cotizacion && (
            <div
              style={{
                background: !cotizacion.dentroCobertura
                  ? "#FFFBEB"
                  : cotizacion.costoTotalEnvio === 0
                  ? "#F0FDF4"
                  : "#F8FAFC",
                border: !cotizacion.dentroCobertura
                  ? "1px solid #FDE68A"
                  : cotizacion.costoTotalEnvio === 0
                  ? "1px solid #BBF7D0"
                  : "1px solid #CBD5E1",
                borderRadius: "10px",
                padding: "9px 11px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: !cotizacion.dentroCobertura
                      ? "#92400E"
                      : cotizacion.costoTotalEnvio === 0
                      ? "#166534"
                      : "#0F172A",
                  }}
                >
                  {!cotizacion.dentroCobertura ? (
                    <AlertTriangle size={14} color="#D97706" />
                  ) : (
                    <CheckCircle2
                      size={14}
                      color={cotizacion.costoTotalEnvio === 0 ? "#16A34A" : "#0284C7"}
                    />
                  )}
                  <span>
                    {!cotizacion.dentroCobertura
                      ? "Ubicación fuera de cobertura automática"
                      : cotizacion.costoTotalEnvio === 0
                      ? "Entrega gratuita en zona de cobertura"
                      : "Valor adicional de envío"}
                  </span>
                </span>

                <strong
                  style={{
                    fontSize: "0.86rem",
                    color:
                      cotizacion.costoTotalEnvio === 0 && cotizacion.dentroCobertura
                        ? "#15803D"
                        : "#0F172A",
                  }}
                >
                  {cotizacion.dentroCobertura
                    ? cotizacion.costoTotalEnvio === 0
                      ? "GRATIS"
                      : `+$${cotizacion.costoTotalEnvio.toFixed(2)}`
                    : "Por coordinar"}
                </strong>
              </div>

              {(cotizacion.detalleDireccion || coordenadas) && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#475569",
                    lineHeight: 1.4,
                    marginTop: "3px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {cotizacion.detalleDireccion?.resumenDireccion && (
                    <div>📍 {cotizacion.detalleDireccion.resumenDireccion}</div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: "0.69rem", color: "#64748B" }}>
                    {cotizacion.detalleDireccion?.parroquia && (
                      <span>
                        <strong>Parroquia:</strong> {cotizacion.detalleDireccion.parroquia}
                      </span>
                    )}
                    {cotizacion.detalleDireccion?.sectorBarrio && (
                      <span>
                        <strong>Barrio:</strong> {cotizacion.detalleDireccion.sectorBarrio}
                      </span>
                    )}
                    {cotizacion.detalleDireccion?.callePrincipal && (
                      <span>
                        <strong>Calles:</strong> {cotizacion.detalleDireccion.callePrincipal}
                      </span>
                    )}
                    {coordenadas && (
                      <span>
                        <strong>GPS:</strong> {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {cotizacion.dentroCobertura &&
                cotizacion.clienteRegistrado === false &&
                (cotizacion.ahorroPorRegistrarseUsd ?? 0) > 0 && (
                  <div
                    style={{
                      marginTop: "5px",
                      padding: "6px 9px",
                      borderRadius: "8px",
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "6px",
                      fontSize: "0.72rem",
                      color: "#065F46",
                    }}
                  >
                    <span>
                      ✨ <strong>Beneficio cliente registrado:</strong> ahorras{" "}
                      <strong>${cotizacion.ahorroPorRegistrarseUsd!.toFixed(2)}</strong> en este envío (
                      {cotizacion.costoSiFueraRegistradoUsd === 0
                        ? "Envío GRATIS $0.00"
                        : `$${cotizacion.costoSiFueraRegistradoUsd!.toFixed(2)}`}
                      ).
                    </span>
                    <a
                      href="/registro?destino=%2F%3Fcheckout%3D1%26obsequio%3D1&obsequio=1"
                      title="Registrarme ahora y aplicar envío de cliente registrado"
                      aria-label="Activar Envío Gratis"
                      style={{
                        color: "#047857",
                        fontWeight: 800,
                        textDecoration: "underline",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Activar Gratis →
                    </a>
                  </div>
                )}

              {/* Detalle interno de ruta exclusivo para Operador / Admin / Ventas */}
              {esStaffRutaEfectivo && (
                <div
                  style={{
                    marginTop: "6px",
                    padding: "7px 9px",
                    borderRadius: "8px",
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    color: "#1E3A8A",
                    fontSize: "0.71rem",
                    lineHeight: 1.45,
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "6px 10px",
                      fontWeight: 800,
                    }}
                  >
                    <span>🧭 Ruta real: {cotizacion.distanciaVialKm.toFixed(2)} km</span>
                    <span>
                      · Delivery cobrado:{" "}
                      {cotizacion.costoTotalEnvio === 0
                        ? "$0.00 (Gratis)"
                        : `+$${cotizacion.costoTotalEnvio.toFixed(2)} USD`}
                    </span>
                    {cotizacion.zonaDetectada?.nombre && (
                      <span>· Zona: {cotizacion.zonaDetectada.nombre}</span>
                    )}
                  </div>
                  {cotizacion.formulaDetalle && (
                    <div style={{ color: "#1E40AF", fontSize: "0.69rem" }}>
                      <strong>Detalle cálculo:</strong> {cotizacion.formulaDetalle}
                    </div>
                  )}
                </div>
              )}

              {!cotizacion.dentroCobertura && (
                <span style={{ fontSize: "0.72rem", color: "#92400E", lineHeight: 1.35 }}>
                  Ubicación fuera de nuestra cobertura automática. Coordina entrega especial por chat o elige retiro en tienda.
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de mapa a toda la pantalla para seleccionar ubicación */}
      {mapaAmpliadoAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mapa en pantalla completa de selección de ubicación"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            width: "100vw",
            height: "100dvh",
            maxHeight: "100dvh",
            overflow: "hidden",
          }}
        >
          {/* Cabecera superior compacta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              flexShrink: 0,
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <MapPin size={18} color="#166534" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    color: "#0F172A",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Seleccionar Ubicación de Entrega
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.72rem",
                    color: "#64748B",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Área verde: <strong>{config.zonaGratisNombre}</strong> ($0.00) · Toca tu calle exacta o arrastra el pin rojo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMapaAmpliadoAbierto(false)}
              title="Cerrar mapa"
              aria-label="Cerrar mapa"
              style={{
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                borderRadius: "999px",
                width: "34px",
                height: "34px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#334155",
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Buscador de dirección + Botón GPS en barra de herramientas superior */}
          <div
            style={{
              padding: "8px 16px",
              background: "#FFFFFF",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "center",
              flexShrink: 0,
              position: "relative",
            }}
          >
            <div style={{ display: "flex", gap: "6px", flex: "1 1 280px" }}>
              <input
                type="text"
                value={consultaMapa}
                onChange={(e) => setConsultaMapa(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void manejarBuscarEnMapa();
                  }
                }}
                placeholder="Buscar calle, avenida, barrio o edificio (ej. La Carolina, Eloy Alfaro, USFQ)..."
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                disabled={buscandoSugerencias}
                onClick={() => void manejarBuscarEnMapa()}
                title="Buscar dirección en el mapa"
                aria-label="Buscar dirección"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "0 14px",
                  borderRadius: "8px",
                  border: "1px solid #18181B",
                  background: "#18181B",
                  color: "#FFFFFF",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: buscandoSugerencias ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {buscandoSugerencias ? <Loader2 size={14} /> : <Search size={14} />}
                <span>Buscar</span>
              </button>
            </div>

            <button
              type="button"
              disabled={calculando}
              onClick={usarMiUbicacionGps}
              title="Detectar mi ubicación GPS actual"
              aria-label="Usar mi GPS"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #0284C7",
                background: "#F0F9FF",
                color: "#0369A1",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: calculando ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {calculando ? <Loader2 size={14} /> : <LocateFixed size={14} />}
              <span>Mi GPS</span>
            </button>

            {sugerencias.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "16px",
                  right: "16px",
                  maxWidth: "520px",
                  zIndex: 2000,
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  maxHeight: "180px",
                  overflowY: "auto",
                  border: "1px solid #CBD5E1",
                  borderRadius: "8px",
                  padding: "4px",
                  background: "#FFFFFF",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                }}
              >
                {sugerencias.map((sug, i) => (
                  <button
                    key={`modal-${sug.lat}-${sug.lng}-${i}`}
                    type="button"
                    onClick={() => {
                      const pt = { lat: sug.lat, lng: sug.lng };
                      setSugerencias([]);
                      setConsultaMapa(sug.nombreCorto);
                      setCoordenadas(pt);
                      setSecuenciaCentrarDestino((n) => n + 1);
                      void ejecutarCotizacionPorCoordenadas(
                        pt,
                        undefined,
                        sug.direccionCompleta
                      );
                    }}
                    style={{
                      textAlign: "left",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      color: "#0F172A",
                    }}
                  >
                    <strong>{sug.nombreCorto}</strong>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#64748B",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {sug.direccionCompleta}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              style={{
                background: "#FEF2F2",
                borderBottom: "1px solid #FECACA",
                padding: "7px 16px",
                fontSize: "0.76rem",
                color: "#B91C1C",
                flexShrink: 0,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Área del mapa interactivo a pantalla completa */}
          <div style={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
            <MapaCoberturaPichincha
              origen={{ lat: config.origenLat, lng: config.origenLng }}
              origenNombre={config.origenNombre}
              destino={coordenadas}
              zonas={config.zonas}
              zonaResaltadaId={
                cotizacion?.zonaDetectada?.id ??
                config.zonas.find((z) => z.modoCobro === "GRATIS")?.id ??
                null
              }
              rutaGeometria={cotizacion?.rutaGeometria}
              secuenciaCentrarDestino={secuenciaCentrarDestino}
              alturaPx={600}
              alturaCss="100%"
              onSeleccionarPunto={(pt) => {
                void ejecutarCotizacionPorCoordenadas(pt);
              }}
            />
          </div>

          {/* Barra inferior de resumen, detalles y confirmación */}
          <div
            style={{
              padding: "10px 16px",
              background: "#FFFFFF",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              flexShrink: 0,
              boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: "1 1 260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 800,
                    color:
                      cotizacion?.costoTotalEnvio === 0 && cotizacion.dentroCobertura
                        ? "#166534"
                        : cotizacion?.dentroCobertura
                        ? "#0F172A"
                        : "#92400E",
                  }}
                >
                  {calculando
                    ? "Calculando costo de entrega..."
                    : cotizacion
                    ? cotizacion.costoTotalEnvio === 0 && cotizacion.dentroCobertura
                      ? "✅ Entrega Gratuita ($0.00)"
                      : cotizacion.dentroCobertura
                      ? `Valor adicional de envío: +$${cotizacion.costoTotalEnvio.toFixed(2)}`
                      : "Ubicación fuera de cobertura automática"
                    : "✅ Zona gratuita activa ($0.00)"}
                </span>

                {cotizacion?.detalleDireccion?.parroquia && (
                  <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                    · {cotizacion.detalleDireccion.parroquia}
                    {cotizacion.detalleDireccion.sectorBarrio ? `, ${cotizacion.detalleDireccion.sectorBarrio}` : ""}
                  </span>
                )}
                {esStaffRutaEfectivo && cotizacion && (
                  <span
                    style={{
                      fontSize: "0.71rem",
                      fontWeight: 700,
                      color: "#1E3A8A",
                      background: "#DBEAFE",
                      padding: "2px 7px",
                      borderRadius: "999px",
                    }}
                  >
                    {cotizacion.distanciaVialKm.toFixed(2)} km ·{" "}
                    {cotizacion.zonaDetectada?.nombre || "Fuera de zona"}
                  </span>
                )}
              </div>

              {cotizacion?.detalleDireccion?.callePrincipal ? (
                <span style={{ fontSize: "0.72rem", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  📍 {cotizacion.detalleDireccion.callePrincipal}
                </span>
              ) : cotizacion?.detalleDireccion?.resumenDireccion ? (
                <span style={{ fontSize: "0.72rem", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  📍 {cotizacion.detalleDireccion.resumenDireccion}
                </span>
              ) : coordenadas ? (
                <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                  GPS: {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                </span>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              {coordenadas && (
                <button
                  type="button"
                  onClick={() => setSecuenciaCentrarDestino((n) => n + 1)}
                  title="Centrar y acercar el mapa en la ubicación seleccionada"
                  aria-label="Centrar en ubicación"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#0F172A",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                  }}
                >
                  <LocateFixed size={14} />
                  <span>Centrar</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMapaAmpliadoAbierto(false)}
                title="Confirmar ubicación seleccionada y volver a la caja de pago"
                aria-label="Confirmar Ubicación"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#065F46",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(6, 95, 70, 0.3)",
                }}
              >
                <CheckCircle2 size={16} />
                <span>Confirmar Ubicación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

