const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3333;
const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_FILE = path.join(__dirname, '../gobernanza/productos/plataforma/especificacion-funcional.md');
const COMMENTS_FILE = path.join(__dirname, '../gobernanza/comentarios_revision.json');

let targetFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;

if (!fs.existsSync(COMMENTS_FILE)) {
  fs.mkdirSync(path.dirname(COMMENTS_FILE), { recursive: true });
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify([], null, 2), 'utf8');
}

function leerComentarios() {
  try {
    const data = fs.readFileSync(COMMENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function guardarComentarios(comentarios) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comentarios, null, 2), 'utf8');
}

function escanearArchivosMd(dir, lista = [], baseDir = ROOT_DIR) {
  try {
    const elementos = fs.readdirSync(dir, { withFileTypes: true });
    for (const elem of elementos) {
      if (elem.isDirectory()) {
        if (['node_modules', '.git', '.next', 'dist', 'build', 'Temp', '.turbo'].includes(elem.name)) {
          continue;
        }
        escanearArchivosMd(path.join(dir, elem.name), lista, baseDir);
      } else if (elem.isFile() && elem.name.endsWith('.md')) {
        const fullPath = path.join(dir, elem.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        lista.push({
          name: elem.name,
          relPath: relPath,
          fullPath: fullPath.replace(/\\/g, '/')
        });
      }
    }
  } catch (err) {}
  return lista;
}

function generarHTML(contenidoInicial, rutaInicial) {
  const fullPathInicial = path.resolve(rutaInicial).replace(/\\/g, '/');
  const filenameInicial = path.basename(rutaInicial);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visor Markdown Universal · Revisiones IA</title>
  
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-dark.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  
  <style>
    :root {
      --bg-principal: #0d1117;
      --bg-sidebar: #161b22;
      --border-color: #30363d;
      --text-color: #c9d1d9;
      --accent-color: #58a6ff;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-principal);
      color: var(--text-color);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    
    #sidebar {
      width: 420px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    
    .sidebar-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      background-color: #0d1117;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sidebar-header h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .search-file-box {
      width: 100%;
      background: #21262d;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 10px;
      color: #c9d1d9;
      font-size: 0.82rem;
      outline: none;
    }

    .file-select {
      width: 100%;
      background: #161b22;
      color: #c9d1d9;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 0.82rem;
      outline: none;
      cursor: pointer;
    }

    .sidebar-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      background-color: #0d1117;
    }

    .tab-btn {
      flex: 1;
      padding: 10px;
      background: transparent;
      border: none;
      color: #8b949e;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
    }

    .tab-btn.active {
      color: var(--accent-color);
      border-bottom-color: var(--accent-color);
    }

    .toc-toolbar {
      padding: 8px 12px;
      background-color: #0d1117;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .filter-comments-btn {
      background: #21262d;
      border: 1px solid var(--border-color);
      color: #8b949e;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s;
    }

    .filter-comments-btn:hover {
      border-color: #58a6ff;
      color: #58a6ff;
    }

    .filter-comments-btn.active {
      background: #1f6feb;
      border-color: #388bfd;
      color: #ffffff;
      box-shadow: 0 0 8px rgba(31, 111, 235, 0.5);
    }

    #toc-panel, #comments-panel {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    #toc ul { list-style: none; padding-left: 0; }
    #toc li { margin: 2px 0; }
    #toc a {
      color: #8b949e;
      text-decoration: none;
      font-size: 0.83rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      border-radius: 6px;
      line-height: 1.35;
      transition: background 0.15s, color 0.15s;
    }

    #toc a:hover { background-color: rgba(110, 118, 129, 0.15); color: var(--text-color); }
    #toc a.active {
      color: var(--accent-color);
      font-weight: 700;
      background-color: rgba(56, 139, 253, 0.15);
      border-left: 3px solid var(--accent-color);
    }

    #toc a.toc-has-comment {
      color: #388bfd !important;
      font-weight: 700 !important;
      background-color: rgba(56, 139, 253, 0.12) !important;
    }

    .toc-item.level-1 a { font-weight: 700; color: #c9d1d9; font-size: 0.86rem; margin-top: 6px; }
    .toc-item.level-2 a { font-weight: 600; color: #58a6ff; font-size: 0.84rem; }
    .toc-item.level-3 a { font-weight: 500; color: #8b949e; font-size: 0.80rem; }
    .toc-item.level-4 a { font-weight: 400; color: #8b949e; font-size: 0.77rem; }
    .toc-item.level-rule a { font-weight: 400; color: #79c0ff; font-size: 0.76rem; font-style: normal; }

    #toc a .comment-icon { opacity: 0.35; font-size: 0.8rem; margin-left: 6px; transition: opacity 0.2s; }
    #toc a .comment-icon:hover { opacity: 1; }

    #toc a .comment-icon.has-comments,
    .heading-comment-btn.has-comments {
      opacity: 1 !important;
      background-color: #1f6feb !important;
      color: #ffffff !important;
      border-radius: 12px !important;
      padding: 2px 8px !important;
      font-size: 0.75rem !important;
      font-weight: 800 !important;
      box-shadow: 0 0 12px rgba(31, 111, 235, 0.85) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      vertical-align: middle !important;
      margin-left: 8px !important;
    }

    .comment-card {
      background-color: #21262d;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.83rem;
      transition: border-color 0.2s;
    }

    .comment-card.atendido {
      border-color: #3fb950;
      background-color: rgba(46, 160, 67, 0.08);
    }

    .comment-card .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--accent-color);
      font-weight: 700;
      font-size: 0.78rem;
    }

    .status-badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
    }
    .status-pendiente { background-color: rgba(210, 153, 34, 0.2); color: #d29922; }
    .status-atendido { background-color: rgba(46, 160, 67, 0.25); color: #3fb950; }

    .comment-card .snippet {
      color: #8b949e;
      font-style: italic;
      border-left: 3px solid #d29922;
      padding-left: 8px;
      margin: 4px 0;
      font-size: 0.8rem;
      word-break: break-word;
    }

    .comment-card .text {
      color: #c9d1d9;
      line-height: 1.4;
      font-weight: 500;
      background-color: #161b22;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
    }

    .ai-summary-box {
      background-color: rgba(56, 139, 253, 0.1);
      border: 1px dashed var(--accent-color);
      border-radius: 6px;
      padding: 8px;
      font-size: 0.78rem;
      color: #58a6ff;
      margin-top: 4px;
    }

    .comment-card .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .comment-card-btn {
      background: #161b22;
      border: 1px solid var(--border-color);
      color: #c9d1d9;
      cursor: pointer;
      font-size: 0.76rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.15s;
    }

    .btn-view:hover { background-color: rgba(88, 166, 255, 0.2); color: #58a6ff; }
    .btn-diff { color: #58a6ff; border-color: #58a6ff; }
    .btn-diff:hover { background-color: rgba(88, 166, 255, 0.25); }
    .btn-accept { color: #3fb950; border-color: #2ea043; background-color: rgba(46,160,67,0.15); }
    .btn-accept:hover { background-color: #238636; color: #fff; }
    .btn-revert { color: #f85149; border-color: #da3633; background-color: rgba(218,54,51,0.15); }
    .btn-revert:hover { background-color: #da3633; color: #fff; }
    .btn-edit:hover { background-color: rgba(210, 153, 34, 0.2); color: #d29922; }
    .btn-del:hover { background-color: rgba(248, 81, 73, 0.2); color: #f85149; }

    #main-content {
      flex: 1;
      overflow-y: auto;
      padding: 80px 56px 40px;
      scroll-behavior: smooth;
      position: relative;
    }

    .markdown-body {
      background-color: transparent !important;
      max-width: 980px;
      margin: 0 auto;
      font-size: 15px;
    }

    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6,
    .markdown-body li[id^="rule-item-"] {
      scroll-margin-top: 95px !important;
    }

    .has-active-comment {
      background-color: rgba(31, 111, 235, 0.12) !important;
      border-left: 4px solid #1f6feb !important;
      padding-left: 8px !important;
      border-radius: 4px;
      transition: background-color 0.3s;
    }

    .heading-comment-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 8px;
      font-size: 0.85rem;
      opacity: 0.35;
      cursor: pointer;
      border: none;
      background: none;
      color: var(--accent-color);
      transition: opacity 0.2s, transform 0.2s;
    }

    .heading-comment-btn:hover {
      opacity: 1;
      transform: scale(1.25);
    }

    .top-bar {
      position: fixed;
      top: 0;
      left: 420px;
      right: 0;
      height: 64px;
      background-color: rgba(22, 27, 34, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px;
      z-index: 100;
    }

    .input-box {
      flex: 1;
      display: flex;
      align-items: center;
      background: #0d1117;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 10px;
    }

    .input-box input {
      flex: 1;
      background: transparent;
      border: none;
      color: #c9d1d9;
      font-size: 0.82rem;
      font-family: monospace;
      outline: none;
    }

    .doc-search-container {
      display: flex;
      align-items: center;
      background: #161b22;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 2px 8px;
      width: 260px;
    }

    .doc-search-container input {
      width: 100%;
      background: transparent;
      border: none;
      color: #c9d1d9;
      font-size: 0.82rem;
      outline: none;
      padding: 4px 0;
    }

    .search-nav-btn {
      background: none;
      border: none;
      color: #8b949e;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 2px 4px;
    }

    .search-nav-btn:hover { color: var(--accent-color); }

    .search-count {
      font-size: 0.72rem;
      color: #8b949e;
      margin: 0 6px;
      white-space: nowrap;
    }

    .btn {
      background-color: #21262d;
      color: #c9d1d9;
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      transition: background 0.2s;
    }

    .btn:hover { background-color: #30363d; border-color: #8b949e; }
    .btn-primary { background-color: #238636; color: #ffffff; border-color: rgba(240,246,252,0.1); }
    .btn-primary:hover { background-color: #2ea043; }

    #file-picker { display: none; }

    #selection-popup {
      position: absolute;
      display: none;
      background-color: #1f6feb;
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      z-index: 200;
      transition: transform 0.1s;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0,0,0,0.8);
      backdrop-filter: blur(4px);
      display: none;
      place-items: center;
      z-index: 1000;
    }

    .modal-content {
      background-color: #161b22;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      width: 92%;
      max-width: 720px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-content h3 {
      font-size: 1.1rem;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .diff-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: monospace;
      font-size: 0.84rem;
    }

    .diff-block {
      border-radius: 6px;
      padding: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .diff-before {
      background-color: rgba(248, 81, 73, 0.12);
      border: 1px solid rgba(248, 81, 73, 0.4);
      color: #ff7b72;
    }

    .diff-after {
      background-color: rgba(46, 160, 67, 0.12);
      border: 1px solid rgba(46, 160, 67, 0.4);
      color: #56d364;
    }

    .diff-label {
      font-weight: 700;
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
      display: block;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    #status-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: #da3633;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      display: none;
      z-index: 2000;
    }
  </style>
</head>
<body>

  <aside id="sidebar">
    <div class="sidebar-header">
      <h2>💬 Visor & Revisiones IA</h2>
      <input type="text" id="file-filter-input" class="search-file-box" placeholder="🔍 Filtrar archivo .md (ej: tranqi, PLT)..." />
      <select id="project-files-select" class="file-select">
        <option value="">📂 Seleccionar archivo .md...</option>
      </select>
    </div>

    <div class="sidebar-tabs">
      <button class="tab-btn active" id="tab-toc-btn" onclick="cambiarTab('toc')">📌 Índice</button>
      <button class="tab-btn" id="tab-comments-btn" onclick="cambiarTab('comments')">💬 Revisiones IA (<span id="comments-count">0</span>)</button>
    </div>

    <div class="toc-toolbar" id="toc-toolbar">
      <span style="font-size: 0.76rem; color: #8b949e;">Filtrar Índice:</span>
      <button class="filter-comments-btn" id="filter-comments-toggle-btn" onclick="toggleFiltroSoloComentarios()">
        💬 Solo con Comentarios
      </button>
    </div>
    
    <div id="toc-panel">
      <nav id="toc">
        <p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Cargando índice...</p>
      </nav>
    </div>

    <div id="comments-panel" style="display: none;">
      <div id="comments-list">
        <p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Sin revisiones pendientes</p>
      </div>
    </div>
  </aside>

  <header class="top-bar">
    <div class="input-box" title="Ruta completa absoluta del archivo en disco">
      <span style="font-size: 0.82rem; color: #8b949e; margin-right: 6px;">📁 Ruta:</span>
      <input type="text" id="path-input" value="${fullPathInicial}" placeholder="Ruta completa del archivo .md..." />
    </div>

    <div class="doc-search-container" title="Buscar texto en el documento actual">
      <input type="text" id="doc-search-input" placeholder="🔍 Buscar en documento..." oninput="ejecutarBusquedaTexto()" />
      <span class="search-count" id="search-counter">0/0</span>
      <button class="search-nav-btn" onclick="navegarBusqueda(-1)" title="Anterior match">▲</button>
      <button class="search-nav-btn" onclick="navegarBusqueda(1)" title="Siguiente match">▼</button>
    </div>
    
    <button class="btn btn-primary" onclick="cargarArchivoDesdeInput()">🚀 Visualizar</button>
    <label class="btn" title="Cargar archivo .md desde el disco local" for="file-picker">💻 Cargar Local</label>
    <input type="file" id="file-picker" accept=".md" onchange="cargarArchivoLocal(event)" />
    
    <button class="btn" onclick="document.getElementById('main-content').scrollTo({top: 0, behavior: 'smooth'})">⬆ Arriba</button>
    <button class="btn" onclick="recargarActual()">🔄 Recargar</button>
  </header>

  <main id="main-content">
    <article class="markdown-body" id="rendered-content">
    </article>
  </main>

  <div id="selection-popup" onclick="abrirModalConSeleccion()">💬 Comentar para la IA</div>

  <div class="modal-overlay" id="comment-modal">
    <div class="modal-content">
      <h3 id="modal-title">💬 Dejar Comentario u Observación para la IA</h3>
      <div class="context-box" id="modal-context-box">Texto o sección seleccionada...</div>
      <textarea id="modal-comment-text" placeholder="Escribe tu instrucción o cambio deseado para la IA..."></textarea>
      <div class="modal-actions">
        <button class="btn" onclick="cerrarModalComentario()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarComentarioModal()">💾 Guardar Comentario</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="diff-modal">
    <div class="modal-content">
      <h3>🔍 Control de Cambios Aplicado por la IA</h3>
      <div id="diff-summary-text" style="font-size: 0.9rem; color: #58a6ff; font-weight: 600;"></div>
      
      <div class="diff-container">
        <div>
          <span class="diff-label" style="color: #ff7b72;">🟥 Texto Anterior (Original):</span>
          <div class="diff-block diff-before" id="diff-before-content"></div>
        </div>
        <div>
          <span class="diff-label" style="color: #56d364;">🟩 Texto Nuevo (Modificado por la IA):</span>
          <div class="diff-block diff-after" id="diff-after-content"></div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn" onclick="cerrarModalDiff()">Cerrar</button>
        <button class="btn btn-revert" id="diff-modal-revert-btn">↩️ Reversar Cambio</button>
        <button class="btn btn-accept" id="diff-modal-accept-btn">✅ Aceptar Cambio</button>
      </div>
    </div>
  </aside>

  <div id="status-toast"></div>

  <script>
    let contenidoActual = ${JSON.stringify(contenidoInicial)};
    let rutaActual = ${JSON.stringify(fullPathInicial)};
    let listaArchivosProyecto = [];
    let comentariosActuales = [];
    let editandoCommentId = null;
    let textoSeleccionadoTemp = '';
    let seccionSeleccionadaTemp = '';
    let matchesBusqueda = [];
    let indiceMatchActual = -1;
    let filtroSoloComentariosActivo = false;

    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });

    function mostrarToast(mensaje, esError = true) {
      const toast = document.getElementById('status-toast');
      toast.style.backgroundColor = esError ? '#da3633' : '#238636';
      toast.textContent = mensaje;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }

    function cambiarTab(tab) {
      if (tab === 'toc') {
        document.getElementById('toc-panel').style.display = 'block';
        document.getElementById('toc-toolbar').style.display = 'flex';
        document.getElementById('comments-panel').style.display = 'none';
        document.getElementById('tab-toc-btn').classList.add('active');
        document.getElementById('tab-comments-btn').classList.remove('active');
      } else {
        document.getElementById('toc-panel').style.display = 'none';
        document.getElementById('toc-toolbar').style.display = 'none';
        document.getElementById('comments-panel').style.display = 'block';
        document.getElementById('tab-toc-btn').classList.remove('active');
        document.getElementById('tab-comments-btn').classList.add('active');
      }
    }

    function toggleFiltroSoloComentarios() {
      filtroSoloComentariosActivo = !filtroSoloComentariosActivo;
      const btn = document.getElementById('filter-comments-toggle-btn');
      btn.classList.toggle('active', filtroSoloComentariosActivo);

      const tocItems = document.querySelectorAll('#toc li');
      tocItems.forEach(li => {
        const a = li.querySelector('a');
        if (!a) return;
        if (filtroSoloComentariosActivo) {
          const tieneComentario = a.classList.contains('toc-has-comment');
          li.style.display = tieneComentario ? 'block' : 'none';
        } else {
          li.style.display = 'block';
        }
      });
    }

    // EXTRAER ÚNICAMENTE EL TÍTULO/ENCABEZADO LIMPIO DE UN ELEMENTO
    function obtenerTituloLimpio(elem) {
      if (!elem) return '';
      const clone = elem.cloneNode(true);
      
      // Remover botones o elementos inyectados en la clonacion
      clone.querySelectorAll('.heading-comment-btn, .doc-comment-badge, ul, ol').forEach(node => node.remove());
      
      const fullText = clone.textContent.trim().split('\\n')[0];
      return fullText.replace(/^[#\s0-9.]+\\s*/, '').trim();
    }

    // ALGORITMO ROBUSTO DE COINCIDENCIA CONTEXTUAL DE TÍTULOS
    function coincidenSecciones(secDoc, secComentario) {
      if (!secDoc || !secComentario) return false;

      const norm1 = secDoc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const norm2 = secComentario.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

      if (!norm1 || !norm2) return false;
      if (norm1 === norm2) return true;

      const palabras1 = norm1.split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w));
      const palabras2 = norm2.split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w));

      if (palabras1.length === 0 || palabras2.length === 0) return false;

      const coincidencias = palabras2.filter(w => palabras1.includes(w));
      const porcentaje = coincidencias.length / palabras2.length;

      // Debe coincidir al menos el 60% de las palabras clave principales del titulo
      return porcentaje >= 0.6;
    }

    function renderizarMarkdown(textoMd) {
      document.getElementById('rendered-content').innerHTML = marked.parse(textoMd);

      const olElements = document.querySelectorAll('#rendered-content ol');
      let ruleCounter = 0;

      olElements.forEach((ol) => {
        const lis = Array.from(ol.children).filter(el => el.tagName === 'LI');
        lis.forEach((li, idx) => {
          ruleCounter++;
          const ruleId = 'rule-item-' + ruleCounter;
          li.id = ruleId;

          const firstLine = li.textContent.trim().split('\\n')[0];
          const cleanRuleTitle = (idx + 1) + '. ' + firstLine.replace(/^[0-9.]+\\s*/, '').slice(0, 65);

          const commentBtn = document.createElement('button');
          commentBtn.className = 'heading-comment-btn';
          commentBtn.title = 'Agregar comentario a esta regla: ' + cleanRuleTitle;
          commentBtn.innerHTML = '💬';
          commentBtn.onclick = (e) => {
            e.stopPropagation();
            abrirModalSeccion(cleanRuleTitle);
          };

          const firstStrong = li.querySelector('strong') || li.querySelector('b');
          if (firstStrong) {
            firstStrong.appendChild(commentBtn);
          } else {
            li.insertBefore(commentBtn, li.firstChild);
          }
        });
      });

      const headings = document.querySelectorAll('#rendered-content h1, #rendered-content h2, #rendered-content h3, #rendered-content h4');
      const tocNav = document.getElementById('toc');
      
      if (headings.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'toc-tree';
        
        headings.forEach((heading, index) => {
          const id = 'heading-' + index;
          heading.id = id;
          
          const tituloLimpio = heading.textContent.replace(/^[#\s]+/, '');
          
          const commentBtn = document.createElement('button');
          commentBtn.className = 'heading-comment-btn';
          commentBtn.title = 'Agregar comentario a esta sección';
          commentBtn.innerHTML = '💬';
          commentBtn.onclick = (e) => {
            e.stopPropagation();
            abrirModalSeccion(tituloLimpio);
          };
          heading.appendChild(commentBtn);

          const li = document.createElement('li');
          const level = parseInt(heading.tagName.substring(1));
          li.className = 'toc-item level-' + level;

          const a = document.createElement('a');
          a.href = '#' + id;
          a.dataset.section = tituloLimpio;
          
          let prefixIcon = '';
          if (level === 1) prefixIcon = '📌 ';
          else if (level === 2) prefixIcon = '▫️ ';
          else if (level === 3) prefixIcon = '↳ ';
          else if (level === 4) prefixIcon = '   • ';

          a.innerHTML = '<span class="toc-title">' + prefixIcon + tituloLimpio + '</span><span class="comment-icon" title="Comentar sección">💬</span>';
          li.style.paddingLeft = ((level - 1) * 12) + 'px';
          
          a.addEventListener('click', (e) => {
            if (e.target.classList.contains('comment-icon')) {
              e.preventDefault();
              abrirModalSeccion(tituloLimpio);
              return;
            }
            e.preventDefault();

            document.querySelectorAll('#toc a').forEach(el => el.classList.remove('active'));
            a.classList.add('active');

            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });

          li.appendChild(a);
          ul.appendChild(li);

          if (heading.tagName === 'H3' && /reglas de negocio/i.test(tituloLimpio)) {
            let nextElem = heading.nextElementSibling;
            while (nextElem && nextElem.tagName !== 'OL' && !/^H[1-4]$/.test(nextElem.tagName)) {
              nextElem = nextElem.nextElementSibling;
            }

            if (nextElem && nextElem.tagName === 'OL') {
              const ruleLis = Array.from(nextElem.children).filter(el => el.tagName === 'LI');
              ruleLis.forEach((ruleLi, rIdx) => {
                const ruleId = ruleLi.id;
                const ruleFirstLine = ruleLi.textContent.trim().split('\\n')[0];
                const cleanRuleTitle = (rIdx + 1) + '. ' + ruleFirstLine.replace(/^[0-9.]+\\s*/, '').slice(0, 55);

                const ruleItemLi = document.createElement('li');
                ruleItemLi.className = 'toc-item level-rule';
                ruleItemLi.style.paddingLeft = '36px';

                const ruleA = document.createElement('a');
                ruleA.href = '#' + ruleId;
                ruleA.dataset.section = cleanRuleTitle;
                ruleA.innerHTML = '<span class="toc-title">⚡ ' + cleanRuleTitle + '</span><span class="comment-icon" title="Comentar regla">💬</span>';

                ruleA.addEventListener('click', (e) => {
                  if (e.target.classList.contains('comment-icon')) {
                    e.preventDefault();
                    abrirModalSeccion(cleanRuleTitle);
                    return;
                  }
                  e.preventDefault();

                  document.querySelectorAll('#toc a').forEach(el => el.classList.remove('active'));
                  ruleA.classList.add('active');

                  ruleLi.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });

                ruleItemLi.appendChild(ruleA);
                ul.appendChild(ruleItemLi);
              });
            }
          }
        });
        tocNav.innerHTML = '';
        tocNav.appendChild(ul);
      } else {
        tocNav.innerHTML = '<p style="padding: 12px; color: #8b949e;">Sin secciones principales</p>';
      }

      document.querySelectorAll('.language-mermaid').forEach((block) => {
        const code = block.textContent;
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = code;
        block.parentNode.replaceWith(div);
      });
      mermaid.run();

      cargarComentarios();
    }

    function ejecutarBusquedaTexto() {
      const query = document.getElementById('doc-search-input').value.trim();
      const contentArticle = document.getElementById('rendered-content');
      
      document.querySelectorAll('mark.doc-search-highlight').forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      });

      matchesBusqueda = [];
      indiceMatchActual = -1;
      document.getElementById('search-counter').textContent = '0/0';

      if (!query || query.length < 2) return;

      const escapedQuery = query.replace(/[.*+?^$\${}()|[\\]\\\\]/g, '\\\\$&');
      const regex = new RegExp('(' + escapedQuery + ')', 'gi');
      
      function resaltarNodoTexto(nodo) {
        if (nodo.nodeType === 3) {
          const val = nodo.nodeValue;
          if (regex.test(val)) {
            const span = document.createElement('span');
            span.innerHTML = val.replace(regex, '<mark class="doc-search-highlight">$1</mark>');
            nodo.parentNode.replaceChild(span, nodo);
          }
        } else if (nodo.nodeType === 1 && !['SCRIPT', 'STYLE', 'BUTTON', 'TEXTAREA'].includes(nodo.tagName)) {
          Array.from(nodo.childNodes).forEach(resaltarNodoTexto);
        }
      }

      resaltarNodoTexto(contentArticle);

      matchesBusqueda = Array.from(document.querySelectorAll('mark.doc-search-highlight'));
      if (matchesBusqueda.length > 0) {
        indiceMatchActual = 0;
        actualizarMatchNavegacion();
      }
    }

    function navegarBusqueda(direccion) {
      if (matchesBusqueda.length === 0) return;
      indiceMatchActual += direccion;
      if (indiceMatchActual >= matchesBusqueda.length) indiceMatchActual = 0;
      if (indiceMatchActual < 0) indiceMatchActual = matchesBusqueda.length - 1;
      actualizarMatchNavegacion();
    }

    function actualizarMatchNavegacion() {
      matchesBusqueda.forEach((el, idx) => {
        if (idx === indiceMatchActual) {
          el.classList.add('active-match');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          el.classList.remove('active-match');
        }
      });
      document.getElementById('search-counter').textContent = (indiceMatchActual + 1) + '/' + matchesBusqueda.length;
    }

    document.getElementById('file-filter-input').addEventListener('input', (e) => {
      const filtro = e.target.value.toLowerCase().trim();
      const select = document.getElementById('project-files-select');
      
      select.innerHTML = '<option value="">📂 Seleccionar archivo .md del proyecto...</option>';
      const filtrados = listaArchivosProyecto.filter(f => f.relPath.toLowerCase().includes(filtro) || f.name.toLowerCase().includes(filtro));
      
      filtrados.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file.fullPath;
        opt.textContent = file.relPath;
        opt.title = file.fullPath;
        if (file.fullPath === rutaActual || file.relPath === rutaActual) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    });

    document.getElementById('main-content').addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      const popup = document.getElementById('selection-popup');

      if (selectedText.length > 3) {
        textoSeleccionadoTemp = selectedText;
        seccionSeleccionadaTemp = '';
        popup.style.left = Math.min(e.pageX, window.innerWidth - 180) + 'px';
        popup.style.top = (e.pageY - 40) + 'px';
        popup.style.display = 'block';
      } else {
        popup.style.display = 'none';
      }
    });

    function abrirModalConSeleccion() {
      editandoCommentId = null;
      document.getElementById('modal-title').textContent = '💬 Dejar Comentario u Observación para la IA';
      document.getElementById('selection-popup').style.display = 'none';
      document.getElementById('modal-context-box').textContent = 'Texto Seleccionado: "' + textoSeleccionadoTemp + '"';
      document.getElementById('modal-comment-text').value = '';
      document.getElementById('comment-modal').style.display = 'grid';
    }

    function abrirModalSeccion(nombreSeccion) {
      editandoCommentId = null;
      document.getElementById('modal-title').textContent = '💬 Dejar Comentario u Observación para la IA';
      seccionSeleccionadaTemp = nombreSeccion;
      textoSeleccionadoTemp = '';
      document.getElementById('modal-context-box').textContent = 'Sección/Regla: ' + nombreSeccion;
      document.getElementById('modal-comment-text').value = '';
      document.getElementById('comment-modal').style.display = 'grid';
    }

    function abrirModalEditarComentario(c) {
      editandoCommentId = c.id;
      document.getElementById('modal-title').textContent = '✏️ Editar Comentario para la IA';
      seccionSeleccionadaTemp = c.section || '';
      textoSeleccionadoTemp = c.selectedText || '';
      document.getElementById('modal-context-box').textContent = (c.selectedText ? 'Texto: "' + c.selectedText + '"' : ('Sección/Regla: ' + (c.section || 'General')));
      document.getElementById('modal-comment-text').value = c.comment;
      document.getElementById('comment-modal').style.display = 'grid';
    }

    function cerrarModalComentario() {
      editandoCommentId = null;
      document.getElementById('comment-modal').style.display = 'none';
    }

    function abrirModalDiff(c) {
      if (!c.aiChange) {
        mostrarToast('Este comentario no tiene un cambio registrado para comparar.');
        return;
      }
      document.getElementById('diff-summary-text').textContent = c.aiChange.summary || 'Ajuste aplicado por la IA';
      document.getElementById('diff-before-content').textContent = c.aiChange.beforeText || '(Sin texto previo)';
      document.getElementById('diff-after-content').textContent = c.aiChange.afterText || '(Sin texto nuevo)';

      document.getElementById('diff-modal-accept-btn').onclick = () => aceptarCambioIA(c.id);
      document.getElementById('diff-modal-revert-btn').onclick = () => reversarCambioIA(c.id);

      document.getElementById('diff-modal').style.display = 'grid';
    }

    function cerrarModalDiff() {
      document.getElementById('diff-modal').style.display = 'none';
    }

    async function guardarComentarioModal() {
      const commentText = document.getElementById('modal-comment-text').value.trim();
      if (!commentText) {
        mostrarToast('Por favor escribe tu comentario o instrucción');
        return;
      }

      const payload = {
        id: editandoCommentId,
        file: rutaActual,
        section: seccionSeleccionadaTemp,
        selectedText: textoSeleccionadoTemp,
        comment: commentText
      };

      try {
        const res = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          cerrarModalComentario();
          mostrarToast(editandoCommentId ? 'Comentario actualizado' : 'Comentario guardado para la IA', false);
          cargarComentarios();
        } else {
          mostrarToast('Error al guardar comentario');
        }
      } catch (err) {
        mostrarToast('Error de conexión');
      }
    }

    async function cargarComentarios() {
      try {
        const res = await fetch('/api/comments?file=' + encodeURIComponent(rutaActual));
        comentariosActuales = await res.json();
        
        document.getElementById('comments-count').textContent = comentariosActuales.length;
        const listContainer = document.getElementById('comments-list');

        document.querySelectorAll('.has-active-comment, .toc-has-comment').forEach(el => {
          el.classList.remove('has-active-comment', 'toc-has-comment');
        });
        document.querySelectorAll('.heading-comment-btn.has-comments, .comment-icon.has-comments').forEach(el => {
          el.classList.remove('has-comments');
          el.innerHTML = '💬';
        });

        if (comentariosActuales.length === 0) {
          listContainer.innerHTML = '<p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Sin revisiones pendientes en este archivo</p>';
          if (filtroSoloComentariosActivo) toggleFiltroSoloComentarios();
          return;
        }

        const conteoPorSeccion = {};
        comentariosActuales.forEach(c => {
          const key = c.section || 'General';
          conteoPorSeccion[key] = (conteoPorSeccion[key] || 0) + 1;
        });

        // 1. ILUMINAR ÚNICAMENTE EL ENCABEZADO/REGLA QUE COINCIDA CON EL TÍTULO LIMPIO
        const docElems = document.querySelectorAll('#rendered-content h1, #rendered-content h2, #rendered-content h3, #rendered-content h4, #rendered-content li[id^="rule-item-"]');
        
        docElems.forEach(elem => {
          const tituloElem = obtenerTituloLimpio(elem);
          
          Object.keys(conteoPorSeccion).forEach(sec => {
            if (sec && coincidenSecciones(tituloElem, sec)) {
              elem.classList.add('has-active-comment');
              const commentBtn = elem.querySelector('.heading-comment-btn');
              if (commentBtn) {
                commentBtn.classList.add('has-comments');
                commentBtn.innerHTML = '💬 ' + conteoPorSeccion[sec];
                commentBtn.title = 'Tiene ' + conteoPorSeccion[sec] + ' comentario(s) de la IA. Clic para ver/agregar.';
              }
            }
          });
        });

        // 2. ILUMINAR ÚNICAMENTE LA FILA DEL ÍNDICE QUE COINCIDA
        const tocLinks = document.querySelectorAll('#toc a');
        tocLinks.forEach(a => {
          const secTitle = a.dataset.section || a.textContent.trim();
          Object.keys(conteoPorSeccion).forEach(sec => {
            if (sec && coincidenSecciones(secTitle, sec)) {
              a.classList.add('toc-has-comment');
              const icon = a.querySelector('.comment-icon');
              if (icon) {
                icon.classList.add('has-comments');
                icon.innerHTML = '💬 ' + conteoPorSeccion[sec];
                icon.title = 'Tiene ' + conteoPorSeccion[sec] + ' comentario(s)';
              }
            }
          });
        });

        if (filtroSoloComentariosActivo) {
          const tocItems = document.querySelectorAll('#toc li');
          tocItems.forEach(li => {
            const a = li.querySelector('a');
            if (a) {
              li.style.display = a.classList.contains('toc-has-comment') ? 'block' : 'none';
            }
          });
        }

        // Renderizar Tarjetas
        listContainer.innerHTML = '';
        comentariosActuales.forEach(c => {
          const card = document.createElement('div');
          card.className = 'comment-card' + (c.status === 'ATENDIDO' ? ' atendido' : '');
          
          const header = document.createElement('div');
          header.className = 'header';
          
          const titleSpan = document.createElement('span');
          titleSpan.textContent = c.section || 'General';
          
          const badgeSpan = document.createElement('span');
          badgeSpan.className = 'status-badge ' + (c.status === 'ATENDIDO' ? 'status-atendido' : 'status-pendiente');
          badgeSpan.textContent = c.status === 'ATENDIDO' ? '🟡 CAMBIO REALIZADO' : '⏳ PENDIENTE IA';

          header.appendChild(titleSpan);
          header.appendChild(badgeSpan);

          const snippet = document.createElement('div');
          snippet.className = 'snippet';
          snippet.textContent = c.selectedText || c.section || 'Comentario general';

          const text = document.createElement('div');
          text.className = 'text';
          text.textContent = c.comment;

          card.appendChild(header);
          card.appendChild(snippet);
          card.appendChild(text);

          if (c.status === 'ATENDIDO' && c.aiChange) {
            const aiBox = document.createElement('div');
            aiBox.className = 'ai-summary-box';
            aiBox.textContent = '🤖 ' + (c.aiChange.summary || 'Cambio listo para revisión');
            card.appendChild(aiBox);
          }

          const actions = document.createElement('div');
          actions.className = 'actions';

          const viewBtn = document.createElement('button');
          viewBtn.className = 'comment-card-btn btn-view';
          viewBtn.innerHTML = '👁 Ver Doc';
          viewBtn.title = 'Ir a la ubicación en el documento';
          viewBtn.onclick = () => saltarAComentarioEnDoc(c);
          actions.appendChild(viewBtn);

          if (c.status === 'ATENDIDO' && c.aiChange) {
            const diffBtn = document.createElement('button');
            diffBtn.className = 'comment-card-btn btn-diff';
            diffBtn.innerHTML = '🔍 Ver Diff';
            diffBtn.onclick = () => abrirModalDiff(c);

            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'comment-card-btn btn-accept';
            acceptBtn.innerHTML = '✅ Aceptar';
            acceptBtn.title = 'Aceptar el cambio y remover del historial';
            acceptBtn.onclick = () => aceptarCambioIA(c.id);

            const revertBtn = document.createElement('button');
            revertBtn.className = 'comment-card-btn btn-revert';
            revertBtn.innerHTML = '↩️ Reversar';
            revertBtn.title = 'Deshacer el cambio en el documento';
            revertBtn.onclick = () => reversarCambioIA(c.id);

            actions.appendChild(diffBtn);
            actions.appendChild(acceptBtn);
            actions.appendChild(revertBtn);
          } else {
            const editBtn = document.createElement('button');
            editBtn.className = 'comment-card-btn btn-edit';
            editBtn.innerHTML = '✏️ Editar';
            editBtn.onclick = () => abrirModalEditarComentario(c);

            const delBtn = document.createElement('button');
            delBtn.className = 'comment-card-btn btn-del';
            delBtn.innerHTML = '🗑 Eliminar';
            delBtn.onclick = () => eliminarComentario(c.id);

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
          }

          card.appendChild(actions);
          listContainer.appendChild(card);
        });
      } catch (err) {
        console.error('Error al cargar comentarios:', err);
      }
    }

    function saltarAComentarioEnDoc(c) {
      if (c.selectedText) {
        document.getElementById('doc-search-input').value = c.selectedText;
        ejecutarBusquedaTexto();
      } else if (c.section) {
        const headings = document.querySelectorAll('#rendered-content h1, #rendered-content h2, #rendered-content h3, #rendered-content h4, #rendered-content li[id^="rule-item-"]');
        for (const h of headings) {
          const tit = obtenerTituloLimpio(h);
          if (coincidenSecciones(tit, c.section)) {
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
          }
        }
      }
    }

    async function aceptarCambioIA(id) {
      try {
        const res = await fetch('/api/comments/accept?id=' + encodeURIComponent(id), { method: 'POST' });
        if (res.ok) {
          cerrarModalDiff();
          mostrarToast('✅ Cambio ACEPTADO. Removido del historial.', false);
          cargarComentarios();
        }
      } catch (err) {
        mostrarToast('Error al aceptar cambio');
      }
    }

    async function reversarCambioIA(id) {
      if (!confirm('¿Seguro que deseas REVERSAR este cambio? El texto original del archivo será restaurado.')) return;
      try {
        const res = await fetch('/api/comments/revert?id=' + encodeURIComponent(id), { method: 'POST' });
        if (res.ok) {
          cerrarModalDiff();
          mostrarToast('↩️ Cambio REVERSADO. El documento ha sido restaurado.', false);
          recargarActual();
        } else {
          mostrarToast('No se pudo reversar el cambio automáticamente');
        }
      } catch (err) {
        mostrarToast('Error al reversar cambio');
      }
    }

    async function eliminarComentario(id) {
      if (!confirm('¿Deseas eliminar este comentario?')) return;
      try {
        await fetch('/api/comments?id=' + encodeURIComponent(id), { method: 'DELETE' });
        cargarComentarios();
        mostrarToast('Comentario eliminado', false);
      } catch (err) {}
    }

    async function cargarListaArchivosProyecto() {
      try {
        const res = await fetch('/api/list-markdown');
        listaArchivosProyecto = await res.json();
        const select = document.getElementById('project-files-select');
        
        select.innerHTML = '<option value="">📂 Seleccionar archivo .md del proyecto...</option>';
        listaArchivosProyecto.forEach(file => {
          const opt = document.createElement('option');
          opt.value = file.fullPath;
          opt.textContent = file.relPath;
          opt.title = file.fullPath;
          if (file.fullPath === rutaActual || file.relPath === rutaActual) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
          if (e.target.value) {
            solicitarArchivoServidor(e.target.value);
          }
        });
      } catch (err) {}
    }

    async function solicitarArchivoServidor(filePath) {
      try {
        const res = await fetch('/api/file?path=' + encodeURIComponent(filePath));
        const data = await res.json();
        
        if (!res.ok || data.error) {
          mostrarToast(data.error || 'No se pudo abrir el archivo');
          return;
        }

        contenidoActual = data.content;
        rutaActual = data.fullPath;
        document.getElementById('path-input').value = data.fullPath;
        document.title = 'Visor Markdown · ' + data.name;
        
        renderizarMarkdown(data.content);
        mostrarToast('Cargado: ' + data.name, false);
      } catch (err) {
        mostrarToast('Error de conexión al servidor');
      }
    }

    function cargarArchivoDesdeInput() {
      const inputPath = document.getElementById('path-input').value.trim();
      if (inputPath) {
        solicitarArchivoServidor(inputPath);
      }
    }

    document.getElementById('path-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        cargarArchivoDesdeInput();
      }
    });

    function cargarArchivoLocal(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        contenidoActual = e.target.result;
        rutaActual = file.name;
        document.getElementById('path-input').value = file.name;
        document.title = 'Visor Markdown · ' + file.name;
        
        renderizarMarkdown(contenidoActual);
        mostrarToast('Archivo local cargado: ' + file.name, false);
      };
      reader.readAsText(file);
    }

    function recargarActual() {
      if (rutaActual && !document.getElementById('file-picker').files[0]) {
        solicitarArchivoServidor(rutaActual);
      } else {
        location.reload();
      }
    }

    cargarListaArchivosProyecto();

    const evtSource = new EventSource('/events');
    evtSource.onmessage = function(e) {
      if (e.data === 'reload') {
        recargarActual();
      }
    };
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  
  if (parsedUrl.pathname === '/api/comments' && req.method === 'GET') {
    const reqPath = parsedUrl.searchParams.get('file');
    const todosComentarios = leerComentarios();
    const filtrados = reqPath 
      ? todosComentarios.filter(c => c.file === reqPath || c.file.endsWith(path.basename(reqPath)))
      : todosComentarios;
      
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(filtrados));
    return;
  }

  if (parsedUrl.pathname === '/api/comments/accept' && req.method === 'POST') {
    const commentId = parsedUrl.searchParams.get('id');
    if (commentId) {
      let comentarios = leerComentarios();
      comentarios = comentarios.filter(c => c.id !== commentId);
      guardarComentarios(comentarios);
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (parsedUrl.pathname === '/api/comments/revert' && req.method === 'POST') {
    const commentId = parsedUrl.searchParams.get('id');
    const comentarios = leerComentarios();
    const c = comentarios.find(item => item.id === commentId);

    if (c && c.aiChange && c.aiChange.beforeText && c.aiChange.afterText) {
      let filePath = c.file;
      if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(ROOT_DIR, filePath);
      }
      
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(c.aiChange.afterText)) {
          content = content.replace(c.aiChange.afterText, c.aiChange.beforeText);
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }

      const filtrados = comentarios.filter(item => item.id !== commentId);
      guardarComentarios(filtrados);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, reverted: true }));
      return;
    }

    const filtrados = comentarios.filter(item => item.id !== commentId);
    guardarComentarios(filtrados);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, reverted: false }));
    return;
  }

  if (parsedUrl.pathname === '/api/comments' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        let comentarios = leerComentarios();

        if (payload.id) {
          const idx = comentarios.findIndex(c => c.id === payload.id);
          if (idx !== -1) {
            comentarios[idx].comment = payload.comment;
            comentarios[idx].section = payload.section || comentarios[idx].section;
            comentarios[idx].selectedText = payload.selectedText || comentarios[idx].selectedText;
            comentarios[idx].updatedAt = new Date().toISOString();
          }
        } else {
          payload.id = 'comment_' + Date.now();
          payload.timestamp = new Date().toISOString();
          payload.status = 'PENDIENTE';
          comentarios.push(payload);
        }

        guardarComentarios(comentarios);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload inválido' }));
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/comments' && req.method === 'DELETE') {
    const commentId = parsedUrl.searchParams.get('id');
    if (commentId) {
      let comentarios = leerComentarios();
      comentarios = comentarios.filter(c => c.id !== commentId);
      guardarComentarios(comentarios);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (parsedUrl.pathname === '/api/list-markdown') {
    const listaMd = escanearArchivosMd(ROOT_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(listaMd));
    return;
  }

  if (parsedUrl.pathname === '/api/file') {
    const reqPath = parsedUrl.searchParams.get('path');
    if (!reqPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no especificada' }));
      return;
    }

    let fullPath = path.isAbsolute(reqPath) ? reqPath : path.resolve(ROOT_DIR, reqPath);
    if (!fs.existsSync(fullPath) && fs.existsSync(fullPath + '.md')) {
      fullPath = fullPath + '.md';
    }

    if (!fs.existsSync(fullPath)) {
      res.writeHead(440, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: `El archivo no existe: ${reqPath}` }));
      return;
    }

    targetFile = fullPath;
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Error al leer el archivo' }));
        return;
      }
      
      const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
      const normalizedFullPath = path.resolve(fullPath).replace(/\\/g, '/');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        name: path.basename(fullPath),
        relPath: relPath,
        fullPath: normalizedFullPath,
        content: data
      }));
    });
    return;
  }

  if (parsedUrl.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    const watcher = fs.watch(targetFile, () => {
      res.write('data: reload\n\n');
    });
    
    req.on('close', () => watcher.close());
    return;
  }

  fs.readFile(targetFile, 'utf8', (err, data) => {
    const fileToRender = err ? DEFAULT_FILE : targetFile;
    const initialContent = err ? '# Error\nNo se pudo leer el archivo especificado' : data;
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generarHTML(initialContent, fileToRender));
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`====================================================`);
  console.log(`🚀 Visor Markdown Universal con Extracción Limpia de Título (Strict Matching 60%)`);
  console.log(`📄 Archivo Inicial: ${targetFile}`);
  console.log(`🌐 Navegar a: ${url}`);
  console.log(`====================================================`);

  exec(`start ${url}`);
});
