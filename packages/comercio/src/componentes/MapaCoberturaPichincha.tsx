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

    if (!document.getElementById("eco-leaflet-custom-styles")) {
      const style = document.createElement("style");
      style.id = "eco-leaflet-custom-styles";
      style.textContent = `
        .eco-pin-entrega,
        .eco-pin-taller,
        .eco-etiqueta-zona-mapa {
          background: transparent !important;
          border: none !important;
        }
        .eco-etiqueta-zona-mapa {
          pointer-events: none !important;
        }
        .eco-pin-entrega .eco-pin-cuerpo {
          transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.16s ease;
          transform-origin: 21px 48px;
          cursor: grab;
        }
        .eco-pin-entrega:hover .eco-pin-cuerpo {
          transform: translateY(-2px) scale(1.05);
        }
        .eco-pin-entrega:active .eco-pin-cuerpo,
        .leaflet-dragging .eco-pin-entrega .eco-pin-cuerpo {
          transform: translateY(-5px) scale(1.1);
          cursor: grabbing;
        }
        @keyframes ecoPulsoPinEntrega {
          0% {
            transform: translate(-50%, -50%) scale(0.65);
            opacity: 0.9;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.25);
            opacity: 0;
          }
        }
        .eco-pin-pulso {
          animation: ecoPulsoPinEntrega 2s ease-out infinite;
        }
        .eco-mapa-seleccionable.leaflet-container {
          cursor: crosshair;
        }
        .eco-mapa-seleccionable.leaflet-dragging,
        .eco-mapa-seleccionable.leaflet-dragging .leaflet-grab {
          cursor: grabbing !important;
        }
      `;
      document.head.appendChild(style);
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
  /** Incrementar para centrar y acercar el mapa en la ubicación `destino` seleccionada */
  secuenciaCentrarDestino?: number;
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
  secuenciaCentrarDestino = 0,
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
  const interaccionUsuarioRef = useRef(false);
  const ultimaSecuenciaCentrarRef = useRef<number>(0);
  const estadoPinDestinoRef = useRef<{ arrastrable: boolean; interactivo: boolean } | null>(null);

  callbackPuntoRef.current = onSeleccionarPunto;
  callbackVerticeRef.current = onAgregarVerticePoligono;
  modoDibujoRef.current = modoDibujoPoligono;

  const esSeleccionable = Boolean(onSeleccionarPunto) && !modoDibujoPoligono;

  const [estadoCarga, setEstadoCarga] = useState<"cargando" | "listo" | "error">("cargando");

  // Inicialización única del mapa Leaflet + observador de cambio de dimensiones
  useEffect(() => {
    let cancelado = false;
    let resizeObserver: ResizeObserver | null = null;

    cargarLeafletCliente()
      .then((L) => {
        if (cancelado || !contenedorRef.current || mapaRef.current) return;

        const tieneDestinoInicial =
          Boolean(destino) &&
          Number.isFinite(destino?.lat) &&
          Number.isFinite(destino?.lng);
        const centroInicial = tieneDestinoInicial && destino ? destino : origen;

        const map = L.map(contenedorRef.current, {
          center: [centroInicial.lat, centroInicial.lng],
          zoom: tieneDestinoInicial ? 16 : 13,
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

        // Si abre sin destino previo pero con zona resaltada (ej. Ver zona gratuita), encuadrarla solo al iniciar
        if (!tieneDestinoInicial && zonaResaltadaId) {
          const zonaInicial = zonas.find(
            (z) => z.id === zonaResaltadaId || z.codigo === zonaResaltadaId
          );
          if (zonaInicial && Array.isArray(zonaInicial.poligono) && zonaInicial.poligono.length >= 3) {
            try {
              map.fitBounds(L.latLngBounds(zonaInicial.poligono), {
                padding: [28, 28],
                maxZoom: 14,
              });
            } catch {
              // Ignorar coordenadas degeneradas
            }
          }
        }

        map.on("zoomstart dragstart", () => {
          interaccionUsuarioRef.current = true;
        });

        // Al hacer clic: mantener exactamente el zoom actual y centrar suavemente en el punto elegido
        map.on("click", (ev: any) => {
          const lat = Number(ev?.latlng?.lat?.toFixed(6));
          const lng = Number(ev?.latlng?.lng?.toFixed(6));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          interaccionUsuarioRef.current = true;

          if (modoDibujoRef.current && callbackVerticeRef.current) {
            callbackVerticeRef.current({ lat, lng });
          } else if (callbackPuntoRef.current) {
            const zoomActual = map.getZoom();
            map.setView([lat, lng], zoomActual, { animate: true });
            callbackPuntoRef.current({ lat, lng });
          }
        });

        mapaRef.current = map;
        setEstadoCarga("listo");

        if (typeof ResizeObserver !== "undefined" && contenedorRef.current) {
          resizeObserver = new ResizeObserver(() => {
            try {
              map.invalidateSize({ pan: false });
            } catch {
              // Ignorar si está desmontándose
            }
          });
          resizeObserver.observe(contenedorRef.current);
        }

        setTimeout(() => {
          try {
            map.invalidateSize({ pan: false });
            if (!interaccionUsuarioRef.current && !tieneDestinoInicial && zonaResaltadaId) {
              const zonaInicial = zonas.find(
                (z) => z.id === zonaResaltadaId || z.codigo === zonaResaltadaId
              );
              if (
                zonaInicial &&
                Array.isArray(zonaInicial.poligono) &&
                zonaInicial.poligono.length >= 3
              ) {
                map.fitBounds(L.latLngBounds(zonaInicial.poligono), {
                  padding: [28, 28],
                  maxZoom: 14,
                });
              }
            }
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
      marcadorOrigenRef.current = null;
      marcadorDestinoRef.current = null;
      estadoPinDestinoRef.current = null;
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

  // Revalidar tamaño al ampliar / reducir altura o abrir pantalla completa sin alterar el zoom ni centrar
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current) return;
    const timer = setTimeout(() => {
      try {
        mapaRef.current?.invalidateSize({ pan: false });
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
      mapaRef.current.invalidateSize({ pan: false });
      mapaRef.current.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
    } catch {
      // Ignorar coordenadas degeneradas
    }
  }, [estadoCarga, secuenciaEnfoqueZona, zonaResaltadaId, zonas]);

  // Centrar en la ubicación de entrega cuando proviene de buscador, GPS, enlace o botón «Centrar en ubicación»
  // Respeta el zoom actual si ya está cerca (>= 16); si estaba alejado, acerca a nivel calle (16)
  useEffect(() => {
    if (
      estadoCarga !== "listo" ||
      !mapaRef.current ||
      !destino ||
      !Number.isFinite(destino.lat) ||
      !Number.isFinite(destino.lng) ||
      secuenciaCentrarDestino <= 0 ||
      secuenciaCentrarDestino === ultimaSecuenciaCentrarRef.current
    ) {
      return;
    }
    ultimaSecuenciaCentrarRef.current = secuenciaCentrarDestino;
    try {
      mapaRef.current.invalidateSize({ pan: false });
      const zoomActual = mapaRef.current.getZoom() ?? 16;
      const zoomObjetivo = Math.max(zoomActual, 16);
      mapaRef.current.setView([destino.lat, destino.lng], zoomObjetivo, { animate: true });
    } catch {
      // Ignorar
    }
  }, [estadoCarga, secuenciaCentrarDestino, destino]);

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
      mapaRef.current.invalidateSize({ pan: false });
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

      // Etiqueta fija legible dentro del polígono ("Cobertura Gratuita", "Calderón +$3", etc.)
      if (!modoDibujoPoligono) {
        try {
          const centroZona = poly.getBounds().getCenter();
          const colorZona = zona.color || (zona.modoCobro === "GRATIS" ? "#16A34A" : "#0284C7");
          const precioTexto =
            zona.tarifaFija % 1 === 0
              ? `$${zona.tarifaFija.toFixed(0)}`
              : `$${zona.tarifaFija.toFixed(2)}`;
          const textoPill =
            zona.modoCobro === "GRATIS"
              ? "Cobertura Gratuita"
              : zona.modoCobro === "TARIFA_FIJA"
                ? `${zona.nombre} +${precioTexto}`
                : `${zona.nombre} (por km)`;
          const textoEscapado = textoPill
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const esGratis = zona.modoCobro === "GRATIS";
          const bgPill = esGratis
            ? "rgba(236, 253, 245, 0.92)"
            : "rgba(255, 255, 255, 0.9)";
          const fgPill = esGratis ? "#166534" : "#1E293B";
          const borderPill = esGratis ? "#16A34A" : colorZona;

          L.marker(centroZona, {
            interactive: false,
            keyboard: false,
            zIndexOffset: esGratis ? -60 : -100,
            icon: L.divIcon({
              className: "eco-etiqueta-zona-mapa",
              iconSize: [0, 0],
              iconAnchor: [0, 0],
              html: `<div style="transform:translate(-50%,-50%);width:max-content;max-width:165px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 7px;border-radius:999px;background:${bgPill};border:1.25px solid ${borderPill};color:${fgPill};font-size:10px;font-weight:800;letter-spacing:0.01em;box-shadow:0 1px 4px rgba(15,23,42,0.18);pointer-events:none;user-select:none;line-height:1.25;">${textoEscapado}</div>`,
            }),
          }).addTo(capaZonasRef.current);
        } catch {
          // Ignorar si un polígono tiene coordenadas degeneradas
        }
      }

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

  // Actualizar marcador de origen (Taller / Tienda Física)
  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !window.L) return;
    const L = window.L;
    const map = mapaRef.current;

    if (marcadorOrigenRef.current) {
      map.removeLayer(marcadorOrigenRef.current);
      marcadorOrigenRef.current = null;
    }

    const iconoTaller = L.divIcon({
      className: "eco-pin-taller",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `
        <div style="position:relative;width:34px;height:34px;user-select:none;">
          <div style="position:absolute;bottom:36px;left:50%;transform:translateX(-50%);width:max-content;white-space:nowrap;background:#18181B;color:#FFFFFF;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;border:1.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.28);pointer-events:none;">
            Taller
          </div>
          <div style="width:30px;height:30px;margin:2px;border-radius:999px;background:#18181B;border:2.5px solid #FFFFFF;box-shadow:0 3px 8px rgba(0,0,0,0.32);display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        </div>
      `,
    });

    marcadorOrigenRef.current = L.marker([origen.lat, origen.lng], {
      icon: iconoTaller,
      interactive: !modoDibujoPoligono,
    })
      .bindTooltip(`${origenNombre} (Punto de partida)`, { direction: "top", offset: [0, -20] })
      .addTo(map);
  }, [estadoCarga, origen.lat, origen.lng, origenNombre, modoDibujoPoligono]);

  // Actualizar marcador de destino con pin SVG de alta visibilidad y punta exacta (sin hacer zoom-out)
  const destinoLat = destino?.lat;
  const destinoLng = destino?.lng;

  useEffect(() => {
    if (estadoCarga !== "listo" || !mapaRef.current || !window.L) return;
    const L = window.L;
    const map = mapaRef.current;

    const tieneDestino =
      typeof destinoLat === "number" &&
      typeof destinoLng === "number" &&
      Number.isFinite(destinoLat) &&
      Number.isFinite(destinoLng);

    if (!tieneDestino) {
      if (marcadorDestinoRef.current) {
        map.removeLayer(marcadorDestinoRef.current);
        marcadorDestinoRef.current = null;
        estadoPinDestinoRef.current = null;
      }
      return;
    }

    const arrastrable = esSeleccionable;
    const interactivo = !modoDibujoPoligono;

    // Si el marcador ya existe con la misma configuración, solo mover su coordenada sin recrear el DOM
    if (
      marcadorDestinoRef.current &&
      estadoPinDestinoRef.current &&
      estadoPinDestinoRef.current.arrastrable === arrastrable &&
      estadoPinDestinoRef.current.interactivo === interactivo
    ) {
      marcadorDestinoRef.current.setLatLng([destinoLat, destinoLng]);
      return;
    }

    if (marcadorDestinoRef.current) {
      map.removeLayer(marcadorDestinoRef.current);
      marcadorDestinoRef.current = null;
    }

    const etiquetaPin = arrastrable ? "Punto de entrega · arrastrar" : "Punto de entrega";

    const iconoEntrega = L.divIcon({
      className: "eco-pin-entrega",
      iconSize: [52, 64],
      iconAnchor: [26, 56],
      html: `
        <div style="position:relative;width:52px;height:64px;user-select:none;">
          <div style="position:absolute;bottom:62px;left:50%;transform:translateX(-50%);width:max-content;white-space:nowrap;background:#0F172A;color:#FFFFFF;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.01em;border:1.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(15,23,42,0.34);pointer-events:none;">
            ${etiquetaPin}
          </div>
          <span class="eco-pin-pulso" style="position:absolute;left:26px;top:56px;width:22px;height:22px;border-radius:999px;background:rgba(225,29,72,0.32);border:1.5px solid rgba(225,29,72,0.7);transform:translate(-50%,-50%);pointer-events:none;"></span>
          <span style="position:absolute;left:26px;top:56px;width:9px;height:9px;border-radius:999px;background:#BE123C;border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(0,0,0,0.45);transform:translate(-50%,-50%);pointer-events:none;"></span>
          <div class="eco-pin-cuerpo" style="position:absolute;left:5px;top:6px;width:42px;height:50px;filter:drop-shadow(0 5px 10px rgba(15,23,42,0.38));">
            <svg width="42" height="50" viewBox="0 0 42 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 2C10.5 2 2 10.5 2 21C2 33.4 21 48 21 48C21 48 40 33.4 40 21C40 10.5 31.5 2 21 2Z" fill="#E11D48" stroke="#FFFFFF" stroke-width="2.6" stroke-linejoin="round"/>
              <circle cx="21" cy="20" r="9.5" fill="#FFFFFF"/>
              <circle cx="21" cy="20" r="3.6" fill="#E11D48"/>
              <line x1="21" y1="8.5" x2="21" y2="13" stroke="#E11D48" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="21" y1="27" x2="21" y2="31.5" stroke="#E11D48" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="9.5" y1="20" x2="14" y2="20" stroke="#E11D48" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="28" y1="20" x2="32.5" y2="20" stroke="#E11D48" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      `,
    });

    const marker = L.marker([destinoLat, destinoLng], {
      icon: iconoEntrega,
      draggable: arrastrable,
      interactive: interactivo,
      zIndexOffset: 600,
    }).addTo(map);

    marker.on("dragend", () => {
      interaccionUsuarioRef.current = true;
      const pos = marker.getLatLng();
      if (pos && callbackPuntoRef.current) {
        const lat = Number(pos.lat.toFixed(6));
        const lng = Number(pos.lng.toFixed(6));
        const zoomActual = map.getZoom();
        map.setView([lat, lng], zoomActual, { animate: true });
        callbackPuntoRef.current({ lat, lng });
      }
    });

    marcadorDestinoRef.current = marker;
    estadoPinDestinoRef.current = { arrastrable, interactivo };
  }, [estadoCarga, destinoLat, destinoLng, esSeleccionable, modoDibujoPoligono]);

  // Dibujar ruta vial OSRM sin modificar el zoom ni mover la cámara del usuario
  useEffect(() => {
    if (estadoCarga !== "listo" || !capaRutaRef.current || !window.L) return;
    const L = window.L;
    capaRutaRef.current.clearLayers();

    if (rutaGeometria && rutaGeometria.length >= 2) {
      L.polyline(rutaGeometria, {
        color: "#18181B",
        weight: 3.5,
        opacity: 0.75,
        dashArray: "6, 6",
        interactive: false,
      }).addTo(capaRutaRef.current);
    }
  }, [estadoCarga, rutaGeometria]);

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
    <div style={{ position: "relative", width: "100%", height: altoFinal }}>
      <div
        ref={contenedorRef}
        className={esSeleccionable ? "eco-mapa-seleccionable" : undefined}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: altoFinal === "100%" ? 0 : "10px",
          border: modoDibujoPoligono ? "2px solid #DC2626" : "1px solid #E4E4E7",
          overflow: "hidden",
          background: "#F4F4F5",
          cursor: modoDibujoPoligono || esSeleccionable ? "crosshair" : "grab",
          zIndex: 1,
        }}
      />
      {estadoCarga === "listo" && esSeleccionable && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            maxWidth: "calc(100% - 62px)",
            background: "rgba(15, 23, 42, 0.86)",
            color: "#FFFFFF",
            padding: "5px 11px",
            borderRadius: "999px",
            fontSize: "0.72rem",
            fontWeight: 700,
            boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
            pointerEvents: "none",
            zIndex: 450,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            backdropFilter: "blur(4px)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: "#FB7185",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {destino
              ? "Toca otro punto o arrastra el pin rojo para ajustar"
              : "Toca la calle exacta de entrega en el mapa"}
          </span>
        </div>
      )}
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
