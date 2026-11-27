// Codemod del tema oscuro (TRQ-040).
//
//   node scripts/tema-oscuro/codemod.mjs            → reescribe y regenera el CSS
//   node scripts/tema-oscuro/codemod.mjs --seco     → solo informa
//
// Cambia cada color literal que pinta interfaz por
//     var(--cf-1f1c19, #1F1C19)        (cf = fondo · ct = texto · cb = borde)
// El respaldo es el literal original: en las apps que no definen la variable
// (tinkay, fastfix, margaritas) y en el tema claro de tranqi NO cambia nada.
// tranqi define cada variable como light-dark(original, oscuro) en
// apps/tranqi-web/app/tema-oscuro.generado.css, que este script regenera
// a partir de los nombres que encuentra en el código (es idempotente: se
// puede volver a pasar sobre código nuevo).
//
// Qué NO toca, a propósito:
//  · literales fuera de una propiedad de color reconocible (llamadas como
//    doc.setTextColor('#..'), ctx.fillStyle = '#..', HTML de correos,
//    atributos SVG fill="#.." — ahí var() no funciona);
//  · nombres que el mismo fichero concatena con alfa (`${c}55`), corta
//    (.slice) o pasa a funciones de color: un var() ahí da NaN;
//  · claves que guardan datos de color (colorHex, colorPrimario, tema…);
//  · el texto cuyo fondo, en la misma regla, se queda igual en oscuro
//    (negro sobre amarillo sigue siendo negro).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { oscuro, aCss } from "./paleta.mjs";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../..");
const require = createRequire(path.join(RAIZ, "apps/tranqi-web/package.json"));
const ts = require("typescript");
// postcss no es dependencia directa: se toma el que trae Next
const postcss = createRequire(require.resolve("next/package.json"))("postcss");
const SECO = process.argv.includes("--seco");

const CARPETAS = [
  "apps/tranqi-web/app", "apps/tranqi-web/modulos",
  "packages/comercio/src", "packages/gestion-usuarios/src", "packages/identidad/src",
  "packages/notificaciones/src", "packages/configuracion-negocio/src", "packages/datagrid/src",
  "packages/agenda/src", "packages/agentes-ia/src", "packages/auditoria/src",
];
// no son interfaz: PDF, RIDE, correos, rutas API, canvas, impresión, landing
const EXCLUIR = [
  /\/api\//, /\.test\.tsx?$/, /pdf-[^/]*\.ts$/, /ride-sri\.ts$/, /servicioFirmaDigital\.ts$/,
  /notificar-usuario\.ts$/, /acciones-convenios\.ts$/, /clienteStorage\.ts$/, /evidenciaImagenGps\.ts$/,
  /LienzoDisenadorTarjeta\.tsx$/, /ModalImprimirTarjetaTaller\.tsx$/, /modulos\/landing\//,
  /tema-oscuro\.generado\.css$/,
];
const SALIDA = "apps/tranqi-web/app/tema-oscuro.generado.css";

// ── papel de cada propiedad ─────────────────────────────────────────────
function papelCss(prop) {
  const p = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // kebab → camel
  if (/^(background|backgroundColor|backgroundImage)$/.test(p)) return "fondo";
  if (/^(color|fill|stroke|caretColor|textDecorationColor|WebkitTextFillColor|webkitTextFillColor)$/.test(p)) return "texto";
  if (/^(border|outline)/.test(p)) return "borde";
  // anillos opacos (0 0 0 3px #E5E7EB) hacen de borde; las sombras translúcidas se quedan
  if (p === "boxShadow") return "sombra";
  return null;
}
// claves de datos (no CSS): se deduce por el nombre
const NO_ES_PINTURA = /hex|primari|secundari|tema|marca|confeti|grafic|serie|chart|logo|qr|pdf|impres|whatsapp|meta/i;
function papelNombre(nombre) {
  if (NO_ES_PINTURA.test(nombre)) return null;
  if (/fondo|bg|background/i.test(nombre)) return "fondo";
  if (/borde|border/i.test(nombre)) return "borde";
  if (/texto|text|color|icono|icon|tinta|fill|stroke/i.test(nombre)) return "texto";
  return null;
}
// claves que delatan un objeto de estilos (y no un mapa de datos)
const CLAVES_ESTILO = new Set(("display padding paddingTop paddingBottom paddingLeft paddingRight margin marginTop marginBottom " +
  "marginLeft marginRight fontSize fontWeight lineHeight borderRadius width height minWidth maxWidth minHeight maxHeight gap " +
  "position top left right bottom zIndex cursor alignItems justifyContent flexDirection flex boxShadow opacity transition " +
  "overflow textAlign letterSpacing textTransform whiteSpace gridTemplateColumns").split(" "));
// tokens de superficie de color que se quedan en oscuro (texto encima: se queda)
const TOKEN_FIJO = /var\(--(violeta|lavanda|amarillo|naranja|esmeralda|menta|lima|rosa|lila|acento|acento-hondo|exito|aviso|error|violeta-oscuro|violeta-tinta|esmeralda-tinta|menta-honda|ckt-acento|ckt-acento-hondo|ckt-resumen|ckt-alerta|ckt-chip|rail-[a-z]+)\)/;

// ── colores dentro de un texto ──────────────────────────────────────────
const YA = /var\(--c[ftb]-[0-9a-f]{6}(?:-a\d{3})?, (?:rgba?\([^)]*\)|var\([^)]*\)|[^)]+)\)/g;
// var(--token, #hex) va primero: o se respeta entero (token con su propia
// versión oscura) o se trata como el color del respaldo (constante de marca)
const COLOR = /var\(--[a-z0-9-]+,\s*(?:#[0-9a-fA-F]{3,6}|rgba?\([^)]*\)|white)\s*\)|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+|1\.0+)\s*)?\)|\bwhite\b(?!-)|var\(--(?:blanco|negro|violeta|lavanda|menta|esmeralda|lima|amarillo|rosa|naranja|lila|violeta-oscuro|violeta-tinta|esmeralda-tinta|menta-honda)\)/g;

// tokens que ya tienen light-dark() a mano en globals.css: no se envuelven
const TEMATIZADOS = /^(panel-[a-z-]+|naranja-tenue|naranja-texto|ckt-acento|texto[a-z0-9-]*|linea[a-z-]*|fondo-[a-z-]+|acento[a-z-]*|exito[a-z-]*|aviso[a-z-]*|error[a-z-]*|papel-cliente|ckt-[a-z-]+-tenue|rail-[a-z-]+)$/;
// constantes de marca (globals.css :root): no cambian con el tema, así que
// cuentan como su hex. var(--violeta) como texto sobre noche no se lee.
const MARCA = { blanco: "#FFFFFF", negro: "#111111", violeta: "#5000BA", lavanda: "#7866FF", menta: "#B1FBE3",
  esmeralda: "#0E6648", lima: "#D8FFB3", amarillo: "#FEE300", rosa: "#FEB9FF", naranja: "#FE5800", lila: "#D0BBE2",
  "violeta-oscuro": "#33007A", "violeta-tinta": "#1E0046", "esmeralda-tinta": "#083D2C", "menta-honda": "#056B57" };
function aRgba(t) {
  const m = t.match(/^var\(--([a-z-]+)\)$/);
  if (m && MARCA[m[1]]) return aRgba(MARCA[m[1]]);
  const v = t.match(/^var\(--[a-z0-9-]+,\s*(.+?)\s*\)$/);
  if (v) return aRgba(v[1]);
  if (t === "white") return [255, 255, 255, 1];
  if (t[0] === "#") {
    const h = t.length === 4 ? t.slice(1).split("").map((c) => c + c).join("") : t.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const n = t.match(/[\d.]+/g).map(Number);
  return [n[0], n[1], n[2], n[3] ?? 1];
}
const PREFIJO = { fondo: "cf", texto: "ct", borde: "cb" };
function nombreVar(papel, c) {
  const hex = c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
  return `--${PREFIJO[papel]}-${hex}${c[3] < 1 ? "-a" + String(Math.round(c[3] * 1000)).padStart(3, "0") : ""}`;
}
/** ¿todos los colores de este valor de fondo se quedan igual en oscuro? */
function fondoFijo(texto) {
  if (TOKEN_FIJO.test(texto)) return true;
  const ts_ = (texto.replace(YA, "").match(COLOR) || []);
  return ts_.length > 0 && ts_.every((t) => oscuro("fondo", aRgba(t)) === null);
}
/** Reescribe los colores de un texto con su variable de papel. */
function reescribir(texto, papel, stats) {
  const guardados = [];
  const sin = texto.replace(YA, (m) => { guardados.push(m); return `\u0000${guardados.length - 1}\u0000`; });
  const nuevo = sin.replace(COLOR, (t) => {
    const tok = t.match(/^var\(--([a-z0-9-]+),/);
    if (tok && TEMATIZADOS.test(tok[1])) return t;
    const c = aRgba(t);
    const p = papel === "sombra" ? (c[3] < 1 ? null : "borde") : papel;
    if (!p || oscuro(p, c) === null) return t;
    stats.cambios++;
    return `var(${nombreVar(p, c)}, ${t})`;
  });
  return nuevo.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[+i]);
}

// ── TS/TSX ──────────────────────────────────────────────────────────────
function nombreProp(n) {
  if (!n) return null;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  return null;
}
function ultimoSegmento(expr) {
  while (expr && (ts.isParenthesizedExpression(expr) || ts.isNonNullExpression(expr) || ts.isAsExpression(expr))) expr = expr.expression;
  if (!expr) return null;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isElementAccessExpression(expr) && ts.isStringLiteral(expr.argumentExpression)) return expr.argumentExpression.text;
  return null;
}
/** nombres que el fichero trata como hex de verdad (concatena alfa, corta, convierte) */
function contaminados(sf) {
  const set = new Set();
  const FUNC_COLOR = /hex|rgb|alpha|alfa|aclar|oscurec|mezcl|tint|contrast|luminan/i;
  const NOMBRE_COLOR = /color|hex|fondo|borde|bg|tinta/i;
  (function visita(n) {
    if (ts.isTemplateSpan(n) && /^[0-9a-fA-F]{2}(?![0-9a-zA-Z])/.test(n.literal.text)) {
      const s = ultimoSegmento(n.expression); if (s) set.add(s);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        ts.isStringLiteral(n.right) && /^[0-9a-fA-F]{2}$/.test(n.right.text)) {
      const s = ultimoSegmento(n.left); if (s) set.add(s);
    }
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const nombre = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      if (FUNC_COLOR.test(nombre) && !/^set[A-Z]/.test(nombre)) n.arguments.forEach((a) => { const s = ultimoSegmento(a); if (s) set.add(s); });
      if (ts.isPropertyAccessExpression(callee) && /^(slice|substring|substr|startsWith|replace|padStart|charAt)$/.test(callee.name.text)) {
        const s = ultimoSegmento(callee.expression); if (s && NOMBRE_COLOR.test(s)) set.add(s);
      }
    }
    if (ts.isJsxAttribute(n) && n.name.getText() === "value" && n.parent && /type="color"/.test(n.parent.getText())) {
      const e = n.initializer && ts.isJsxExpression(n.initializer) ? n.initializer.expression : null;
      const s = ultimoSegmento(e); if (s) set.add(s);
    }
    ts.forEachChild(n, visita);
  })(sf);
  return set;
}
function esObjetoEstilo(obj) {
  if (ts.isJsxExpression(obj.parent) && ts.isJsxAttribute(obj.parent.parent)) return true;
  return obj.properties.some((p) => ts.isPropertyAssignment(p) && CLAVES_ESTILO.has(nombreProp(p.name)));
}
/** Sube desde un literal hasta la propiedad o variable que le da papel. */
function destino(lit) {
  let n = lit, hijo = lit;
  for (;;) {
    const p = n.parent;
    if (!p) return null;
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p) ||
        (ts.SyntaxKind.SatisfiesExpression && p.kind === ts.SyntaxKind.SatisfiesExpression) ||
        ts.isTemplateSpan(p) || ts.isTemplateExpression(p)) { hijo = n; n = p; continue; }
    if (ts.isConditionalExpression(p)) { if (p.condition === n) return null; hijo = n; n = p; continue; }
    if (ts.isBinaryExpression(p)) {
      const k = p.operatorToken.kind;
      if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) { hijo = n; n = p; continue; }
      return null;
    }
    // hover a mano: e.currentTarget.style.background = "#F1F5F9"
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right === n &&
        ts.isPropertyAccessExpression(p.left) && ts.isPropertyAccessExpression(p.left.expression) && p.left.expression.name.text === "style")
      return { tipo: "estilo", nodo: p, nombre: p.left.name.text };
    if (ts.isPropertyAssignment(p) && p.initializer === n) return { tipo: "prop", nodo: p, nombre: nombreProp(p.name) };
    if (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name)) return { tipo: "var", nodo: p, nombre: p.name.text };
    return null;
  }
}

// OMITIDOS=fichero.tsv para revisar qué se dejó sin tocar y por qué nombre
const OMITIDOS = [];
let stats_;
function omitir(sf, n, nombre) {
  stats_.omitidos++;
  if (process.env.OMITIDOS) OMITIDOS.push(`${nombre ?? "-"}\t${sf.fileName.replace(/.*[\\/](packages|apps)[\\/]/, "$1/")}\t${n.parent.getText(sf).slice(0, 90).replace(/\s+/g, " ")}`);
}
function procesarTs(archivo, stats) {
  const src = readFileSync(archivo, "utf8");
  const sf = ts.createSourceFile(archivo, src, ts.ScriptTarget.Latest, true, archivo.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sucios = SUCIOS_GLOBAL; // un mapa exportado puede concatenarse con alfa en otro fichero
  const edits = [];
  (function visita(n) {
    const esLit = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ||
      n.kind === ts.SyntaxKind.TemplateHead || n.kind === ts.SyntaxKind.TemplateMiddle || n.kind === ts.SyntaxKind.TemplateTail;
    // CSS embebido: <style>{`.clase { background: #fff }`}</style>
    if (ts.isNoSubstitutionTemplateLiteral(n) && ts.isJsxExpression(n.parent) && ts.isJsxElement(n.parent.parent) &&
        n.parent.parent.openingElement.tagName.getText(sf) === "style") {
      const txt = n.getText(sf), css = txt.slice(1, -1);
      const nuevo = reescribirCss(css, stats);
      if (nuevo !== css) edits.push([n.getStart(sf), n.getStart(sf) + txt.length, "`" + nuevo + "`"]);
      return;
    }
    if (esLit && COLOR.test(n.getText(sf))) {
      COLOR.lastIndex = 0;
      // una parte de plantilla (`1px solid #E5E7EB ${x}`) cuelga de su TemplateExpression
      const base = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n
        : n.kind === ts.SyntaxKind.TemplateHead ? n.parent : n.parent.parent;
      const d = destino(base);
      if (d && d.nombre) {
        let papel = null;
        if (d.tipo === "prop") {
          const obj = d.nodo.parent;
          const css = papelCss(d.nombre);
          const estilo = ts.isObjectLiteralExpression(obj) && esObjetoEstilo(obj);
          // en un mapa de datos ({ color, bg }) o se convierte todo o nada: si una
          // clave está bloqueada, la otra no puede pasar a oscuro sola
          const bloqueado = !estilo && ts.isObjectLiteralExpression(obj) && obj.properties.some((q) => {
            const nq = ts.isPropertyAssignment(q) && nombreProp(q.name);
            return nq && sucios.has(nq) && (papelCss(nq) || papelNombre(nq));
          });
          if (bloqueado) papel = null;
          else if (css) papel = css;
          else papel = papelNombre(d.nombre);
          if (papel === "texto" && ts.isObjectLiteralExpression(obj)) {
            const fondo = obj.properties.find((p) => ts.isPropertyAssignment(p) &&
              (papelCss(nombreProp(p.name) || "") === "fondo" || papelNombre(nombreProp(p.name) || "") === "fondo"));
            if (fondo && fondoFijo(fondo.initializer.getText(sf))) { papel = "fijo"; stats.textoSobreColor++; }
          }
        } else if (d.tipo === "estilo") papel = papelCss(d.nombre);
        else if (!sucios.has(d.nombre)) papel = papelNombre(d.nombre);
        if (papel === "fijo") { /* texto sobre color que no cambia: se queda */ }
        else if (papel) {
          COLOR.lastIndex = 0;
          const ini = n.getStart(sf), txt = n.getText(sf);
          const nuevo = reescribir(txt, papel, stats);
          if (nuevo !== txt) edits.push([ini, ini + txt.length, nuevo]);
        } else omitir(sf, n, d && d.nombre);
      } else omitir(sf, n, d && d.nombre);
    }
    COLOR.lastIndex = 0;
    ts.forEachChild(n, visita);
  })(sf);
  if (!edits.length) return false;
  let out = src;
  for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + t + out.slice(b);
  if (!SECO) writeFileSync(archivo, out);
  return true;
}

// ── CSS ─────────────────────────────────────────────────────────────────
// el rail ya es oscuro en los dos temas, y el hero de /abogados es una foto
const SELECTOR_FIJO = /panel-nav|rail|cinta-rail|abg-hero|barra-asistente-cabecera/;
function procesarCss(archivo, stats) {
  const src = readFileSync(archivo, "utf8");
  const out = reescribirCss(src, stats);
  if (out !== src && !SECO) writeFileSync(archivo, out);
  return out !== src;
}
function reescribirCss(src, stats) {
  const raiz = postcss.parse(src);
  let cambio = false;
  raiz.walkRules((regla) => {
    if (SELECTOR_FIJO.test(regla.selector)) return;
    if (regla.parent?.type === "atrule" && /keyframes/.test(regla.parent.name)) return;
    const fondo = regla.nodes.find((d) => d.type === "decl" && papelCss(d.prop) === "fondo");
    const textoFijo = fondo && fondoFijo(fondo.value);
    regla.each((d) => {
      if (d.type !== "decl" || d.prop.startsWith("--")) return;
      let papel = papelCss(d.prop);
      if (!papel) return;
      if (papel === "texto" && textoFijo) { stats.textoSobreColor++; return; }
      const v = reescribir(d.value, papel, stats);
      if (v !== d.value) { d.value = v; cambio = true; }
    });
  });
  return cambio ? raiz.toString() : src;
}

// ── generar las variables ───────────────────────────────────────────────
function generar(archivos) {
  const nombres = new Set();
  const RE = /--(c[ftb])-([0-9a-f]{6})(?:-a(\d{3}))?\b/g;
  for (const f of archivos) for (const m of readFileSync(f, "utf8").matchAll(RE)) nombres.add(m[0]);
  const PAPEL = { cf: "fondo", ct: "texto", cb: "borde" };
  const lineas = [...nombres].sort().map((n) => {
    const [, pre, hex, a] = n.match(/--(c[ftb])-([0-9a-f]{6})(?:-a(\d{3}))?/);
    const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(a ? +a / 1000 : 1);
    const o = oscuro(PAPEL[pre], c) ?? c;
    return `  ${n}: light-dark(${aCss(c)}, ${aCss(o)});`;
  });
  const css = `/* GENERADO por scripts/tema-oscuro/codemod.mjs — no editar a mano.
   Cada variable es light-dark(color original, versión oscura según su papel:
   cf = fondo, ct = texto, cb = borde). Solo se resuelve oscura donde
   color-scheme es dark, es decir, dentro del panel con el tema oscuro
   (ver «Tema oscuro» en globals.css). ${lineas.length} variables. */
:root {
${lineas.join("\n")}
}
`;
  if (!SECO) writeFileSync(path.join(RAIZ, SALIDA), css);
  return lineas.length;
}

// ── main ────────────────────────────────────────────────────────────────
const archivos = execSync(`git ls-files ${CARPETAS.join(" ")}`, { cwd: RAIZ, encoding: "utf8" })
  .split("\n").filter((f) => /\.(tsx?|css)$/.test(f) && !EXCLUIR.some((r) => r.test(f)))
  .map((f) => path.join(RAIZ, f));
const SUCIOS_GLOBAL = new Set();
for (const f of archivos) if (!f.endsWith(".css")) {
  const src = readFileSync(f, "utf8");
  for (const n of contaminados(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS))) SUCIOS_GLOBAL.add(n);
}
console.error("contaminados:", [...SUCIOS_GLOBAL].sort().join(" "));
const stats = stats_ = { cambios: 0, omitidos: 0, textoSobreColor: 0, ficheros: 0 };
for (const f of archivos) {
  const ok = f.endsWith(".css") ? procesarCss(f, stats) : procesarTs(f, stats);
  if (ok) stats.ficheros++;
}
stats.variables = generar(archivos);
console.log(JSON.stringify(stats));
if (process.env.OMITIDOS) writeFileSync(process.env.OMITIDOS, OMITIDOS.join("\n"));
