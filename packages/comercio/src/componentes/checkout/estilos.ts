// Estilos del checkout (TRQ-ADM-004). Viven aquí y no en una hoja global
// porque el componente es de plataforma y lo montan las 4 apps; todas las
// clases y animaciones llevan el prefijo `ckt-` para no chocar con las suyas.
//
// La apariencia NO se comparte entre productos: cada app define sus colores
// con las variables `--ckt-*` en su propia hoja (tranqi-web lo hace en
// globals.css con violeta, menta y naranja). Sin ellas se ven los valores de
// respaldo, neutros. El naranja/alerta se reserva a lo urgente: datos que
// faltan y pago rechazado.
export const ESTILOS_CHECKOUT = `
.ckt-velo {
  --c-acento: var(--ckt-acento, #2563EB);
  --c-acento-hondo: var(--ckt-acento-hondo, #1E40AF);
  --c-acento-claro: var(--ckt-acento-claro, #60A5FA);
  --c-acento-tenue: var(--ckt-acento-tenue, #EEF2FF);
  --c-resumen: var(--ckt-resumen, #0F172A);
  --c-positivo: var(--ckt-positivo, #BBF7D0);
  --c-positivo-hondo: var(--ckt-positivo-hondo, #166534);
  --c-positivo-tenue: var(--ckt-positivo-tenue, #F0FDF4);
  --c-alerta: var(--ckt-alerta, #EA580C);
  --c-alerta-tenue: var(--ckt-alerta-tenue, #FFF1EA);
  --c-chip: var(--ckt-chip, #FACC15);
  --c-tinta: #141019;
  --c-gris-70: #4B4556;
  --c-gris-50: #736C81;
  --c-gris-30: #A9A3B4;
  --c-linea: #E6E2ED;
  --c-linea-suave: #F0EDF5;
  --c-papel: #F7F6FA;
  --c-blanco: #FFFFFF;
  --c-suave: cubic-bezier(.16, 1, .3, 1);
  --c-rebote: cubic-bezier(.34, 1.56, .64, 1);

  position: fixed; inset: 0; z-index: 9999;
  background: rgba(20, 16, 25, .55);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: grid; place-items: center; padding: 16px;
  font-family: inherit; color: var(--c-tinta); font-size: 15px; line-height: 1.5;
  -webkit-font-smoothing: antialiased; text-align: left;
  animation: ckt-aparecer .35s ease both;
}
.ckt-velo *, .ckt-velo *::before, .ckt-velo *::after { box-sizing: border-box; }
/* Reinicios con :where(): pesan como una sola clase, así ganan a los estilos
   de etiqueta de la app y pierden ante cualquier regla propia del checkout. */
.ckt-velo :where(h2, h3, h4, p, ol, ul, aside, article, fieldset) { margin: 0; padding: 0; scroll-snap-align: none; }
.ckt-velo :where(button, input) { font: inherit; color: inherit; }
.ckt-velo button { cursor: pointer; }
.ckt-velo button:disabled { cursor: not-allowed; opacity: .6; }
.ckt-velo :focus-visible { outline: 3px solid var(--c-acento-claro); outline-offset: 2px; }
.ckt-velo svg { flex: none; }
@keyframes ckt-aparecer { from { opacity: 0; } }

.ckt-caja {
  /* Las apps estilan etiquetas sueltas (section, aside, p…): la caja no
     hereda nada de eso. */
  margin: 0; padding: 0; min-height: 0;
  width: min(960px, 100%);
  height: min(700px, calc(100vh - 32px));
  display: grid; grid-template-columns: 340px 1fr;
  background: var(--c-blanco);
  border-radius: 24px; overflow: hidden;
  box-shadow: 0 40px 80px -20px rgba(20, 10, 40, .45), 0 0 0 1px rgba(20, 10, 40, .06);
  /* backwards y no both: al terminar no queda ninguna transformación en la
     caja, que si no haría de bloque contenedor de la ventana de PLUX. */
  animation: ckt-subir .6s var(--c-suave) backwards .05s;
  outline: none;
}
@keyframes ckt-subir { from { opacity: 0; transform: translateY(28px) scale(.97); } }

/* ── Resumen ── */
.ckt-resumen {
  position: relative; overflow: hidden;
  background: var(--c-resumen); color: var(--c-blanco);
  padding: 28px; display: flex; flex-direction: column; gap: 22px;
}
.ckt-resumen > * { position: relative; z-index: 1; }
.ckt-cinta { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; pointer-events: none; }
.ckt-cinta path {
  fill: none; stroke: var(--c-acento); stroke-width: 34; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: ckt-trazar 1.6s var(--c-suave) forwards .3s;
}
@keyframes ckt-trazar { to { stroke-dashoffset: 0; } }
.ckt-marca { font-size: 22px; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
.ckt-etiqueta { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--c-positivo); }
.ckt-producto { display: flex; gap: 14px; align-items: flex-start; }
.ckt-producto-icono {
  flex: none; width: 46px; height: 46px; border-radius: 14px;
  background: rgba(255, 255, 255, .1); color: var(--c-positivo); display: grid; place-items: center;
}
.ckt-producto h2 { font-size: 19px; line-height: 1.2; font-weight: 800; color: var(--c-blanco); }
.ckt-producto p { font-size: 13px; color: rgba(255,255,255,.65); margin-top: 3px; }
.ckt-desglose { display: grid; gap: 8px; font-size: 14px; color: rgba(255,255,255,.75); }
.ckt-desglose > div { display: flex; justify-content: space-between; gap: 12px; }
.ckt-desglose .ckt-total {
  align-items: baseline; border-top: 1px dashed rgba(255,255,255,.22);
  padding-top: 14px; margin-top: 4px; color: var(--c-blanco);
}
.ckt-total > span { font-size: 14px; font-weight: 600; }
.ckt-total strong { font-size: 34px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.ckt-total strong small { font-size: 16px; font-weight: 700; margin-right: 2px; opacity: .7; }
.ckt-chip-pagado {
  align-self: flex-start; display: none; align-items: center; gap: 6px;
  background: var(--c-positivo); color: var(--c-positivo-hondo);
  font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  padding: 6px 12px; border-radius: 999px;
}
.ckt-resumen.es-pagado .ckt-chip-pagado { display: inline-flex; animation: ckt-pop .5s var(--c-rebote) both 2.6s; }
@keyframes ckt-pop { from { opacity: 0; transform: scale(.4); } }
.ckt-seguridad {
  margin-top: auto; display: flex; gap: 10px; align-items: center;
  font-size: 12px; color: rgba(255,255,255,.65);
  padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,.06);
}
.ckt-seguridad svg { color: var(--c-positivo); }
.ckt-ver-detalle { display: none; }

/* ── Flujo ── */
.ckt-flujo { position: relative; padding: 26px 34px 30px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
.ckt-cerrar {
  position: absolute; top: 18px; right: 18px; z-index: 2;
  width: 36px; height: 36px; border-radius: 10px; border: 0;
  background: transparent; color: var(--c-gris-50); display: grid; place-items: center;
  transition: background .2s, color .2s, transform .3s var(--c-rebote);
}
.ckt-cerrar:hover:not(:disabled) { background: var(--c-linea-suave); color: var(--c-tinta); transform: rotate(90deg); }

.ckt-pasos {
  --avance: 0;
  position: relative; display: grid; grid-template-columns: repeat(3, 1fr);
  list-style: none; margin: 4px 44px 28px 0; counter-reset: ckt-paso; flex: none;
}
.ckt-pasos::before, .ckt-pasos::after { content: ""; position: absolute; top: 13px; left: 14px; height: 3px; border-radius: 3px; }
.ckt-pasos::before { right: calc(33.33% - 14px); background: var(--c-linea); }
.ckt-pasos::after {
  width: calc(66.67% * var(--avance));
  background: linear-gradient(90deg, var(--c-acento), var(--c-acento-claro));
  transition: width .7s var(--c-suave);
}
.ckt-pasos li { counter-increment: ckt-paso; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 7px; font-size: 12px; font-weight: 600; color: var(--c-gris-50); }
.ckt-punto {
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  background: var(--c-blanco); border: 2px solid var(--c-linea); color: var(--c-gris-50);
  font-size: 12px; font-weight: 800;
  transition: background .3s, border-color .3s, color .3s, transform .4s var(--c-rebote);
}
.ckt-punto::before { content: counter(ckt-paso); }
.ckt-punto svg { display: none; }
.ckt-pasos li.es-actual { color: var(--c-tinta); }
.ckt-pasos li.es-actual .ckt-punto { border-color: var(--c-acento); color: var(--c-acento); transform: scale(1.12); box-shadow: 0 0 0 5px color-mix(in srgb, var(--c-acento) 12%, transparent); }
.ckt-pasos li.es-hecho { color: var(--c-tinta); }
.ckt-pasos li.es-hecho .ckt-punto { background: var(--c-acento); border-color: var(--c-acento); color: var(--c-blanco); }
.ckt-pasos li.es-hecho .ckt-punto::before { content: none; }
.ckt-pasos li.es-hecho .ckt-punto svg { display: block; }
.ckt-pasos li.es-hecho .ckt-punto svg path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: ckt-dibujar .4s ease forwards .15s; }
@keyframes ckt-dibujar { to { stroke-dashoffset: 0; } }

.ckt-alerta {
  flex: none; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 14px;
  padding: 10px 14px; border-radius: 12px; background: var(--c-alerta-tenue);
  border: 1px solid color-mix(in srgb, var(--c-alerta) 35%, transparent);
  color: var(--c-tinta); font-size: 13px; font-weight: 600;
  animation: ckt-pop .4s var(--c-rebote) both;
}
.ckt-alerta svg { color: var(--c-alerta); margin-top: 1px; }

.ckt-paso { display: flex; flex: 1 0 auto; flex-direction: column; position: relative; animation: ckt-entrar .5s var(--c-suave) backwards; }
.ckt-paso[hidden] { display: none !important; }
.ckt-paso[data-dir="atras"] { animation-name: ckt-entrar-atras; }
@keyframes ckt-entrar { from { opacity: 0; transform: translateX(28px); } }
@keyframes ckt-entrar-atras { from { opacity: 0; transform: translateX(-28px); } }
.ckt-paso h3 { font-size: 22px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; color: var(--c-tinta); }
.ckt-bajada { color: var(--c-gris-50); font-size: 14px; margin-top: 4px; }

/* Facturación */
.ckt-aviso {
  display: flex; gap: 10px; align-items: center; margin: 16px 0 14px;
  padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600;
  background: var(--c-positivo-tenue); border: 1px solid var(--c-positivo); color: var(--c-positivo-hondo);
}
.ckt-aviso.es-neutro { background: var(--c-papel); border-color: var(--c-linea); color: var(--c-gris-70); }
.ckt-rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ckt-ancho { grid-column: 1 / -1; }

.ckt-segmentos {
  --i: 0; position: relative; display: grid; grid-template-columns: repeat(3, 1fr);
  background: var(--c-linea-suave); border-radius: 12px; padding: 4px; border: 0; margin: 0; min-width: 0;
}
.ckt-segmentos::before {
  content: ""; position: absolute; top: 4px; bottom: 4px; left: 4px;
  width: calc((100% - 8px) / 3); border-radius: 9px; background: var(--c-blanco);
  box-shadow: 0 2px 8px rgba(20, 10, 40, .1);
  transform: translateX(calc(var(--i) * 100%)); transition: transform .45s var(--c-suave);
}
.ckt-segmentos input { position: absolute; opacity: 0; pointer-events: none; }
.ckt-segmentos label {
  position: relative; z-index: 1; text-align: center; padding: 9px 4px;
  font-size: 13px; font-weight: 700; color: var(--c-gris-50); cursor: pointer; transition: color .25s;
}
.ckt-segmentos input:checked + label { color: var(--c-acento); }
.ckt-segmentos input:focus-visible + label { outline: 3px solid var(--c-acento-claro); border-radius: 9px; }

.ckt-campo { position: relative; }
.ckt-campo input {
  width: 100%; height: 54px; padding: 22px 42px 6px 14px; margin: 0;
  border: 1.5px solid var(--c-linea); border-radius: 12px; background: var(--c-blanco);
  font-size: 15px; font-weight: 500; outline: none; box-shadow: none;
  transition: border-color .2s, box-shadow .2s;
}
.ckt-campo input:disabled { background: var(--c-papel); }
.ckt-campo label {
  position: absolute; left: 15px; top: 17px; pointer-events: none;
  font-size: 14px; color: var(--c-gris-50); transform-origin: left top;
  transition: transform .25s var(--c-suave), color .2s;
}
.ckt-campo input:focus { border-color: var(--c-acento); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c-acento) 12%, transparent); }
.ckt-campo input:focus + label,
.ckt-campo input:not(:placeholder-shown) + label { transform: translateY(-10px) scale(.78); color: var(--c-gris-70); font-weight: 600; }
.ckt-campo input:focus + label { color: var(--c-acento); }
.ckt-ok {
  position: absolute; right: 13px; top: 17px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--c-positivo); color: var(--c-positivo-hondo); display: grid; place-items: center;
  transform: scale(0); transition: transform .4s var(--c-rebote);
}
.ckt-ok path { stroke-dasharray: 24; stroke-dashoffset: 24; transition: stroke-dashoffset .35s ease .15s; }
.ckt-campo.es-valido .ckt-ok { transform: scale(1); }
.ckt-campo.es-valido .ckt-ok path { stroke-dashoffset: 0; }
.ckt-error { font-size: 12px; color: var(--c-alerta); font-weight: 600; margin: 5px 2px 0 !important; }
.ckt-campo.es-invalido input { border-color: var(--c-alerta); }
.ckt-campo.es-sacudido { animation: ckt-sacudir .45s ease; }
@keyframes ckt-sacudir { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }

.ckt-interruptor { position: relative; display: flex; gap: 12px; align-items: center; margin: 14px 0 0; cursor: pointer; font-size: 13px; color: var(--c-gris-70); }
.ckt-interruptor input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.ckt-pista { flex: none; width: 40px; height: 24px; border-radius: 999px; background: var(--c-linea); position: relative; transition: background .25s; }
.ckt-pista::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--c-blanco); box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .35s var(--c-rebote);
}
.ckt-interruptor input:checked + .ckt-pista { background: var(--c-acento); }
.ckt-interruptor input:checked + .ckt-pista::after { transform: translateX(16px); }
.ckt-interruptor input:focus-visible + .ckt-pista { outline: 3px solid var(--c-acento-claro); outline-offset: 2px; }
.ckt-interruptor b { display: block; color: var(--c-tinta); font-weight: 700; }

.ckt-pie { margin-top: auto; padding-top: 22px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.ckt-btn {
  position: relative; overflow: hidden; border: 0; border-radius: 14px;
  height: 54px; padding: 0 22px; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  font-size: 15px; font-weight: 700; text-decoration: none; white-space: nowrap;
  transition: transform .2s var(--c-suave), box-shadow .25s, background .2s;
}
.ckt-btn:active:not(:disabled) { transform: scale(.97); }
.ckt-btn-primario { flex: 1; background: var(--c-acento); color: var(--c-blanco) !important; box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--c-acento) 80%, transparent); }
.ckt-btn-primario:hover:not(:disabled) { background: var(--c-acento-hondo); transform: translateY(-1px); }
.ckt-btn-primario::after {
  content: ""; position: absolute; top: 0; bottom: 0; left: -60%; width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent);
  transform: skewX(-20deg); animation: ckt-brillo 3.2s ease-in-out infinite 1s;
}
.ckt-btn-primario:disabled::after { content: none; }
@keyframes ckt-brillo { 0%, 60% { left: -60%; } 100% { left: 130%; } }
.ckt-monto { padding-left: 12px; margin-left: 2px; border-left: 1px solid rgba(255,255,255,.3); font-variant-numeric: tabular-nums; }
.ckt-btn-secundario { background: var(--c-linea-suave); color: var(--c-tinta); }
.ckt-btn-secundario:hover:not(:disabled) { background: var(--c-linea); }
.ckt-btn-alerta { background: var(--c-alerta-tenue); color: var(--c-tinta); }
.ckt-girar { animation: ckt-girar .9s linear infinite; }

/* Pago */
.ckt-escenario { perspective: 900px; display: grid; place-items: center; padding: 22px 0 16px; }
.ckt-flotar { animation: ckt-flotar 4.5s ease-in-out infinite; }
@keyframes ckt-flotar { 50% { transform: translateY(-8px); } }
.ckt-tarjeta {
  position: relative; width: 310px; max-width: 100%; aspect-ratio: 1.586; border-radius: 18px; overflow: hidden;
  padding: 20px 22px; color: var(--c-blanco); display: flex; flex-direction: column; justify-content: space-between;
  background:
    radial-gradient(circle at 85% -10%, color-mix(in srgb, var(--c-acento-claro) 90%, transparent), transparent 55%),
    radial-gradient(circle at 0% 110%, color-mix(in srgb, var(--c-positivo) 35%, transparent), transparent 45%),
    linear-gradient(135deg, var(--c-acento) 0%, var(--c-resumen) 100%);
  box-shadow: 0 30px 50px -20px rgba(20, 10, 40, .55);
  transform-style: preserve-3d; transition: transform .25s ease-out;
}
.ckt-tarjeta::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.22) 45%, transparent 60%);
  background-size: 250% 100%; animation: ckt-reflejo 5s ease-in-out infinite;
}
@keyframes ckt-reflejo { 0%, 50% { background-position: 130% 0; } 100% { background-position: -130% 0; } }
.ckt-tarjeta-arriba { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 16px; }
.ckt-chip { width: 40px; height: 30px; border-radius: 6px; background: linear-gradient(135deg, #FFF59A, var(--c-chip) 45%, #C9B400); position: relative; }
.ckt-chip::before { content: ""; position: absolute; inset: 7px 0; border-top: 1px solid rgba(0,0,0,.25); border-bottom: 1px solid rgba(0,0,0,.25); }
.ckt-tarjeta-numero { font-size: 19px; letter-spacing: .14em; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ckt-tarjeta-abajo { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.ckt-tarjeta-abajo b { display: block; font-size: 13px; letter-spacing: .04em; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ckt-medios { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
.ckt-medios span { padding: 6px 12px; border-radius: 999px; background: var(--c-linea-suave); font-size: 12px; font-weight: 700; color: var(--c-gris-70); }
.ckt-medios button { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--c-linea); background: var(--c-blanco); font-size: 12px; font-weight: 700; color: var(--c-gris-70); }
.ckt-medios button:hover { border-color: var(--c-acento); color: var(--c-acento); }
.ckt-garantias { display: grid; gap: 10px; margin-top: 18px; }
.ckt-garantias > div { display: flex; gap: 12px; align-items: center; font-size: 13px; color: var(--c-gris-70); }
.ckt-garantias svg { width: 34px; height: 34px; padding: 8px; border-radius: 10px; background: var(--c-acento-tenue); color: var(--c-acento); }
.ckt-insignia { display: inline-flex; align-self: center; margin-top: 12px; padding: 4px 10px; border-radius: 999px; background: var(--c-alerta-tenue); color: var(--c-tinta); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.ckt-nota { font-size: 12px; color: var(--c-gris-50); }
.ckt-plux-zona { flex: 1; display: grid; gap: 8px; min-width: 200px; }
.ckt-plux-zona #ButtonPaybox { min-height: 48px; display: flex; justify-content: center; }

/* Procesando */
.ckt-procesando { align-items: center; text-align: center; justify-content: center; gap: 22px; }
.ckt-anillo { position: relative; width: 128px; height: 128px; }
.ckt-anillo .ckt-giro { width: 128px; height: 128px; animation: ckt-girar 1.4s linear infinite; }
.ckt-anillo circle { fill: none; stroke-width: 7; stroke-linecap: round; }
.ckt-anillo .ckt-fondo-anillo { stroke: var(--c-linea-suave); }
.ckt-anillo .ckt-arco { stroke: var(--c-acento); stroke-dasharray: 120 400; }
@keyframes ckt-girar { to { transform: rotate(360deg); } }
.ckt-candado {
  position: absolute; inset: 0; margin: auto; width: 54px; height: 54px; border-radius: 50%;
  background: var(--c-acento-tenue); color: var(--c-acento); display: grid; place-items: center;
  animation: ckt-latir 1.4s ease-in-out infinite;
}
@keyframes ckt-latir { 50% { transform: scale(1.08); box-shadow: 0 0 0 10px color-mix(in srgb, var(--c-acento) 8%, transparent); } }
.ckt-subpasos { list-style: none; display: grid; gap: 12px; text-align: left; width: min(340px, 100%); }
.ckt-subpasos li { display: flex; gap: 12px; align-items: center; font-size: 14px; color: var(--c-gris-30); transition: color .3s; }
.ckt-marca-sub {
  flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--c-linea);
  display: grid; place-items: center; transition: all .35s var(--c-rebote);
}
.ckt-marca-sub svg { opacity: 0; }
.ckt-subpasos li.es-activo { color: var(--c-tinta); font-weight: 600; }
.ckt-subpasos li.es-activo .ckt-marca-sub { border-color: var(--c-acento); border-top-color: transparent; animation: ckt-girar .8s linear infinite; }
.ckt-subpasos li.es-hecho { color: var(--c-gris-70); }
.ckt-subpasos li.es-hecho .ckt-marca-sub { background: var(--c-positivo); border-color: var(--c-positivo); color: var(--c-positivo-hondo); }
.ckt-subpasos li.es-hecho .ckt-marca-sub svg { opacity: 1; }
.ckt-pendiente { max-width: 400px; padding: 12px 14px; border-radius: 12px; background: var(--c-papel); font-size: 13px; color: var(--c-gris-70); }

/* Recibo */
.ckt-recibo-paso { align-items: center; }
.ckt-exito { display: flex; gap: 12px; align-items: center; align-self: stretch; margin-bottom: 18px; }
.ckt-exito-icono {
  flex: none; width: 44px; height: 44px; border-radius: 50%; background: var(--c-positivo); color: var(--c-positivo-hondo);
  display: grid; place-items: center; animation: ckt-pop .55s var(--c-rebote) both .1s;
}
.ckt-exito-icono path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: ckt-dibujar .45s ease forwards .45s; }
.ckt-impresora { position: relative; width: min(360px, 100%); }
.ckt-ranura {
  position: relative; z-index: 3; height: 16px; border-radius: 10px; margin: 0 -10px;
  background: linear-gradient(180deg, var(--c-acento-hondo), var(--c-resumen));
  box-shadow: inset 0 -5px 0 rgba(0,0,0,.35), 0 6px 14px -6px rgba(20, 10, 40, .5);
}
.ckt-ventana { position: relative; z-index: 2; margin-top: -8px; overflow: hidden; padding: 0 6px 20px; animation: ckt-golpe .25s ease 3.6s; }
@keyframes ckt-golpe { 40% { transform: translateY(3px); } }
.ckt-recibo {
  position: relative; background: var(--c-blanco); padding: 26px 22px 18px;
  box-shadow: 0 14px 30px -12px rgba(20, 10, 40, .3), 0 0 0 1px var(--c-linea-suave);
  font-size: 13px; color: var(--c-gris-70);
  transform: translateY(-101%);
  animation: ckt-imprimir 2.1s cubic-bezier(.45, .05, .35, 1) forwards .35s;
}
.ckt-recibo::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -12px; height: 12px;
  background:
    linear-gradient(135deg, var(--c-blanco) 50%, transparent 50%) 0 0 / 12px 12px repeat-x,
    linear-gradient(225deg, var(--c-blanco) 50%, transparent 50%) 0 0 / 12px 12px repeat-x;
  filter: drop-shadow(0 4px 3px rgba(20, 10, 40, .1));
}
@keyframes ckt-imprimir {
  0% { transform: translateY(-101%); }
  22% { transform: translateY(-74%); } 28% { transform: translateY(-72%); }
  50% { transform: translateY(-40%); } 56% { transform: translateY(-38%); }
  78% { transform: translateY(-10%); } 84% { transform: translateY(-8%); }
  100% { transform: translateY(0); }
}
.ckt-recibo-cabeza { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.ckt-recibo-cabeza .ckt-marca { font-size: 20px; color: var(--c-acento); }
.ckt-recibo-cabeza div { text-align: right; font-size: 11px; line-height: 1.4; }
.ckt-recibo-cabeza b { display: block; font-size: 12px; color: var(--c-tinta); text-transform: uppercase; letter-spacing: .08em; }
.ckt-corte { border: 0; border-top: 1.5px dashed var(--c-linea); margin: 12px 0; }
.ckt-fila { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
.ckt-fila b { color: var(--c-tinta); font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.ckt-fila small { display: block; font-size: 11px; color: var(--c-gris-50); }
.ckt-fila-total { align-items: baseline; color: var(--c-tinta); font-weight: 700; font-size: 14px; }
.ckt-fila-total strong { font-size: 26px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.ckt-codigo { display: block; width: 100%; height: 34px; margin: 22px 0 6px; color: var(--c-tinta); opacity: .85; }
.ckt-codigo-texto { text-align: center; font-size: 10px; letter-spacing: .2em; color: var(--c-gris-50); overflow-wrap: anywhere; }
.ckt-entra { opacity: 0; animation: ckt-linea .4s var(--c-suave) forwards; animation-delay: calc(2.3s + var(--i) * 70ms); }
@keyframes ckt-linea { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.ckt-sello {
  position: absolute; right: 12px; bottom: 40px; z-index: 2;
  border: 3px double var(--c-positivo-hondo); color: var(--c-positivo-hondo); border-radius: 10px;
  padding: 6px 12px 4px; text-align: center; background: color-mix(in srgb, var(--c-positivo) 35%, transparent);
  font-weight: 800; font-size: 20px; letter-spacing: .14em; line-height: 1;
  transform: rotate(-8deg); opacity: 0;
  animation: ckt-sellar .5s cubic-bezier(.5, 0, .75, 0) forwards 3.15s;
}
.ckt-sello small { display: block; font-size: 9px; letter-spacing: .12em; margin-top: 3px; font-weight: 700; }
@keyframes ckt-sellar {
  0% { opacity: 0; transform: rotate(-20deg) scale(2.4); }
  80% { opacity: 1; transform: rotate(-7deg) scale(.94); }
  100% { opacity: .92; transform: rotate(-8deg) scale(1); }
}
/* Oculto (y sin clics) hasta que el recibo termina de imprimirse y contar. */
.ckt-despues { align-self: stretch; opacity: 0; visibility: hidden; animation: ckt-despues .5s var(--c-suave) forwards 3.7s; }
@keyframes ckt-despues { from { opacity: 0; visibility: visible; transform: translateY(6px); } to { opacity: 1; visibility: visible; transform: none; } }
.ckt-solo-impresion { display: none; }
.ckt-que-sigue { margin-top: 8px; }
.ckt-que-sigue h4 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: var(--c-gris-50); margin-bottom: 12px; }
.ckt-linea-tiempo { list-style: none; display: grid; }
.ckt-linea-tiempo li { position: relative; display: flex; gap: 14px; padding-bottom: 16px; }
.ckt-linea-tiempo li:last-child { padding-bottom: 0; }
.ckt-linea-tiempo li::before { content: ""; position: absolute; left: 10px; top: 24px; bottom: 2px; width: 2px; background: var(--c-linea); }
.ckt-linea-tiempo li:last-child::before { content: none; }
.ckt-nodo { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--c-linea); background: var(--c-blanco); display: grid; place-items: center; }
.ckt-linea-tiempo .es-hecho .ckt-nodo { background: var(--c-positivo); border-color: var(--c-positivo); color: var(--c-positivo-hondo); }
.ckt-linea-tiempo .es-hecho::before { background: var(--c-positivo); }
.ckt-linea-tiempo .es-ahora .ckt-nodo { border-color: var(--c-acento); }
.ckt-linea-tiempo .es-ahora .ckt-nodo::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c-acento); animation: ckt-latido 1.6s ease-in-out infinite; }
@keyframes ckt-latido { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--c-acento) 15%, transparent); } }
.ckt-linea-tiempo b { display: block; font-size: 14px; color: var(--c-tinta); }
.ckt-linea-tiempo span { font-size: 13px; color: var(--c-gris-50); }

.ckt-confeti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; }
.ckt-confeti i {
  position: absolute; top: -12px; left: var(--x); width: 8px; height: 13px; border-radius: 2px;
  background: var(--c); opacity: 0;
  animation: ckt-caer var(--d) cubic-bezier(.25, .6, .4, 1) forwards var(--t);
}
.ckt-confeti i:nth-child(3n) { border-radius: 50%; width: 9px; height: 9px; }
@keyframes ckt-caer {
  0% { opacity: 1; transform: translate(0, 0) rotate(0); }
  100% { opacity: 0; transform: translate(var(--dx), 620px) rotate(var(--r)); }
}

/* Rechazo (urgente) */
.ckt-rechazo { align-items: center; justify-content: center; text-align: center; gap: 14px; }
.ckt-rechazo-icono {
  width: 72px; height: 72px; border-radius: 50%; background: var(--c-alerta-tenue); color: var(--c-alerta);
  display: grid; place-items: center; animation: ckt-pop .5s var(--c-rebote) both, ckt-sacudir .5s ease .5s;
}
.ckt-rechazo p { max-width: 400px; color: var(--c-gris-70); font-size: 14px; }
.ckt-consejos { text-align: left; list-style: none; display: grid; gap: 8px; padding: 14px 16px; border-radius: 14px; background: var(--c-papel); font-size: 13px; color: var(--c-gris-70); width: min(420px, 100%); }
.ckt-consejos li { display: flex; gap: 10px; }
.ckt-consejos li::before { content: "→"; color: var(--c-acento); font-weight: 800; }
.ckt-rechazo .ckt-pie { width: min(420px, 100%); margin-top: 8px; }

.ckt-solo-lectores { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 760px) {
  .ckt-velo { padding: 0; align-items: end; }
  .ckt-caja {
    grid-template-columns: 1fr; grid-template-rows: auto 1fr;
    height: 100dvh; border-radius: 0; animation-name: ckt-subir-hoja;
  }
  @keyframes ckt-subir-hoja { from { transform: translateY(100%); } }
  .ckt-resumen { padding: 16px 56px 16px 18px; gap: 12px; }
  .ckt-cinta, .ckt-resumen > .ckt-marca, .ckt-resumen > .ckt-etiqueta, .ckt-seguridad { display: none; }
  .ckt-producto h2 { font-size: 16px; }
  .ckt-producto-icono { width: 38px; height: 38px; border-radius: 12px; }
  .ckt-total strong { font-size: 26px; }
  .ckt-desglose > div:not(.ckt-total) { display: none; }
  .ckt-resumen.es-abierto .ckt-desglose > div:not(.ckt-total) { display: flex; }
  .ckt-desglose .ckt-total { border: 0; padding-top: 0; margin-top: 0; }
  .ckt-ver-detalle {
    display: inline-flex; align-self: flex-start; gap: 6px; align-items: center;
    background: none; border: 0; padding: 0; color: var(--c-positivo); font-size: 13px; font-weight: 700;
  }
  .ckt-ver-detalle svg { transition: transform .3s; }
  .ckt-resumen.es-abierto .ckt-ver-detalle svg { transform: rotate(180deg); }
  .ckt-flujo { padding: 18px 18px 22px; }
  .ckt-cerrar { top: 12px; right: 12px; color: rgba(255,255,255,.75); position: fixed; z-index: 20; }
  .ckt-cerrar:hover { background: rgba(255,255,255,.1); color: var(--c-blanco); }
  .ckt-pasos { margin-right: 0; margin-bottom: 20px; }
  .ckt-rejilla { grid-template-columns: 1fr; }
  .ckt-paso h3 { font-size: 19px; }
  .ckt-pie { position: sticky; bottom: -22px; background: var(--c-blanco); padding-bottom: 4px; }
  .ckt-recibo-paso .ckt-pie, .ckt-rechazo .ckt-pie { position: static; }
}

@media (prefers-reduced-motion: reduce) {
  .ckt-velo *, .ckt-velo *::before, .ckt-velo *::after, .ckt-velo {
    animation-duration: .01ms !important; animation-delay: 0s !important;
    animation-iteration-count: 1 !important; transition-duration: .01ms !important;
  }
  .ckt-confeti { display: none; }
}

@media print {
  body * { visibility: hidden !important; }
  /* Sin transformaciones ni recortes en los ancestros: si no, el recibo
     quedaría fijo dentro de la caja del modal y no en la página. */
  .ckt-velo, .ckt-caja, .ckt-flujo, .ckt-paso, .ckt-impresora, .ckt-ventana {
    animation: none !important; transform: none !important; overflow: visible !important;
    backdrop-filter: none !important; background: none !important; box-shadow: none !important;
  }
  .ckt-recibo, .ckt-recibo * { visibility: visible !important; }
  .ckt-recibo { position: fixed; left: 0; top: 0; width: 100%; transform: none !important; animation: none !important; box-shadow: none; }
  .ckt-recibo *, .ckt-sello { animation: none !important; opacity: 1 !important; }
  .ckt-solo-pantalla { display: none !important; }
  .ckt-solo-impresion { display: inline !important; }
}
`;
