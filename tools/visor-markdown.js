const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3333;
const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_FILE = path.join(__dirname, '../gobernanza/productos/plataforma/especificacion-funcional.md');
const COMMENTS_FILE = path.join(__dirname, '../gobernanza/comentarios_revision.json');

let targetFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;

// Asegurar que el archivo de comentarios JSON exista
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
      width: 360px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      background-color: #0d1117;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sidebar-header h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .file-select {
      width: 100%;
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 7px 10px;
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

    #toc-panel, #comments-panel {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    #toc ul { list-style: none; padding-left: 8px; }
    #toc li { margin: 4px 0; }
    #toc a {
      color: #8b949e;
      text-decoration: none;
      font-size: 0.84rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      border-radius: 6px;
      line-height: 1.35;
      transition: background 0.15s, color 0.15s;
    }
    #toc a:hover { background-color: rgba(110, 118, 129, 0.15); color: var(--text-color); }
    #toc a .comment-icon { opacity: 0.4; font-size: 0.8rem; margin-left: 6px; }
    #toc a .comment-icon:hover { opacity: 1; }

    .comment-card {
      background-color: #21262d;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.83rem;
    }

    .comment-card .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--accent-color);
      font-weight: 700;
      font-size: 0.78rem;
    }

    .comment-card .snippet {
      color: #8b949e;
      font-style: italic;
      border-left: 2px solid #d29922;
      padding-left: 8px;
      margin: 2px 0;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .comment-card .text {
      color: #c9d1d9;
      line-height: 1.4;
      font-weight: 500;
    }

    .comment-card .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    .comment-card .del-btn {
      color: #f85149;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.75rem;
    }

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

    .markdown-body table { display: table !important; width: 100% !important; }

    .heading-comment-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 10px;
      font-size: 0.85rem;
      opacity: 0.3;
      cursor: pointer;
      border: none;
      background: none;
      color: var(--accent-color);
      transition: opacity 0.2s, transform 0.2s;
    }

    .heading-comment-btn:hover {
      opacity: 1;
      transform: scale(1.2);
    }

    .top-bar {
      position: fixed;
      top: 0;
      left: 360px;
      right: 0;
      height: 64px;
      background-color: rgba(22, 27, 34, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 24px;
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
      font-size: 0.84rem;
      font-family: monospace;
      outline: none;
    }

    .btn {
      background-color: #21262d;
      color: #c9d1d9;
      border: 1px solid var(--border-color);
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
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
    #selection-popup:hover { transform: scale(1.05); }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      display: none;
      place-items: center;
      z-index: 1000;
    }

    .modal-content {
      background-color: #161b22;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      width: 90%;
      max-width: 560px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    }

    .modal-content h3 {
      font-size: 1.1rem;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-content .context-box {
      background-color: #0d1117;
      border-left: 3px solid #d29922;
      padding: 10px 14px;
      border-radius: 4px;
      font-size: 0.85rem;
      color: #8b949e;
      max-height: 100px;
      overflow-y: auto;
    }

    .modal-content textarea {
      width: 100%;
      height: 120px;
      background-color: #0d1117;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      color: #c9d1d9;
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      resize: vertical;
    }

    .modal-content textarea:focus {
      border-color: var(--accent-color);
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

  <!-- SIDEBAR -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <h2>💬 Visor & Revisiones IA</h2>
      <select id="project-files-select" class="file-select">
        <option value="">📂 Seleccionar archivo .md...</option>
      </select>
    </div>

    <div class="sidebar-tabs">
      <button class="tab-btn active" id="tab-toc-btn" onclick="cambiarTab('toc')">📌 Índice</button>
      <button class="tab-btn" id="tab-comments-btn" onclick="cambiarTab('comments')">💬 Comentarios IA (<span id="comments-count">0</span>)</button>
    </div>
    
    <div id="toc-panel">
      <nav id="toc">
        <p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Cargando índice...</p>
      </nav>
    </div>

    <div id="comments-panel" style="display: none;">
      <div id="comments-list">
        <p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Sin comentarios en este archivo</p>
      </div>
    </div>
  </aside>

  <!-- TOP BAR CON RUTA COMPLETA -->
  <header class="top-bar">
    <div class="input-box" title="Ruta completa absoluta del archivo en disco">
      <span style="font-size: 0.85rem; color: #8b949e; margin-right: 8px;">📁 Ruta Completa:</span>
      <input type="text" id="path-input" value="${fullPathInicial}" placeholder="Pega o escribe la ruta completa absoluta de cualquier archivo .md..." />
    </div>
    
    <button class="btn btn-primary" onclick="cargarArchivoDesdeInput()">🚀 Visualizar</button>
    <label class="btn" title="Cargar archivo .md desde el disco local" for="file-picker">💻 Cargar Local</label>
    <input type="file" id="file-picker" accept=".md" onchange="cargarArchivoLocal(event)" />
    
    <button class="btn" onclick="document.getElementById('main-content').scrollTo({top: 0, behavior: 'smooth'})">⬆ Arriba</button>
    <button class="btn" onclick="recargarActual()">🔄 Recargar</button>
  </header>

  <!-- MAIN CONTENT -->
  <main id="main-content">
    <article class="markdown-body" id="rendered-content">
    </article>
  </main>

  <div id="selection-popup" onclick="abrirModalConSeleccion()">💬 Comentar para la IA</div>

  <div class="modal-overlay" id="comment-modal">
    <div class="modal-content">
      <h3>💬 Dejar Comentario u Observación para la IA</h3>
      <div class="context-box" id="modal-context-box">Texto o sección seleccionada...</div>
      <textarea id="modal-comment-text" placeholder="Escribe tu instrucción o cambio deseado para la IA..."></textarea>
      <div class="modal-actions">
        <button class="btn" onclick="cerrarModalComentario()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarComentarioModal()">💾 Guardar Comentario</button>
      </div>
    </div>
  </div>

  <div id="status-toast"></div>

  <script>
    let contenidoActual = ${JSON.stringify(contenidoInicial)};
    let rutaActual = ${JSON.stringify(fullPathInicial)};
    let comentariosActuales = [];
    let textoSeleccionadoTemp = '';
    let seccionSeleccionadaTemp = '';

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
        document.getElementById('comments-panel').style.display = 'none';
        document.getElementById('tab-toc-btn').classList.add('active');
        document.getElementById('tab-comments-btn').classList.remove('active');
      } else {
        document.getElementById('toc-panel').style.display = 'none';
        document.getElementById('comments-panel').style.display = 'block';
        document.getElementById('tab-toc-btn').classList.remove('active');
        document.getElementById('tab-comments-btn').classList.add('active');
      }
    }

    function renderizarMarkdown(textoMd) {
      document.getElementById('rendered-content').innerHTML = marked.parse(textoMd);

      const headings = document.querySelectorAll('#rendered-content h1, #rendered-content h2, #rendered-content h3');
      const tocNav = document.getElementById('toc');
      
      if (headings.length > 0) {
        const ul = document.createElement('ul');
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
          const a = document.createElement('a');
          a.href = '#' + id;
          a.innerHTML = '<span>' + tituloLimpio + '</span><span class="comment-icon" title="Comentar sección">💬</span>';
          
          const level = parseInt(heading.tagName.substring(1));
          li.style.paddingLeft = ((level - 1) * 10) + 'px';
          
          a.addEventListener('click', (e) => {
            if (e.target.classList.contains('comment-icon')) {
              e.preventDefault();
              abrirModalSeccion(tituloLimpio);
              return;
            }
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth' });
          });

          li.appendChild(a);
          ul.appendChild(li);
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
      document.getElementById('selection-popup').style.display = 'none';
      document.getElementById('modal-context-box').textContent = 'Texto Seleccionado: "' + textoSeleccionadoTemp + '"';
      document.getElementById('modal-comment-text').value = '';
      document.getElementById('comment-modal').style.display = 'grid';
    }

    function abrirModalSeccion(nombreSeccion) {
      seccionSeleccionadaTemp = nombreSeccion;
      textoSeleccionadoTemp = '';
      document.getElementById('modal-context-box').textContent = 'Sección: ' + nombreSeccion;
      document.getElementById('modal-comment-text').value = '';
      document.getElementById('comment-modal').style.display = 'grid';
    }

    function cerrarModalComentario() {
      document.getElementById('comment-modal').style.display = 'none';
    }

    async function guardarComentarioModal() {
      const commentText = document.getElementById('modal-comment-text').value.trim();
      if (!commentText) {
        mostrarToast('Por favor escribe tu comentario o instrucción');
        return;
      }

      const payload = {
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
          mostrarToast('Comentario guardado para la IA', false);
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

        if (comentariosActuales.length === 0) {
          listContainer.innerHTML = '<p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Sin comentarios en este archivo</p>';
          return;
        }

        listContainer.innerHTML = '';
        comentariosActuales.forEach(c => {
          const card = document.createElement('div');
          card.className = 'comment-card';
          
          const header = document.createElement('div');
          header.className = 'header';
          header.innerHTML = '<span>' + (c.section || 'General') + '</span><span>' + new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</span>';

          const snippet = document.createElement('div');
          snippet.className = 'snippet';
          snippet.textContent = c.selectedText || c.section || 'Comentario general';

          const text = document.createElement('div');
          text.className = 'text';
          text.textContent = c.comment;

          const actions = document.createElement('div');
          actions.className = 'actions';
          actions.innerHTML = '<button class="del-btn" onclick="eliminarComentario(\'' + c.id + '\')">🗑 Eliminar</button>';

          card.appendChild(header);
          card.appendChild(snippet);
          card.appendChild(text);
          card.appendChild(actions);

          listContainer.appendChild(card);
        });
      } catch (err) {
        console.error('Error al cargar comentarios:', err);
      }
    }

    async function eliminarComentario(id) {
      try {
        await fetch('/api/comments?id=' + encodeURIComponent(id), { method: 'DELETE' });
        cargarComentarios();
        mostrarToast('Comentario eliminado', false);
      } catch (err) {}
    }

    async function cargarListaArchivosProyecto() {
      try {
        const res = await fetch('/api/list-markdown');
        const archivos = await res.json();
        const select = document.getElementById('project-files-select');
        
        select.innerHTML = '<option value="">📂 Seleccionar archivo .md del proyecto...</option>';
        archivos.forEach(file => {
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

  if (parsedUrl.pathname === '/api/comments' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const nuevoComentario = JSON.parse(body);
        nuevoComentario.id = 'comment_' + Date.now();
        nuevoComentario.timestamp = new Date().toISOString();
        nuevoComentario.status = 'PENDIENTE';

        const comentarios = leerComentarios();
        comentarios.push(nuevoComentario);
        guardarComentarios(comentarios);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, comment: nuevoComentario }));
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
  console.log(`🚀 Visor Markdown Universal con Ruta Absoluta Completa`);
  console.log(`📄 Archivo Inicial: ${targetFile}`);
  console.log(`🌐 Navegar a: ${url}`);
  console.log(`====================================================`);

  exec(`start ${url}`);
});
