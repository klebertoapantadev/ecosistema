"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Check, X, Search, Plus, Bold, Italic, Underline, List, Heading, Link as LinkIcon, Code, ShieldCheck, UploadCloud, FileText, Camera, Paperclip, Trash2, Image as ImageIcon } from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase";
import { enviarSolicitudSocio, registrarDocumentoSocio } from "../acciones";
import { ENLACES_VERIFICACION, type DatosExperienciaLaboral } from "../esquema";

interface Props {
  usuarioId: string;
  materias: { mat_id: string; mat_nombre: string }[];
  provincias: { cat_id: string; cat_nombre: string }[];
  correoInicial?: string | null;
  solicitudExistente?: Record<string, unknown> | null;
}

interface OpcionItem {
  id: string;
  nombre: string;
}

const EXPERIENCIA_VACIA: DatosExperienciaLaboral = { empresa: "", cargo: "", fechaInicio: "", fechaFin: "", descripcion: "" };
const TIPOS_ACEPTADOS =
  "application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text";
const TAMANO_MAXIMO_MB = 10;

function formatoTamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function subirDocumento(
  solicitudId: string,
  tipo: "foto_perfil" | "titulo" | "matricula" | "otro" | "cv",
  archivo: File,
) {
  if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    return { ok: false as const, error: `${archivo.name}: supera ${TAMANO_MAXIMO_MB}MB` };
  }
  const supabase = crearClienteNavegador();
  const path = `${solicitudId}/${tipo}-${crypto.randomUUID()}-${archivo.name}`;
  const { error: errorSubida } = await supabase.storage.from("socios-documentos").upload(path, archivo);
  if (errorSubida) return { ok: false as const, error: `${archivo.name}: ${errorSubida.message}` };

  const resultado = await registrarDocumentoSocio(solicitudId, tipo, path, archivo.name);
  if (!resultado.ok) return { ok: false as const, error: `${archivo.name}: ${resultado.error}` };
  return { ok: true as const };
}

// Componente Custom de Carga de Archivos con Botón y Dropzone Estilizados
function CampoSubidaArchivo({
  etiqueta,
  subtitulo,
  aceptar,
  multiple = false,
  archivos,
  onCambiar,
  icono: IconoComp = FileText,
  esFotoPerfil = false,
}: {
  etiqueta: string;
  subtitulo: string;
  aceptar: string;
  multiple?: boolean;
  archivos: File[];
  onCambiar: (nuevos: File[]) => void;
  icono?: React.ElementType;
  esFotoPerfil?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const manejarSeleccion = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorLocal(null);
    const lista = Array.from(e.target.files ?? []);
    if (lista.length === 0) return;

    // Validar tamaño máximo
    const excede = lista.find((f) => f.size > TAMANO_MAXIMO_MB * 1024 * 1024);
    if (excede) {
      setErrorLocal(`El archivo "${excede.name}" supera el tamaño máximo permitido de ${TAMANO_MAXIMO_MB} MB.`);
      return;
    }

    if (multiple) {
      onCambiar([...archivos, ...lista]);
    } else {
      onCambiar([lista[0]!]);
    }
  };

  const eliminarArchivo = (index: number) => {
    onCambiar(archivos.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "12px" }}>
      <label style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--negro, #111111)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
        <IconoComp size={17} color="var(--violeta, #5000BA)" />
        {etiqueta}
      </label>
      <span style={{ fontSize: "0.76rem", color: "var(--panel-gris, #737373)" }}>{subtitulo}</span>

      {/* Dropzone Estilizada */}
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: "2px dashed rgba(80, 0, 186, 0.3)",
          background: "rgba(80, 0, 186, 0.03)",
          borderRadius: "12px",
          padding: "16px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.15s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={aceptar}
          multiple={multiple}
          onChange={manejarSeleccion}
          style={{ display: "none" }}
        />

        <div style={{ background: "#ffffff", padding: "10px", borderRadius: "50%", border: "1px solid rgba(80,0,186,0.2)", color: "var(--violeta, #5000BA)", display: "flex" }}>
          <UploadCloud size={22} />
        </div>
        <div>
          <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "var(--violeta, #5000BA)" }}>
            {archivos.length > 0 ? "Añadir / Cambiar archivos" : "Seleccionar o arrastrar archivos"}
          </span>
          <span style={{ display: "block", fontSize: "0.72rem", color: "var(--panel-gris, #737373)", marginTop: "2px" }}>
            Formatos admitidos: PDF, Word, JPG, PNG • Máx {TAMANO_MAXIMO_MB} MB c/u
          </span>
        </div>
      </div>

      {errorLocal && <p style={{ fontSize: "0.78rem", color: "#DC2626", fontWeight: 700, margin: 0 }}>⚠️ {errorLocal}</p>}

      {/* Lista de archivos adjuntados con vista previa */}
      {archivos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
          {archivos.map((file, idx) => {
            const esImagen = file.type.startsWith("image/");
            const previewUrl = esImagen ? URL.createObjectURL(file) : null;

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  {esFotoPerfil && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Vista previa"
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid #5000BA" }}
                    />
                  ) : (
                    <Paperclip size={16} color="var(--violeta, #5000BA)" style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ overflow: "hidden" }}>
                    <strong style={{ display: "block", color: "#111111", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {file.name}
                    </strong>
                    <span style={{ fontSize: "0.72rem", color: "var(--panel-gris, #737373)" }}>
                      {formatoTamanoArchivo(file.size)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => eliminarArchivo(idx)}
                  style={{
                    background: "rgba(220, 38, 38, 0.08)",
                    color: "#DC2626",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Quitar archivo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Componente Editor HTML para "Cuéntanos por qué quieres unirte a la red"
function EditorHtmlResumen({ valor, onChange }: { valor: string; onChange: (val: string) => void }) {
  const [modoHtml, setModoHtml] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputImagenRef = useRef<HTMLInputElement>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current && !modoHtml && editorRef.current.innerHTML !== valor) {
      editorRef.current.innerHTML = valor;
    }
  }, [valor, modoHtml]);

  const aplicarComando = (comando: string, arg: string | undefined = undefined) => {
    document.execCommand(comando, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const agregarEnlace = () => {
    const url = prompt("Ingresa la URL del enlace (ej: https://...):");
    if (url) {
      aplicarComando("createLink", url);
    }
  };

  const insertarHtmlEnCursor = (htmlText: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement("div");
      el.innerHTML = htmlText;
      const frag = document.createDocumentFragment();
      let node: Node | null;
      let lastNode: Node | null = null;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += htmlText;
    }
    onChange(editorRef.current.innerHTML);
  };

  const manejarPegar = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items ?? []);
    const imagenItem = items.find((item) => item.type.startsWith("image/"));

    if (imagenItem) {
      e.preventDefault();
      const file = imagenItem.getAsFile();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          insertarHtmlEnCursor(`<img src="${dataUrl}" style="max-width:100%; border-radius:8px; margin:8px 0; display:block;" alt="Imagen pegada" />`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const manejarSeleccionImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        insertarHtmlEnCursor(`<img src="${dataUrl}" style="max-width:100%; border-radius:8px; margin:8px 0; display:block;" alt="${file.name}" />`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const manejarSeleccionArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        insertarHtmlEnCursor(
          `<a href="${dataUrl}" download="${file.name}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:#F3E8FF; color:#5000BA; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.82rem; margin:4px 0;">📎 ${file.name} (${formatoTamanoArchivo(file.size)})</a>`
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div style={{ border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "10px", overflow: "hidden", background: "#ffffff" }}>
      <input ref={inputImagenRef} type="file" accept="image/*" onChange={manejarSeleccionImagen} style={{ display: "none" }} />
      <input ref={inputArchivoRef} type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={manejarSeleccionArchivo} style={{ display: "none" }} />

      {/* Barra de herramientas HTML */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "4px",
          padding: "8px 10px",
          background: "var(--panel-papel, #F7F6FA)",
          borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
        }}
      >
        <button type="button" title="Negrita" onClick={() => aplicarComando("bold")} style={btnToolStyle}>
          <Bold size={14} />
        </button>
        <button type="button" title="Cursiva" onClick={() => aplicarComando("italic")} style={btnToolStyle}>
          <Italic size={14} />
        </button>
        <button type="button" title="Subrayado" onClick={() => aplicarComando("underline")} style={btnToolStyle}>
          <Underline size={14} />
        </button>
        <div style={{ width: "1px", height: "18px", background: "#E4E4E4", margin: "0 4px" }} />
        <button type="button" title="Lista de viñetas" onClick={() => aplicarComando("insertUnorderedList")} style={btnToolStyle}>
          <List size={14} />
        </button>
        <button type="button" title="Encabezado h3" onClick={() => aplicarComando("formatBlock", "<h3>")} style={btnToolStyle}>
          <Heading size={14} />
        </button>
        <button type="button" title="Agregar enlace" onClick={agregarEnlace} style={btnToolStyle}>
          <LinkIcon size={14} />
        </button>
        <div style={{ width: "1px", height: "18px", background: "#E4E4E4", margin: "0 4px" }} />
        <button type="button" title="Insertar imagen" onClick={() => inputImagenRef.current?.click()} style={btnToolStyle}>
          <ImageIcon size={14} color="var(--violeta, #5000BA)" />
        </button>
        <button type="button" title="Adjuntar archivo" onClick={() => inputArchivoRef.current?.click()} style={btnToolStyle}>
          <Paperclip size={14} color="var(--violeta, #5000BA)" />
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setModoHtml(!modoHtml)}
            style={{
              ...btnToolStyle,
              background: modoHtml ? "var(--violeta-suave, #F3E8FF)" : "transparent",
              color: modoHtml ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
              fontWeight: 700,
              padding: "4px 8px",
              fontSize: "0.72rem",
            }}
          >
            <Code size={13} /> {modoHtml ? "Vista Visual" : "Código HTML"}
          </button>
        </div>
      </div>

      {/* Áreas de Edición */}
      {modoHtml ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder="Escribe o edita etiquetas HTML..."
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "0.84rem",
            fontFamily: "monospace",
            border: "none",
            outline: "none",
            background: "#1E1E2E",
            color: "#A6ADC8",
            resize: "vertical",
          }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => editorRef.current && onChange(editorRef.current.innerHTML)}
          onBlur={() => editorRef.current && onChange(editorRef.current.innerHTML)}
          onPaste={manejarPegar}
          style={{
            minHeight: "120px",
            maxHeight: "320px",
            padding: "12px",
            fontSize: "0.88rem",
            color: "#111111",
            outline: "none",
            overflowY: "auto",
            lineHeight: "1.5",
            cursor: "text",
          }}
        />
      )}
    </div>
  );
}

const btnToolStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid var(--panel-linea, #E4E4E4)",
  borderRadius: "6px",
  padding: "4px 8px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#333333",
};

// Componente Selector Multiselección Ajustado (Resuelve la alineación vertical de checkboxes)
function SelectorMultiSeleccion({
  opciones,
  seleccionados,
  onCambiar,
  placeholderBusqueda,
  labelOtros,
}: {
  opciones: OpcionItem[];
  seleccionados: string[];
  onCambiar: (nuevos: string[]) => void;
  placeholderBusqueda: string;
  labelOtros: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoOtros, setModoOtros] = useState(false);
  const [textoOtros, setTextoOtros] = useState("");

  const filtradas = opciones.filter((o) => o.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const alternarId = (id: string) => {
    if (seleccionados.includes(id)) {
      onCambiar(seleccionados.filter((x) => x !== id));
    } else {
      onCambiar([...seleccionados, id]);
    }
  };

  const agregarPersonalizado = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const valorLimpio = textoOtros.trim();
    if (!valorLimpio) return;
    if (!seleccionados.includes(valorLimpio)) {
      onCambiar([...seleccionados, valorLimpio]);
    }
    setTextoOtros("");
  };

  const eliminarSeleccionado = (item: string) => {
    onCambiar(seleccionados.filter((x) => x !== item));
  };

  const obtenerNombreLegible = (idOrText: string) => {
    const coincidencia = opciones.find((o) => o.id === idOrText);
    return coincidencia ? coincidencia.nombre : idOrText;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      {/* Tags seleccionados */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          minHeight: "42px",
          padding: "8px 10px",
          background: "var(--panel-papel, #F7F6FA)",
          borderRadius: "10px",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          alignItems: "center",
        }}
      >
        {seleccionados.length === 0 ? (
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontStyle: "italic" }}>
            Ninguno seleccionado. Haz clic abajo para desplegar opciones...
          </span>
        ) : (
          seleccionados.map((item) => (
            <span
              key={item}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "999px",
                background: "var(--violeta-suave, #F3E8FF)",
                color: "var(--violeta, #5000BA)",
                fontSize: "0.8rem",
                fontWeight: 700,
                border: "1px solid rgba(80, 0, 186, 0.2)",
              }}
            >
              {obtenerNombreLegible(item)}
              <button
                type="button"
                onClick={() => eliminarSeleccionado(item)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--violeta, #5000BA)", display: "flex", padding: 0 }}
                title="Eliminar"
              >
                <X size={13} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Botón de Apertura del Desplegable */}
      <div style={{ position: "relative", width: "100%" }}>
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid var(--panel-linea, #E4E4E4)",
            background: "#ffffff",
            fontSize: "0.86rem",
            fontWeight: 700,
            color: "var(--negro, #111111)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <span>Seleccionar ({seleccionados.length} seleccionados)</span>
          <span style={{ fontSize: "0.75rem", color: "var(--violeta, #5000BA)", fontWeight: 800 }}>
            {abierto ? "▲ Cerrar Opciones" : "▼ Desplegar Opciones"}
          </span>
        </button>

        {/* Modal / Menú Desplegable Multiselección */}
        {abierto && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
              zIndex: 100,
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxHeight: "320px",
            }}
          >
            {/* Buscador */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--panel-papel, #F7F6FA)", padding: "6px 10px", borderRadius: "8px", border: "1px solid #E4E4E4" }}>
              <Search size={15} color="var(--panel-gris, #737373)" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={placeholderBusqueda}
                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: "0.84rem" }}
              />
            </div>

            {/* Lista de Opciones Estilizada Horizontalmente (Sin Checkbox Centrado Vertical) */}
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", paddingRight: "4px" }}>
              {filtradas.map((o) => {
                const checked = seleccionados.includes(o.id);
                return (
                  <label
                    key={o.id}
                    onClick={(e) => {
                      e.preventDefault();
                      alternarId(o.id);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: checked ? "#F3E8FF" : "#FFFFFF",
                      border: checked ? "1px solid #5000BA" : "1px solid #E4E4E4",
                      cursor: "pointer",
                      fontSize: "0.86rem",
                      fontWeight: checked ? 700 : 500,
                      color: checked ? "#5000BA" : "#111111",
                      textAlign: "left",
                      margin: 0,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <span
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        border: checked ? "2px solid #5000BA" : "1.5px solid #A0A0A0",
                        background: checked ? "#5000BA" : "#FFFFFF",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {checked && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, textAlign: "left" }}>{o.nombre}</span>
                  </label>
                );
              })}
            </div>

            {/* Opción Otros (editable) */}
            <div style={{ borderTop: "1px solid #E4E4E4", paddingTop: "8px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setModoOtros(!modoOtros)}
                style={{
                  background: "rgba(80, 0, 186, 0.08)",
                  color: "var(--violeta, #5000BA)",
                  border: "1px dashed var(--violeta, #5000BA)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Plus size={14} /> {labelOtros}
              </button>

              {modoOtros && (
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <input
                    type="text"
                    value={textoOtros}
                    onChange={(e) => setTextoOtros(e.target.value)}
                    placeholder="Escribe la opción personalizada..."
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #E4E4E4",
                      fontSize: "0.82rem",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={agregarPersonalizado}
                    style={{
                      background: "var(--violeta, #5000BA)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Añadir
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function FormularioSolicitudSocio({ usuarioId, materias, provincias, solicitudExistente }: Props) {
  const router = useRouter();
  const [cedula, setCedula] = useState<string>((solicitudExistente?.ssc_cedula as string) ?? "");
  const [matriculaProfesional, setMatriculaProfesional] = useState<string>((solicitudExistente?.ssc_matricula_profesional as string) ?? "");
  const [universidad, setUniversidad] = useState<string>((solicitudExistente?.ssc_universidad as string) ?? "");
  const [anioGraduacion, setAnioGraduacion] = useState<string>(solicitudExistente?.ssc_anio_graduacion ? String(solicitudExistente.ssc_anio_graduacion) : "");
  const [anosExperiencia, setAnosExperiencia] = useState<string>(solicitudExistente?.ssc_anos_experiencia !== undefined ? String(solicitudExistente.ssc_anos_experiencia) : "");
  const [resumenProfesional, setResumenProfesional] = useState<string>((solicitudExistente?.ssc_resumen_profesional as string) ?? "");
  const [telefonoContacto, setTelefonoContacto] = useState<string>((solicitudExistente?.ssc_telefono_contacto as string) ?? "");
  const [materiaIds, setMateriaIds] = useState<string[]>(
    () => ((solicitudExistente?.trq_solicitud_materia as Record<string, unknown>[]) ?? []).map((m) => m.sma_materia_id as string).filter(Boolean)
  );
  const [provinciaIds, setProvinciaIds] = useState<string[]>(
    () => ((solicitudExistente?.trq_solicitud_provincia as Record<string, unknown>[]) ?? []).map((p) => p.spr_provincia_id as string).filter(Boolean)
  );
  const [experiencia, setExperiencia] = useState<DatosExperienciaLaboral[]>(
    () => ((solicitudExistente?.trq_experiencia_laboral as Record<string, unknown>[]) ?? []).map((e) => ({
      empresa: (e.exp_empresa as string) ?? "",
      cargo: (e.exp_cargo as string) ?? "",
      fechaInicio: (e.exp_fecha_inicio as string) ?? "",
      fechaFin: (e.exp_fecha_fin as string) ?? "",
      descripcion: (e.exp_descripcion as string) ?? "",
    }))
  );
  const [fotoPerfilArchivos, setFotoPerfilArchivos] = useState<File[]>([]);
  const [tituloArchivos, setTituloArchivos] = useState<File[]>([]);
  const [cvYCertificados, setCvYCertificados] = useState<File[]>([]);
  const [senescytVerificado, setSenescytVerificado] = useState(Boolean(solicitudExistente?.ssc_enlace_senescyt_verificado));
  const [declaracion, setDeclaracion] = useState(Boolean(solicitudExistente));
  const [error, setError] = useState<string | null>(null);
  const [avisoArchivos, setAvisoArchivos] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const opcionesMaterias: OpcionItem[] = materias.map((m) => ({ id: m.mat_id, nombre: m.mat_nombre }));
  const opcionesProvincias: OpcionItem[] = provincias.map((p) => ({ id: p.cat_id, nombre: p.cat_nombre }));

  const actualizarExperiencia = (i: number, campo: keyof DatosExperienciaLaboral, valor: string) =>
    setExperiencia((prev) => prev.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAvisoArchivos(null);

    if (!declaracion) {
      setError("Debes aceptar los Términos de Servicio y la Autorización de Verificación LOPDP.");
      return;
    }

    setEnviando(true);
    const resultado = await enviarSolicitudSocio(
      {
        cedula,
        matriculaProfesional,
        universidad,
        anioGraduacion: Number(anioGraduacion),
        anosExperiencia: Number(anosExperiencia || 0),
        resumenProfesional,
        telefonoContacto,
        materiaIds,
        provinciaIds,
        experiencia,
        enlaceSenescytVerificado: senescytVerificado,
        enlaceForoVerificado: true,
        declaracionVeracidad: declaracion,
      },
      usuarioId,
    );
    if (!resultado.ok) {
      setEnviando(false);
      setError(resultado.error);
      return;
    }

    const solicitudId = resultado.data.solicitudId;

    // Subida de archivos con control de formato y tamaño
    const fotoArchivo = fotoPerfilArchivos[0];
    const tituloArchivo = tituloArchivos[0];

    const subidas = await Promise.all([
      fotoArchivo ? subirDocumento(solicitudId, "foto_perfil", fotoArchivo) : null,
      tituloArchivo ? subirDocumento(solicitudId, "titulo", tituloArchivo) : null,
      ...cvYCertificados.map((archivo) => subirDocumento(solicitudId, "cv", archivo)),
    ]);
    const fallidas = subidas.filter((s): s is { ok: false; error: string } => s !== null && !s.ok);

    setEnviando(false);
    if (fallidas.length > 0) {
      setAvisoArchivos(
        `Tu solicitud se envió correctamente, pero estos archivos no se pudieron subir: ${fallidas.map((f) => f.error).join("; ")}.`,
      );
      return;
    }
    router.push("/panel/solicitud-socio");
    router.refresh();
  }

  return (
    <form className="form-panel form-solicitud-socio" onSubmit={onSubmit}>
      <h2>Datos profesionales</h2>

      {/* Campo Foto para Perfil Profesional */}
      <CampoSubidaArchivo
        etiqueta="Foto para el Perfil Profesional (Requerido)"
        subtitulo="Fotografía clara tipo carné o retrato profesional para tu perfil público en la red"
        aceptar="image/jpeg,image/png,image/webp"
        multiple={false}
        archivos={fotoPerfilArchivos}
        onCambiar={setFotoPerfilArchivos}
        icono={Camera}
        esFotoPerfil={true}
      />

      <label style={{ marginTop: "16px" }}>
        Cédula de Identidad
        <input value={cedula} onChange={(e) => setCedula(e.target.value)} required maxLength={13} placeholder="ej. 1714898226" />
      </label>

      <label>
        Matrícula profesional (Foro de Abogados)
        <input value={matriculaProfesional} onChange={(e) => setMatriculaProfesional(e.target.value)} required placeholder="ej. 17-2020-89" />
      </label>

      <label>
        Universidad de graduación
        <input value={universidad} onChange={(e) => setUniversidad(e.target.value)} required placeholder="ej. Universidad Central del Ecuador" />
      </label>

      <div className="fila-dos-columnas">
        <label>
          Año de graduación
          <input type="number" value={anioGraduacion} onChange={(e) => setAnioGraduacion(e.target.value)} required min={1960} max={new Date().getFullYear()} placeholder="2020" />
        </label>
        <label>
          Años de experiencia
          <input type="number" value={anosExperiencia} onChange={(e) => setAnosExperiencia(e.target.value)} min={0} max={70} placeholder="5" />
        </label>
      </div>

      <label>
        Teléfono de contacto (Móvil / WhatsApp)
        <input
          type="tel"
          value={telefonoContacto}
          onChange={(e) => setTelefonoContacto(e.target.value)}
          placeholder="ej. 099 123 4567 o +593 99 123 4567"
        />
      </label>

      <div style={{ display: "block", marginBottom: "16px" }}>
        <span style={{ fontWeight: 700, display: "block", marginBottom: "6px" }}>
          Cuéntanos por qué quieres unirte a la red (Formato HTML / Rich Text)
        </span>
        <EditorHtmlResumen valor={resumenProfesional} onChange={setResumenProfesional} />
      </div>

      <h2>Especialidades profesionales</h2>
      <SelectorMultiSeleccion
        opciones={opcionesMaterias}
        seleccionados={materiaIds}
        onCambiar={setMateriaIds}
        placeholderBusqueda="🔍 Buscar especialidades..."
        labelOtros="✨ Añadir otra especialidad (Personalizado)"
      />

      <h2 style={{ marginTop: "24px" }}>Cobertura geográfica</h2>
      <SelectorMultiSeleccion
        opciones={opcionesProvincias}
        seleccionados={provinciaIds}
        onCambiar={setProvinciaIds}
        placeholderBusqueda="🔍 Buscar provincias..."
        labelOtros="✨ Añadir otra provincia o ubicación..."
      />

      <h2 style={{ marginTop: "24px" }}>Experiencia laboral</h2>
      {experiencia.map((exp, i) => (
        <div key={i} className="tarjeta-experiencia">
          <div className="fila-dos-columnas">
            <label>
              Empresa / Firma Jurídica
              <input value={exp.empresa} onChange={(e) => actualizarExperiencia(i, "empresa", e.target.value)} required />
            </label>
            <label>
              Cargo
              <input value={exp.cargo} onChange={(e) => actualizarExperiencia(i, "cargo", e.target.value)} required />
            </label>
          </div>
          <div className="fila-dos-columnas">
            <label>
              Desde
              <input type="date" value={exp.fechaInicio} onChange={(e) => actualizarExperiencia(i, "fechaInicio", e.target.value)} required />
            </label>
            <label>
              Hasta (vacío si es tu trabajo actual)
              <input type="date" value={exp.fechaFin} onChange={(e) => actualizarExperiencia(i, "fechaFin", e.target.value)} />
            </label>
          </div>
          <label>
            Descripción breve
            <input value={exp.descripcion} onChange={(e) => actualizarExperiencia(i, "descripcion", e.target.value)} />
          </label>
          <button type="button" className="btn-mini" onClick={() => setExperiencia((prev) => prev.filter((_, idx) => idx !== i))}>
            Quitar
          </button>
        </div>
      ))}
      <button type="button" className="btn-mini" onClick={() => setExperiencia((prev) => [...prev, { ...EXPERIENCIA_VACIA }])}>
        + Agregar experiencia
      </button>

      {/* Campo Hoja de Vida (CV), Certificados o cartas de referencia */}
      <CampoSubidaArchivo
        etiqueta="Hoja de Vida (CV), Certificados o cartas de referencia (opcional)"
        subtitulo="Adjunta tu CV actualizado, certificados de capacitación o cartas de recomendación en formato PDF, Word o imagen (máx 10 MB cada uno)"
        aceptar={TIPOS_ACEPTADOS}
        multiple={true}
        archivos={cvYCertificados}
        onCambiar={setCvYCertificados}
        icono={FileText}
      />

      <h2>Verificación asistida de título</h2>
      <p className="aviso-borrador">
        Para agilizar tu acreditación, consulta tu título en la plataforma de la SENESCYT y adjunta una copia digital.
      </p>

      <label className="campo-check">
        <input type="checkbox" checked={senescytVerificado} onChange={(e) => setSenescytVerificado(e.target.checked)} />
        Verifiqué mi título en el portal oficial de la{" "}
        <a href={ENLACES_VERIFICACION.senescyt} target="_blank" rel="noopener noreferrer">
          SENESCYT <ExternalLink className="icono-enlace-externo" aria-hidden="true" strokeWidth={2} />
        </a>
      </label>

      {/* Documento del Título */}
      <CampoSubidaArchivo
        etiqueta="Documento del Título Profesional (Requerido)"
        subtitulo="Copia digital del título universitario registrado en la SENESCYT (PDF o imagen, máx 10 MB)"
        aceptar={TIPOS_ACEPTADOS}
        multiple={false}
        archivos={tituloArchivos}
        onCambiar={setTituloArchivos}
        icono={FileText}
      />

      {/* Sección de Términos de Servicio y Autorización de Verificación LOPDP */}
      <div style={{ background: "rgba(80, 0, 186, 0.05)", border: "1px solid rgba(80, 0, 186, 0.2)", borderRadius: "12px", padding: "16px", marginTop: "24px" }}>
        <label className="campo-check" style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={declaracion}
            onChange={(e) => setDeclaracion(e.target.checked)}
            required
            style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "var(--violeta, #5000BA)" }}
          />
          <span style={{ fontSize: "0.86rem", color: "#111111", lineHeight: "1.45" }}>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--violeta, #5000BA)" }}>
              <ShieldCheck size={16} /> Términos de Servicio & Autorización de Verificación (LOPDP):
            </strong>
            <br />
            Autorizo expresamente a <strong>tranqi</strong> a verificar la autenticidad de mi título profesional en el portal de la <strong>SENESCYT</strong>, la vigencia de mi matrícula en el <strong>Foro de Abogados del Consejo de la Judicatura</strong> y la veracidad de la información y documentación proporcionada conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP).
          </span>
        </label>
      </div>

      {error && <p className="error-auth" style={{ marginTop: "16px" }}>{error}</p>}
      {avisoArchivos ? (
        <>
          <p className="aviso-borrador">{avisoArchivos}</p>
          <button type="button" className="btn btn-primario" onClick={() => router.push("/panel/solicitud-socio")}>
            Continuar
          </button>
        </>
      ) : (
        <button type="submit" className="btn btn-primario" disabled={enviando} style={{ marginTop: "16px" }}>
          {enviando
            ? "Guardando..."
            : solicitudExistente
            ? "Guardar Cambios y Enviar Actualización"
            : "Enviar Solicitud de Socio Abogado"}
        </button>
      )}
    </form>
  );
}
