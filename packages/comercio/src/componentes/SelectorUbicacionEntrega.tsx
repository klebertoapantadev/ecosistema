"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  Store,
  Truck,
  AlertTriangle,
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
  onCambioCotizacion,
}: PropsSelectorUbicacionEntrega) {
  const [config, setConfig] = useState<ConfiguracionLogisticaNegocio>(
    () => configuracionInicial ?? crearConfiguracionLogisticaPorDefecto(negocio)
  );
  const [retiroLocal, setRetiroLocal] = useState<boolean>(retiroInicial);
  const [enlaceTexto, setEnlaceTexto] = useState<string>(enlaceMapaInicial);
  const [coordenadas, setCoordenadas] = useState<CoordenadaGeo | null>(coordenadasIniciales);
  const [cotizacion, setCotizacion] = useState<ResultadoCotizacionEnvio | null>(cotizacionInicial);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(mostrarMapaPorDefecto);

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

  // Recalcular si cambian condiciones de los ítems (ej. producto sin envío incluido o recargo especial)
  useEffect(() => {
    if (retiroLocal) return;
    if (coordenadas) {
      void ejecutarCotizacionPorCoordenadas(coordenadas, enlaceTexto, undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryIncluidoProducto, recargoLogisticoProducto]);

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
      });

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setCoordenadas(res.cotizacion.destino);
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
        setMapaAbierto(true);
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
            gridTemplateColumns: "1fr 1fr",
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
          {/* Nota de cobertura incluida */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "6px",
              fontSize: "0.74rem",
              color: "#52525B",
            }}
          >
            <span>
              📍 <strong>Envío Gratis:</strong> {config.zonaGratisNombre} · Fuera de zona:{" "}
              <strong>${config.tarifaPorKm.toFixed(2)}/km</strong> (mín. ${config.recargoMinimoExtra.toFixed(2)})
            </span>
          </div>

          {/* Campo de link Google Maps / Apple Maps / Waze */}
          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
            <div style={{ position: "relative", flex: 1 }}>
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
                placeholder="Pega link de Google Maps, Waze o Apple Maps..."
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
              title="Calcular costo de envío según la ubicación ingresada"
              aria-label="Calcular costo de envío"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #18181B",
                background: "#18181B",
                color: "#FFFFFF",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: calculando ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {calculando ? <Loader2 size={14} /> : <MapPin size={14} />}
              <span className="btn-texto-responsive">Calcular</span>
            </button>
          </div>

          {/* Acciones rápidas: Seleccionar en Mapa o GPS */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setMapaAbierto((prev) => !prev)}
              title={mapaAbierto ? "Ocultar mapa interactivo" : "Buscar dirección o mover el pin en el mapa"}
              aria-label={mapaAbierto ? "Ocultar mapa" : "Buscar en mapa"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "999px",
                border: "1px solid #D4D4D8",
                background: mapaAbierto ? "#F4F4F5" : "#FFFFFF",
                color: "#27272A",
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MapIcon size={13} />
              <span>{mapaAbierto ? "Ocultar Mapa" : "Buscar en Mapa"}</span>
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
                padding: "5px 10px",
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

          {/* Buscador + Mapa Interactivo OpenStreetMap */}
          {mapaAbierto && (
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
                        setSugerencias([]);
                        setConsultaMapa(sug.nombreCorto);
                        void ejecutarCotizacionPorCoordenadas(
                          { lat: sug.lat, lng: sug.lng },
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
                alturaPx={235}
                onSeleccionarPunto={(pt) => {
                  void ejecutarCotizacionPorCoordenadas(pt);
                }}
              />
              <span style={{ fontSize: "0.7rem", color: "#71717A" }}>
                Haz clic en el punto exacto de entrega o arrastra el marcador rojo <strong>📍 Entrega</strong>.
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
                  <span>{cotizacion.etiquetaResumen}</span>
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

              {cotizacion.detalleDireccion && (
                <div
                  style={{
                    fontSize: "0.73rem",
                    color: "#475569",
                    lineHeight: 1.38,
                    marginTop: "2px",
                  }}
                >
                  📍 {cotizacion.detalleDireccion.resumenDireccion}
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
    </div>
  );
}

