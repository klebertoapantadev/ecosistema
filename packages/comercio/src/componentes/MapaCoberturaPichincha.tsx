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
  modoDibujoPoligono?: boolean;
  verticesDibujo?: [number, number][];
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
  modoDibujoPoligono = false,
  verticesDibujo = [],
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

  // Inicialización única del mapa Leaflet
  useEffect(() => {
    let cancelado = false;

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

  // Actualizar polígonos de zonas
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !capaZonasRef.current || !window.L) return;
    const L = window.L;
    capaZonasRef.current.clearLayers();

    zonas
      .filter((z) => z.activo && Array.isArray(z.poligono) && z.poligono.length >= 3)
      .forEach((zona) => {
        const resaltada = zonaResaltadaId === zona.id || zonaResaltadaId === zona.codigo;
        const etiquetaPrecio =
          zona.modoCobro === "GRATIS"
            ? "Envío Gratis ($0)"
            : zona.modoCobro === "TARIFA_FIJA"
            ? `Tarifa fija $${zona.tarifaFija.toFixed(2)}`
            : "Cálculo por km";

        const poly = L.polygon(zona.poligono, {
          color: zona.color || "#0284C7",
          weight: resaltada ? 2.8 : 1.5,
          opacity: resaltada ? 0.95 : 0.7,
          fillColor: zona.color || "#0284C7",
          fillOpacity: resaltada ? 0.24 : zona.modoCobro === "GRATIS" ? 0.14 : 0.08,
        });

        poly.bindTooltip(`<strong>${zona.nombre}</strong><br/>${etiquetaPrecio}`, {
          sticky: true,
        });

        poly.on("click", (ev: any) => {
          const lat = Number(ev?.latlng?.lat?.toFixed(6));
          const lng = Number(ev?.latlng?.lng?.toFixed(6));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          if (modoDibujoRef.current && callbackVerticeRef.current) {
            callbackVerticeRef.current({ lat, lng });
          } else if (callbackPuntoRef.current) {
            callbackPuntoRef.current({ lat, lng });
          }
        });

        poly.addTo(capaZonasRef.current);
      });
  }, [estadoCarga, zonas, zonaResaltadaId]);

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
      interactive: true,
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
        }).addTo(capaRutaRef.current);
      }

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
  }, [estadoCarga, origen.lat, origen.lng, origenNombre, destino, rutaGeometria, modoDibujoPoligono, onSeleccionarPunto]);

  // Capa de dibujo de nuevo polígono en administración
  useEffect(() => {
    if (estadoCarga !== "listo" || !capaDibujoRef.current || !window.L) return;
    const L = window.L;
    capaDibujoRef.current.clearLayers();

    if (verticesDibujo.length > 0) {
      verticesDibujo.forEach(([lat, lng], idx) => {
        L.circleMarker([lat, lng], {
          radius: 5,
          color: "#DC2626",
          fillColor: "#FFFFFF",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(`Vértice ${idx + 1}`)
          .addTo(capaDibujoRef.current);
      });

      if (verticesDibujo.length >= 2) {
        L.polygon(verticesDibujo, {
          color: "#DC2626",
          weight: 2,
          dashArray: "4, 4",
          fillColor: "#EF4444",
          fillOpacity: 0.18,
        }).addTo(capaDibujoRef.current);
      }
    }
  }, [estadoCarga, verticesDibujo]);

  if (estadoCarga === "error") {
    return (
      <div
        style={{
          height: `${alturaPx}px`,
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
          height: `${alturaPx}px`,
          borderRadius: "10px",
          border: "1px solid #E4E4E7",
          overflow: "hidden",
          background: "#F4F4F5",
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

