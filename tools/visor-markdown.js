const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3333;
const DEFAULT_FILE = path.join(__dirname, '../gobernanza/productos/plataforma/especificacion-funcional.md');

let targetFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;

if (!fs.existsSync(targetFile)) {
  console.error(`El archivo no existe: ${targetFile}`);
  process.exit(1);
}

function generarHTML(contenidoMd, titulo) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visor Markdown · ${titulo}</title>
  
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
      width: 340px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    
    .sidebar-header {
      padding: 18px 16px;
      border-bottom: 1px solid var(--border-color);
      background-color: #0d1117;
    }

    .sidebar-header h2 {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sidebar-header .filename {
      font-size: 0.8rem;
      color: #8b949e;
      margin-top: 6px;
      word-break: break-all;
    }

    #toc {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
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
      line-height: 1.3;
      transition: background 0.15s, color 0.15s;
    }

    #toc a:hover {
      background-color: rgba(110, 118, 129, 0.15);
      color: var(--text-color);
    }

    #toc a.active {
      color: var(--accent-color);
      font-weight: 600;
      background-color: rgba(56, 139, 253, 0.15);
    }

    #main-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px 56px;
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

    .top-actions {
      position: fixed;
      top: 16px;
      right: 24px;
      display: flex;
      gap: 8px;
      z-index: 100;
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
      transition: background 0.2s;
    }

    .btn:hover {
      background-color: #30363d;
      border-color: #8b949e;
    }
  </style>
</head>
<body>

  <aside id="sidebar">
    <div class="sidebar-header">
      <h2>📖 Visor de Markdown</h2>
      <div class="filename" id="file-title">${titulo}</div>
    </div>
    <nav id="toc">
      <p style="padding: 12px; color: #8b949e; font-size: 0.85rem;">Cargando índice...</p>
    </nav>
  </aside>

  <main id="main-content">
    <div class="top-actions">
      <button class="btn" onclick="document.getElementById('main-content').scrollTo({top: 0, behavior: 'smooth'})">⬆ Arriba</button>
      <button class="btn" onclick="location.reload()">🔄 Recargar</button>
    </div>
    
    <article class="markdown-body" id="rendered-content">
    </article>
  </main>

  <script>
    const rawMarkdown = ${JSON.stringify(contenidoMd)};

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

    document.getElementById('rendered-content').innerHTML = marked.parse(rawMarkdown);

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

    const evtSource = new EventSource('/events');
    evtSource.onmessage = function(e) {
      if (e.data === 'reload') {
        location.reload();
      }
    };
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/events') {
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
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error al leer el archivo markdown');
      return;
    }
    
    const filename = path.basename(targetFile);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generarHTML(data, filename));
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`====================================================`);
  console.log(`🚀 Visor Visual de Markdown Activo`);
  console.log(`📄 Archivo: ${targetFile}`);
  console.log(`🌐 Navegar a: ${url}`);
  console.log(`====================================================`);

  exec(`start ${url}`);
});
