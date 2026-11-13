"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CoordenadaGeo, ZonaCoberturaLogistica } from "../logistica";

declare global {
  interface Window {
    L?: any;
  }
}

let promesaLeafletGlobal: Promise<any> | null = null;

function cargarLeafletCliente(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Entorno servidor"));
  }
  if (window.L) {
    return Promise.resolve(window.L);
  }
  if (promesaLeafletGlobal) {
    return promesaLeafletGlobal;
  }

  promesaLeafletGlobal = new Promise((resolve, reject) => {
    if (!document.getElementById("eco-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "eco-leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const cargarScript = (src: string, onFallo: () => void) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        if (window.L) resolve(window.L);
        else onFallo();
      };
      script.onerror = onFallo;
      document.head.appendChild(script);
    };

    cargarScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", () => {
      cargarScript(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
        () => {
          promesaLeafletGlobal = null;
          reject(new Error("No fue posible cargar el visor cartográfico OpenStreetMap"));
        }
      );
    });
  });

  return promesaLeafletGlobal;
}

export interface PropsMapaCoberturaPichincha {
  origen: CoordenadaGeo;
  origenNombre?: string;
  destino?: CoordenadaGeo | null;
  zonas?: ZonaCoberturaLogistica[];
  zonaResaltadaId?: string | null;
  rutaGeometria?: [number, number][];
  alturaPx?: number;
  alturaCss?: string;
  modoDibujoPoligono?: boolean;
  verticesDibujo?: [number, number][];
  /** Incrementar para encuadrar automáticamente el polígono de `zonaResaltadaId` */
  secuenciaEnfoqueZona?: number;
  /** Incrementar para encuadrar todas las zonas activas de Pichincha */
  secuenciaVerTodo?: number;
  onSeleccionarPunto?: (punto: CoordenadaGeo) => void;
  onAgregarVerticePoligono?: (punto: CoordenadaGeo) => void;
}

export function MapaCoberturaPichincha({
  origen,
  origenNombre = "Taller Matriz",
  destino,
  zonas = [],
  zonaResaltadaId,
  rutaGeometria,
  alturaPx = 300,
  alturaCss,
  modoDibujoPoligono = false,
  verticesDibujo = [],
  secuenciaEnfoqueZona = 0,
  secuenciaVerTodo = 0,
  onSeleccionarPunto,
  onAgregarVerticePoligono,
}: PropsMapaCoberturaPichincha) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<any>(null);
  const capaZonasRef = useRef<any>(null);
  const capaRutaRef = useRef<any>(null);
  const capaDibujoRef = useRef<any>(null);
  const marcadorOrigenRef = useRef<any>(null);
  const marcadorDestinoRef = useRef<any>(null);

  const callbackPuntoRef = useRef(onSeleccionarPunto);
  const callbackVerticeRef = useRef(onAgregarVerticePoligono);
  const modoDibujoRef = useRef(modoDibujoPoligono);

  callbackPuntoRef.current = onSeleccionarPunto;
  callbackVerticeRef.current = onAgregarVerticePoligono;
  modoDibujoRef.current = modoDibujoPoligono;

  const [estadoCarga, setEstadoCarga] = useState<"cargando" | "listo" | "error">("cargando");

  // Inicialización única del mapa Leaflet + observador de cambio de dimensiones
  useEffect(() => {
    let cancelado = false;
    let resizeObserver: ResizeObserver | null = null;

    cargarLeafletCliente()
      .then((L) => {
        if (cancelado || !contenedorRef.current || mapaRef.current) return;

        const centroInicial = destino ?? origen;
        const map = L.map(contenedorRef.current, {
          center: [centroInicial.lat, centroInicial.lng],
          zoom: destino ? 13 : 12,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        capaZonasRef.current = L.layerGroup().addTo(map);
        capaRutaRef.current = L.layerGroup().addTo(map);
        capaDibujoRef.current = L.layerGroup().addTo(map);

        // Un único listener en el mapa recibe tanto clics sobre calles libres como sobre 1 o varios polígonos solapados
        map.on("click", (ev: any) => {
          const lat = Number(ev?.latlng?.lat?.toFixed(6));
          const lng = Number(ev?.latlng?.lng?.toFixed(6));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          if (modoDibujoRef.current && callbackVerticeRef.current) {
            callbackVerticeRef.current({ lat, lng });
          } else if (callbackPuntoRef.current) {
            callbackPuntoRef.current({ lat, lng });
          }
        });

        mapaRef.current = map;
        setEstadoCarga("listo");

        if (typeof ResizeObserver !== "undefined" && contenedorRef.current) {
          resizeObserver = new ResizeObserver(() => {
            try {
              map.invalidateSize();
            } catch {
              // Ignorar si está desmontándose
            }
          });
          resizeObserver.observe(contenedorRef.current);
        }

        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // Ignorar si se desmontó
          }
        }, 180);
      })
      .catch(() => {
        if (!cancelado) setEstadoCarga("error");
      });

    return () => {
      cancelado = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapaRef.current) {
        try {
          mapaRef.current.remove();
        } catch {
          // Ignorar
        }
        mapaRef.current = null;
      }
    };
  }, []);

  // Revalidar tamaño al ampliar / reducir altura o abrir pantalla completa
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current) return;
    const timer = setTimeout(() => {
      try {
        mapaRef.current?.invalidateSize();
      } catch {
        // Ignorar
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [estadoCarga, alturaPx, alturaCss]);

  // Encuadrar zona seleccionada cuando el usuario la elige en el dropdown o pulsa «Enfocar Área»
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !window.L || secuenciaEnfoqueZona <= 0) {
      return;
    }
    const zona = zonas.find((z) => z.id === zonaResaltadaId || z.codigo === zonaResaltadaId);
    if (!zona || !Array.isArray(zona.poligono) || zona.poligono.length < 3) return;
    try {
      const bounds = window.L.latLngBounds(zona.poligono);
      mapaRef.current.invalidateSize();
      mapaRef.current.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
    } catch {
      // Ignorar coordenadas degeneradas
    }
  }, [estadoCarga, secuenciaEnfoqueZona, zonaResaltadaId, zonas]);

  // Encuadrar todas las zonas activas de Pichincha al pulsar «Ver Todas»
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !window.L || secuenciaVerTodo <= 0) {
      return;
    }
    const puntos: [number, number][] = [[origen.lat, origen.lng]];
    zonas.forEach((z) => {
      if (z.activo && Array.isArray(z.poligono)) {
        z.poligono.forEach((pt) => {
          if (Array.isArray(pt) && pt.length === 2) puntos.push(pt);
        });
      }
    });
    if (puntos.length < 2) return;
    try {
      const bounds = window.L.latLngBounds(puntos);
      mapaRef.current.invalidateSize();
      mapaRef.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
    } catch {
      // Ignorar
    }
  }, [estadoCarga, secuenciaVerTodo, origen.lat, origen.lng, zonas]);

  // Actualizar polígonos de zonas (la zona seleccionada se dibuja al final para quedar nítida arriba en solapamientos)
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !capaZonasRef.current || !window.L) return;
    const L = window.L;
    capaZonasRef.current.clearLayers();

    const activas = zonas.filter((z) => z.activo && Array.isArray(z.poligono) && z.poligono.length >= 3);
    const ordenadasParaDibujo = [...activas].sort((a, b) => {
      const aSel = zonaResaltadaId === a.id || zonaResaltadaId === a.codigo ? 1 : 0;
      const bSel = zonaResaltadaId === b.id || zonaResaltadaId === b.codigo ? 1 : 0;
      return aSel - bSel;
    });

    ordenadasParaDibujo.forEach((zona) => {
      const resaltada = zonaResaltadaId === zona.id || zonaResaltadaId === zona.codigo;
      const etiquetaPrecio =
        zona.modoCobro === "GRATIS"
          ? "Envío Gratis ($0)"
          : zona.modoCobro === "TARIFA_FIJA"
          ? `Tarifa fija $${zona.tarifaFija.toFixed(2)}`
          : "Cálculo por km";

      const poly = L.polygon(zona.poligono, {
        color: zona.color || "#0284C7",
        weight: resaltada ? 3.2 : 1.6,
        opacity: resaltada ? 1 : 0.72,
        dashArray: resaltada ? undefined : "5, 4",
        fillColor: zona.color || "#0284C7",
        fillOpacity: resaltada ? 0.22 : zona.modoCobro === "GRATIS" ? 0.11 : 0.07,
        bubblingMouseEvents: true,
        interactive: !modoDibujoPoligono,
      });

      if (!modoDibujoPoligono) {
        poly.bindTooltip(`<strong>${zona.nombre}</strong><br/>${etiquetaPrecio}`, {
          sticky: true,
        });
      }

      poly.addTo(capaZonasRef.current);

      // Mostrar vértices discretos del área actualmente seleccionada cuando no se está redibujando
      if (resaltada && !modoDibujoPoligono) {
        zona.poligono.forEach(([lat, lng]) => {
          L.circleMarker([lat, lng], {
            radius: 3.5,
            color: zona.color || "#0284C7",
            fillColor: "#FFFFFF",
            fillOpacity: 1,
            weight: 2,
            interactive: false,
          }).addTo(capaZonasRef.current);
        });
      }
    });
  }, [estadoCarga, zonas, zonaResaltadaId, modoDibujoPoligono]);

  // Actualizar marcador de origen, destino y ruta OSRM
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !window.L) return;
    const L = window.L;
    const map = mapaRef.current;

    if (marcadorOrigenRef.current) {
      map.removeLayer(marcadorOrigenRef.current);
    }

    const iconoTaller = L.divIcon({
      className: "eco-pin-taller",
      html: `<div style="background:#18181B;color:#FFFFFF;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.28);transform:translate(-50%,-50%);">🏪 Taller</div>`,
      iconSize: [0, 0],
    });

    marcadorOrigenRef.current = L.marker([origen.lat, origen.lng], {
      icon: iconoTaller,
      interactive: !modoDibujoPoligono,
    })
      .bindTooltip(`${origenNombre} (Punto de partida)`, { direction: "top" })
      .addTo(map);

    if (marcadorDestinoRef.current) {
      map.removeLayer(marcadorDestinoRef.current);
      marcadorDestinoRef.current = null;
    }

    if (capaRutaRef.current) {
      capaRutaRef.current.clearLayers();
    }

    if (destino && Number.isFinite(destino.lat) && Number.isFinite(destino.lng)) {
      const iconoEntrega = L.divIcon({
        className: "eco-pin-entrega",
        html: `<div style="background:#E11D48;color:#FFFFFF;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;border:2px solid #FFFFFF;box-shadow:0 3px 10px rgba(225,29,72,0.4);transform:translate(-50%,-90%);cursor:grab;">📍 Entrega</div>`,
        iconSize: [0, 0],
      });

      const marker = L.marker([destino.lat, destino.lng], {
        icon: iconoEntrega,
        draggable: Boolean(onSeleccionarPunto) && !modoDibujoPoligono,
        interactive: !modoDibujoPoligono,
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        if (pos && callbackPuntoRef.current) {
          callbackPuntoRef.current({
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
          });
        }
      });

      marcadorDestinoRef.current = marker;

      if (rutaGeometria && rutaGeometria.length >= 2 && capaRutaRef.current) {
        L.polyline(rutaGeometria, {
          color: "#18181B",
          weight: 3.5,
          opacity: 0.78,
          dashArray: "6, 6",
          interactive: false,
        }).addTo(capaRutaRef.current);
      }

      if (!modoDibujoPoligono) {
        try {
          const bounds = L.latLngBounds([
            [origen.lat, origen.lng],
            [destino.lat, destino.lng],
          ]);
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
        } catch {
          map.setView([destino.lat, destino.lng], 14);
        }
      }
    }
  }, [estadoCarga, origen.lat, origen.lng, origenNombre, destino, rutaGeometria, modoDibujoPoligono, onSeleccionarPunto]);

  // Capa de dibujo de nuevo polígono en administración
  useEffect(() => {
    if (estadoCarga !== "listo" || !capaDibujoRef.current || !window.L) return;
    const L = window.L;
    capaDibujoRef.current.clearLayers();

    if (verticesDibujo.length > 0) {
      verticesDibujo.forEach(([lat, lng], idx) => {
        L.circleMarker([lat, lng], {
          radius: idx === 0 ? 6 : 5,
          color: "#DC2626",
          fillColor: idx === 0 ? "#DC2626" : "#FFFFFF",
          fillOpacity: 1,
          weight: 2,
          interactive: false,
        })
          .bindTooltip(`Vértice ${idx + 1}`)
          .addTo(capaDibujoRef.current);
      });

      if (verticesDibujo.length === 2) {
        L.polyline(verticesDibujo, {
          color: "#DC2626",
          weight: 2.2,
          dashArray: "4, 4",
          interactive: false,
        }).addTo(capaDibujoRef.current);
      } else if (verticesDibujo.length >= 3) {
        L.polygon(verticesDibujo, {
          color: "#DC2626",
          weight: 2.4,
          dashArray: "4, 4",
          fillColor: "#EF4444",
          fillOpacity: 0.2,
          interactive: false,
        }).addTo(capaDibujoRef.current);
      }
    }
  }, [estadoCarga, verticesDibujo]);

  const altoFinal = alturaCss ?? `${alturaPx}px`;

  if (estadoCarga === "error") {
    return (
      <div
        style={{
          height: altoFinal,
          borderRadius: "10px",
          border: "1px solid #E4E4E7",
          background: "#FAFAFA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          textAlign: "center",
          fontSize: "0.82rem",
          color: "#52525B",
        }}
      >
        Visor de mapa no disponible en esta red. Puedes pegar directamente el enlace de Google Maps, Apple Maps o Waze para calcular el envío exacto.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        ref={contenedorRef}
        style={{
          width: "100%",
          height: altoFinal,
          borderRadius: "10px",
          border: modoDibujoPoligono ? "2px solid #DC2626" : "1px solid #E4E4E7",
          overflow: "hidden",
          background: "#F4F4F5",
          cursor: modoDibujoPoligono ? "crosshair" : "grab",
          zIndex: 1,
        }}
      />
      {estadoCarga === "cargando" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "10px",
            background: "rgba(250, 250, 250, 0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "#52525B",
            zIndex: 2,
          }}
        >
          Cargando mapa de cobertura en Pichincha...
        </div>
      )}
    </div>
  );
}
