"use client";

import React, { useEffect, useState } from "react";

const CLAVE_SESION_SPLASH = "tinkay_pwa_splash_v2";
const DURACION_TOTAL_MS = 2750;
const INICIO_SALIDA_MS = 2300;

/**
 * Pantalla animada de bienvenida para la app instalada (PWA standalone) de Tinkay.
 * Muestra el ícono de la caja de regalo abriéndose con un bouquet de rosas saliendo
 * acompañado del nuevo logotipo Tinkay.
 *
 * - En app instalada (standalone): se reproduce automáticamente una vez por sesión.
 * - En navegador web: se puede previsualizar agregando `?splash=1` a cualquier URL.
 */
export function SplashAnimadoTinkay() {
  const [visible, setVisible] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const forzarPreview = params.get("splash") === "1";

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const esStandalone =
      (typeof window.matchMedia === "function" &&
        (window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(display-mode: fullscreen)").matches)) ||
      nav.standalone === true;

    if (!esStandalone && !forzarPreview) return;

    if (!forzarPreview) {
      try {
        if (window.sessionStorage.getItem(CLAVE_SESION_SPLASH) === "1") {
          return;
        }
        window.sessionStorage.setItem(CLAVE_SESION_SPLASH, "1");
      } catch {
        // Continuar aunque sessionStorage esté restringido
      }
    }

    setVisible(true);

    const tSalida = window.setTimeout(() => {
      setSaliendo(true);
    }, INICIO_SALIDA_MS);

    const tCerrar = window.setTimeout(() => {
      setVisible(false);
      setSaliendo(false);
    }, DURACION_TOTAL_MS);

    return () => {
      window.clearTimeout(tSalida);
      window.clearTimeout(tCerrar);
    };
  }, []);

  const cerrarAhora = () => {
    setSaliendo(true);
    window.setTimeout(() => {
      setVisible(false);
      setSaliendo(false);
    }, 260);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Bienvenida Tinkay"
      onClick={cerrarAhora}
      className={saliendo ? "tinkay-splash-overlay saliendo" : "tinkay-splash-overlay"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at 50% 42%, #FFFDF9 0%, #FAF7F2 58%, #F2EAE0 100%)",
        cursor: "pointer",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <style>{`
        .tinkay-splash-overlay {
          opacity: 1;
          transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .tinkay-splash-overlay.saliendo {
          opacity: 0;
          pointer-events: none;
        }

        @keyframes tinkayCajaEntrada {
          0% { opacity: 0; transform: translateY(22px) scale(0.84); }
          45% { opacity: 1; transform: translateY(-4px) scale(1.03); }
          70% { transform: translateY(2px) scale(0.98, 1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes tinkayTapaAbrir {
          0%, 26% { transform: translate(0px, 0px) rotate(0deg); }
          36% { transform: translate(0px, 2px) rotate(0deg); }
          68% { transform: translate(-24px, -30px) rotate(-26deg); }
          100% { transform: translate(-22px, -26px) rotate(-23deg); }
        }

        @keyframes tinkayBouquetSalir {
          0%, 34% { opacity: 0; transform: translateY(58px) scale(0.42); }
          52% { opacity: 1; }
          78% { opacity: 1; transform: translateY(-5px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }

        @keyframes tinkayDestello {
          0%, 40% { opacity: 0; transform: scale(0.3); }
          66% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.2; transform: scale(0.85) translateY(-10px); }
        }

        @keyframes tinkayPetaloFlotarA {
          0%, 46% { opacity: 0; transform: translate(0px, 18px) rotate(0deg) scale(0.5); }
          65% { opacity: 0.95; }
          100% { opacity: 0; transform: translate(-26px, -34px) rotate(-42deg) scale(1); }
        }

        @keyframes tinkayPetaloFlotarB {
          0%, 50% { opacity: 0; transform: translate(0px, 16px) rotate(0deg) scale(0.5); }
          68% { opacity: 0.95; }
          100% { opacity: 0; transform: translate(28px, -38px) rotate(48deg) scale(1); }
        }

        @keyframes tinkayLogoRevelar {
          0%, 48% { opacity: 0; transform: translateY(14px) scale(0.94); }
          82% { opacity: 1; transform: translateY(0px) scale(1); }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }

        @keyframes tinkaySombraPulso {
          0%, 26% { transform: scaleX(0.85); opacity: 0.14; }
          65% { transform: scaleX(1.06); opacity: 0.22; }
          100% { transform: scaleX(1); opacity: 0.18; }
        }

        .tinkay-splash-escena {
          animation: tinkayCajaEntrada 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .tinkay-splash-tapa {
          transform-box: fill-box;
          transform-origin: 18% 92%;
          animation: tinkayTapaAbrir 1.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .tinkay-splash-bouquet {
          transform-box: fill-box;
          transform-origin: 50% 95%;
          animation: tinkayBouquetSalir 1.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .tinkay-splash-destello {
          transform-box: fill-box;
          transform-origin: center;
          animation: tinkayDestello 1.85s ease-out forwards;
        }
        .tinkay-splash-petalo-a {
          transform-box: fill-box;
          transform-origin: center;
          animation: tinkayPetaloFlotarA 1.95s ease-out forwards;
        }
        .tinkay-splash-petalo-b {
          transform-box: fill-box;
          transform-origin: center;
          animation: tinkayPetaloFlotarB 2.05s ease-out forwards;
        }
        .tinkay-splash-logo-wrap {
          animation: tinkayLogoRevelar 1.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .tinkay-splash-sombra {
          transform-box: fill-box;
          transform-origin: center;
          animation: tinkaySombraPulso 1.5s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .tinkay-splash-escena,
          .tinkay-splash-tapa,
          .tinkay-splash-bouquet,
          .tinkay-splash-destello,
          .tinkay-splash-petalo-a,
          .tinkay-splash-petalo-b,
          .tinkay-splash-logo-wrap,
          .tinkay-splash-sombra {
            animation: none !important;
          }
          .tinkay-splash-tapa {
            transform: translate(-22px, -26px) rotate(-23deg);
          }
        }
      `}</style>

      {/* Escena vectorial: Caja de regalo Tinkay abriéndose + Bouquet de rosas */}
      <div
        className="tinkay-splash-escena"
        style={{
          width: "216px",
          height: "236px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <svg
          viewBox="0 0 220 240"
          width="216"
          height="236"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="tinkayAuraRosa" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F8DCE4" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tinkayRosaProfunda" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#9F1239" />
            </linearGradient>
            <linearGradient id="tinkayRosaSuave" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
            <linearGradient id="tinkayHoja" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4A7856" />
              <stop offset="100%" stopColor="#1B3B28" />
            </linearGradient>
            <clipPath id="tinkayRecorteSobreCaja">
              <rect x="0" y="0" width="220" height="145" />
            </clipPath>
          </defs>

          {/* Resplandor editorial suave detrás de la caja */}
          <circle cx="110" cy="116" r="88" fill="url(#tinkayAuraRosa)" />

          {/* Sombra base */}
          <ellipse
            className="tinkay-splash-sombra"
            cx="110"
            cy="218"
            rx="46"
            ry="7"
            fill="#1B272B"
            opacity="0.16"
          />

          {/* Pétalos flotantes y destellos dorados */}
          <g className="tinkay-splash-petalo-a">
            <path
              d="M78 72 C72 64, 82 56, 89 63 C93 68, 86 76, 78 72 Z"
              fill="#F43F5E"
            />
          </g>
          <g className="tinkay-splash-petalo-b">
            <path
              d="M142 68 C149 60, 158 67, 152 75 C147 80, 139 74, 142 68 Z"
              fill="#FB7185"
            />
          </g>
          <g className="tinkay-splash-destello">
            <path
              d="M58 58 L60.5 64.5 L67 67 L60.5 69.5 L58 76 L55.5 69.5 L49 67 L55.5 64.5 Z"
              fill="#C69B4B"
            />
            <path
              d="M164 52 L166 57 L171 59 L166 61 L164 66 L162 61 L157 59 L162 57 Z"
              fill="#C69B4B"
            />
            <circle cx="110" cy="34" r="2.6" fill="#C69B4B" />
          </g>

          {/* Bouquet de Rosas saliendo desde el interior de la caja */}
          <g clipPath="url(#tinkayRecorteSobreCaja)">
            <g className="tinkay-splash-bouquet">
              {/* Tallos verdes */}
              <path
                d="M110 156 L110 92 M110 154 L88 102 M110 154 L132 102 M110 154 L76 116 M110 154 L144 116"
                stroke="#2F5239"
                strokeWidth="3.2"
                strokeLinecap="round"
              />

              {/* Hojas botánicas izquierda y derecha */}
              <path
                d="M84 128 C66 122, 58 108, 66 96 C78 100, 88 112, 84 128 Z"
                fill="url(#tinkayHoja)"
              />
              <path
                d="M136 128 C154 122, 162 108, 154 96 C142 100, 132 112, 136 128 Z"
                fill="url(#tinkayHoja)"
              />
              <path
                d="M95 104 C82 88, 86 72, 98 68 C106 78, 106 94, 95 104 Z"
                fill="#3F6A4B"
              />
              <path
                d="M125 104 C138 88, 134 72, 122 68 C114 78, 114 94, 125 104 Z"
                fill="#3F6A4B"
              />
              <path
                d="M74 134 C58 134, 52 124, 58 115 C68 116, 75 124, 74 134 Z"
                fill="#24432F"
              />
              <path
                d="M146 134 C162 134, 168 124, 162 115 C152 116, 145 124, 146 134 Z"
                fill="#24432F"
              />

              {/* Gypsophila (lluvia blanca sutil) */}
              <circle cx="70" cy="92" r="3" fill="#FFFDF9" stroke="#E7DFD3" strokeWidth="1" />
              <circle cx="150" cy="92" r="3" fill="#FFFDF9" stroke="#E7DFD3" strokeWidth="1" />
              <circle cx="94" cy="64" r="2.6" fill="#FFFDF9" stroke="#E7DFD3" strokeWidth="1" />
              <circle cx="128" cy="64" r="2.6" fill="#FFFDF9" stroke="#E7DFD3" strokeWidth="1" />

              {/* Rosa trasera izquierda */}
              <g transform="translate(82 96)">
                <circle r="17" fill="#BE123C" />
                <circle cx="-3" cy="-2" r="12" fill="#E11D48" />
                <path
                  d="M-6 2 C-8 -5, 2 -9, 6 -3 C9 2, 2 7, -2 4 C-4 2, -1 -2, 2 -1"
                  stroke="#FFE4E6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Rosa trasera derecha */}
              <g transform="translate(138 96)">
                <circle r="17" fill="#BE123C" />
                <circle cx="2" cy="-2" r="12" fill="#F43F5E" />
                <path
                  d="M-5 3 C-7 -4, 2 -8, 6 -2 C8 3, 2 7, -2 4 C-4 2, -1 -2, 2 -1"
                  stroke="#FFE4E6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Rosa lateral izquierda baja */}
              <g transform="translate(88 122)">
                <circle r="15" fill="url(#tinkayRosaSuave)" />
                <path
                  d="M-5 2 C-6 -4, 2 -7, 5 -2 C7 2, 2 5, -1 3"
                  stroke="#FFF1F2"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Rosa lateral derecha baja */}
              <g transform="translate(132 122)">
                <circle r="15" fill="url(#tinkayRosaSuave)" />
                <path
                  d="M-5 2 C-6 -4, 2 -7, 5 -2 C7 2, 2 5, -1 3"
                  stroke="#FFF1F2"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Rosa central protagónica */}
              <g transform="translate(110 86)">
                <circle r="21" fill="url(#tinkayRosaProfunda)" />
                <circle cx="0" cy="-1" r="15.5" fill="#E11D48" />
                <circle cx="1" cy="-2" r="10.5" fill="#F43F5E" />
                <path
                  d="M-8 3 C-10 -6, 3 -12, 9 -4 C12 2, 4 9, -2 6 C-6 4, -3 -3, 2 -2 C5 -1, 4 3, 1 3"
                  stroke="#FFE4E6"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Rosa frontal centro */}
              <g transform="translate(110 116)">
                <circle r="17.5" fill="#D91B49" />
                <circle cx="0" cy="-1" r="12" fill="#FB7185" />
                <path
                  d="M-6 2 C-7 -4, 2 -8, 6 -2 C8 2, 3 6, -1 4 C-3 2, -1 -2, 2 -1"
                  stroke="#FFF1F2"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            </g>
          </g>

          {/* Cuerpo inferior de la Caja de Regalo (fiel al nuevo ícono Tinkay) */}
          <g>
            {/* Interior oscuro visible al abrirse */}
            <rect x="75" y="136" width="70" height="8" rx="3" fill="#E9DFD3" />
            {/* Cuerpo principal blanco cálido con borde #1B272B */}
            <path
              d="M75 139 H145 V201 C145 207 140 212 134 212 H86 C80 212 75 207 75 201 Z"
              fill="#FAF7F2"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinejoin="round"
            />
            {/* Cinta vertical con curva inferior izquierda característica del ícono Tinkay */}
            <path
              d="M97 139 V194 C97 204 103 212 113 212 H123 V139"
              fill="#FAF7F2"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Tapa + Lazo superior de la Caja de Regalo (animada abriéndose) */}
          <g className="tinkay-splash-tapa">
            {/* Lazo izquierdo y derecho */}
            <path
              d="M110 114 C96 114, 81 108, 83 97 C85 88, 99 93, 110 111 Z"
              fill="#FAF7F2"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinejoin="round"
            />
            <path
              d="M110 114 C124 114, 139 108, 137 97 C135 88, 121 93, 110 111 Z"
              fill="#FAF7F2"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinejoin="round"
            />
            {/* Borde superior fino de la tapa */}
            <path
              d="M77 122 C77 117, 81 114, 86 114 H134 C139 114, 143 117, 143 122"
              fill="#FAF7F2"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            {/* Banda de la tapa */}
            <rect
              x="69"
              y="121"
              width="82"
              height="19"
              rx="4.5"
              fill="#FAF7F2"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinejoin="round"
            />
            {/* Cinta continua atravesando la tapa */}
            <rect
              x="97"
              y="114"
              width="26"
              height="26"
              fill="#FAF7F2"
            />
            <path
              d="M97 121 V140 M123 121 V140"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            <line
              x1="86"
              y1="114"
              x2="134"
              y2="114"
              stroke="#1B272B"
              strokeWidth="4.6"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {/* Logotipo oficial Tinkay debajo de la animación */}
      <div
        className="tinkay-splash-logo-wrap"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          marginTop: "6px",
        }}
      >
        <img
          src="/img/logo/tinkay-logo.png?v=2"
          alt="Tinkay Flores y Eventos"
          style={{
            height: "54px",
            width: "auto",
            maxWidth: "220px",
            objectFit: "contain",
            display: "block",
          }}
        />
        <span
          style={{
            fontSize: "0.78rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#57524C",
            fontWeight: 600,
          }}
        >
          Flores con historia · Quito
        </span>
      </div>
    </div>
  );
}
