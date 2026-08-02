const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3333;
const ROOT_DIR = path.resolve(__dirname, '../..'); // Raíz del proyecto (Ley)
const DEFAULT_FILE = path.join(__dirname, '../gobernanza/productos/plataforma/especificacion-funcional.md');

let targetFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;

// Función para escanear recursivamente todos los archivos .md del proyecto
function escanearArchivosMd(dir, lista = [], baseDir = ROOT_DIR) {
  try {
    const elementos = fs.readdirSync(dir, { withFileTypes: true });
    for (const elem of elementos) {
      // Ignorar node_modules, .git, .next, dist, build, temp
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
          fullPath: fullPath
        });
      }
    }
  } catch (err) {
    // Silenciar errores de permisos o lectura de carpetas restringidas
  }
  return lista;
}

function generarHTML(contenidoInicial, rutaInicial) {
  const filenameInicial = path.basename(rutaInicial);
  const relPathInicial = path.relative(ROOT_DIR, rutaInicial).replace(/\\/g, '/');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visor Markdown Universal</title>
  
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

    /* Selector desplegable de archivos del proyecto */
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

    .file-select:focus {
      border-color: var(--accent-color);
    }

    #toc-title {
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8b949e;
      padding: 12px 16px 4px;
    }

    #toc {
      flex: 1;
      overflow-y: auto;
      padding: 4px 12px 12px;
    }

    #toc ul {
      list-style: none;
      padding-left: 8px;
    }

    #toc li {
      margin: 4px 0;
    }

    #toc a {
      color: #8b949e;
      text-decoration: none;
      font-size: 0.84rem;
      display: block;
      padding: 5px 8px;
      border-radius: 6px;
      line-height: 1.35;
      transition: background 0.15s, color 0.15s;
    }

    #toc a:hover {
      background-color: rgba(110, 118, 129, 0.15);
      color: var(--text-color);
    }

    #main-content {
      flex: 1;
      overflow-y: auto;
      padding: 80px 56px 40px;
      scroll-behavior: smooth;
    }

    .markdown-body {
      background-color: transparent !important;
      max-width: 980px;
      margin: 0 auto;
      font-size: 15px;
    }

    .markdown-body table {
      display: table !important;
      width: 100% !important;
    }

    /* BARRA SUPERIOR DE ENTRADA Y NAVEGACIÓN DE ARCHIVOS */
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
      transition: border-color 0.15s;
    }

    .input-box:focus-within {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.15);
    }

    .input-box span {
      font-size: 0.85rem;
      color: #8b949e;
      margin-right: 8px;
    }

    .input-box input {
      flex: 1;
      background: transparent;
      border: none;
      color: #c9d1d9;
      font-size: 0.88rem;
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

    .btn:hover {
      background-color: #30363d;
      border-color: #8b949e;
    }

    .btn-primary {
      background-color: #238636;
      color: #ffffff;
      border-color: rgba(240, 246, 252, 0.1);
    }

    .btn-primary:hover {
      background-color: #2ea043;
    }

    #file-picker {
      display: none;
    }

    /* MENSAJES DE ESTADO / ALERTA DE ERROR */
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
      z-index: 1000;
    }
  </style>
</head>
<body>

  <!-- BARRA LATERAL -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <h2>📖 Visor Markdown Universal</h2>
      
      <!-- Selector desplegable de archivos .md del proyecto -->
      <select id="project-files-select" class="file-select">
        <option value="">📂 Seleccionar archivo .md del proyecto...</option>
      </select>
    </div>
    
    <div id="toc-title">Índice de Secciones</div>
    <nav id="toc">
      <p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Cargando índice...</p>
    </nav>
  </aside>

  <!-- BARRA SUPERIOR DE ENTRADA Y BOTONES -->
  <header class="top-bar">
    <div class="input-box">
      <span>📄 Ruta:</span>
      <input type="text" id="path-input" value="${relPathInicial}" placeholder="Escribe la ruta de cualquier archivo .md..." />
    </div>
    
    <button class="btn btn-primary" onclick="cargarArchivoDesdeInput()">🚀 Visualizar</button>
    <label class="btn" for="file-picker">💻 Cargar .md Local</label>
    <input type="file" id="file-picker" accept=".md" onchange="cargarArchivoLocal(event)" />
    
    <button class="btn" onclick="document.getElementById('main-content').scrollTo({top: 0, behavior: 'smooth'})">⬆ Arriba</button>
    <button class="btn" onclick="recargarActual()">🔄 Recargar</button>
  </header>

  <!-- CONTENIDO RENDERIZADO -->
  <main id="main-content">
    <article class="markdown-body" id="rendered-content">
    </article>
  </main>

  <!-- NOTIFICACIÓN TOAST -->
  <div id="status-toast"></div>

  <script>
    let contenidoActual = ${JSON.stringify(contenidoInicial)};
    let rutaActual = ${JSON.stringify(relPathInicial)};

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

    function renderizarMarkdown(textoMd) {
      document.getElementById('rendered-content').innerHTML = marked.parse(textoMd);

      // Generar TOC
      const headings = document.querySelectorAll('#rendered-content h1, #rendered-content h2, #rendered-content h3');
      const tocNav = document.getElementById('toc');
      
      if (headings.length > 0) {
        const ul = document.createElement('ul');
        headings.forEach((heading, index) => {
          const id = 'heading-' + index;
          heading.id = id;
          
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '#' + id;
          a.textContent = heading.textContent.replace(/^[#\s]+/, '');
          
          const level = parseInt(heading.tagName.substring(1));
          li.style.paddingLeft = ((level - 1) * 10) + 'px';
          
          a.addEventListener('click', (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth' });
          });

          li.appendChild(a);
          ul.appendChild(li);
        });
        tocNav.innerHTML = '';
        tocNav.appendChild(ul);
      } else {
        tocNav.innerHTML = '<p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Sin secciones principales</p>';
      }

      // Renderizar Mermaid
      document.querySelectorAll('.language-mermaid').forEach((block) => {
        const code = block.textContent;
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = code;
        block.parentNode.replaceWith(div);
      });
      mermaid.run();
    }

    // Cargar contenido inicial
    renderizarMarkdown(contenidoActual);

    // Cargar lista de archivos .md del proyecto
    async function cargarListaArchivosProyecto() {
      try {
        const res = await fetch('/api/list-markdown');
        const archivos = await res.json();
        const select = document.getElementById('project-files-select');
        
        archivos.forEach(file => {
          const opt = document.createElement('option');
          opt.value = file.relPath;
          opt.textContent = file.relPath;
          if (file.relPath === rutaActual) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
          if (e.target.value) {
            solicitarArchivoServidor(e.target.value);
          }
        });
      } catch (err) {
        console.error('Error al cargar lista de archivos:', err);
      }
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
        rutaActual = data.relPath;
        document.getElementById('path-input').value = data.relPath;
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

    // Auto-reload SSE
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
  
  // API: Escanear y listar todos los archivos .md del proyecto
  if (parsedUrl.pathname === '/api/list-markdown') {
    const listaMd = escanearArchivosMd(ROOT_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(listaMd));
    return;
  }

  // API: Leer contenido de cualquier archivo .md por su ruta
  if (parsedUrl.pathname === '/api/file') {
    const reqPath = parsedUrl.searchParams.get('path');
    if (!reqPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no especificada' }));
      return;
    }

    // Intentar resolver la ruta
    let fullPath = path.isAbsolute(reqPath) ? reqPath : path.resolve(ROOT_DIR, reqPath);
    
    // Si no termina en .md y existe agregándolo
    if (!fs.existsSync(fullPath) && fs.existsSync(fullPath + '.md')) {
      fullPath = fullPath + '.md';
    }

    if (!fs.existsSync(fullPath)) {
      res.writeHead(440, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: `El archivo no existe: ${reqPath}` }));
      return;
    }

    targetFile = fullPath; // Actualizar el archivo observado
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Error al leer el archivo' }));
        return;
      }
      
      const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        name: path.basename(fullPath),
        relPath: relPath,
        content: data
      }));
    });
    return;
  }

  // EventSource para Auto-Reload SSE
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

  // Servir la página HTML principal
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
  console.log(`🚀 Visor Markdown Universal Activo con Selector y Entrada de Ruta`);
  console.log(`📄 Archivo Inicial: ${targetFile}`);
  console.log(`🌐 Navegar a: ${url}`);
  console.log(`====================================================`);

  exec(`start ${url}`);
});
