"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Check, X, Search, Plus, Bold, Italic, Underline, List, Heading, Link as LinkIcon, Code, ShieldCheck } from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase";
import { enviarSolicitudSocio, registrarDocumentoSocio } from "../acciones";
import { ENLACES_VERIFICACION, type DatosExperienciaLaboral } from "../esquema";

interface Props {
  usuarioId: string;
  materias: { mat_id: string; mat_nombre: string }[];
  provincias: { cat_id: string; cat_nombre: string }[];
  correoInicial?: string | null;
}

interface OpcionItem {
  id: string;
  nombre: string;
}

const EXPERIENCIA_VACIA: DatosExperienciaLaboral = { empresa: "", cargo: "", fechaInicio: "", fechaFin: "", descripcion: "" };
const TIPOS_ACEPTADOS =
  "application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text";
const TAMANO_MAXIMO_MB = 15;

async function subirDocumento(solicitudId: string, tipo: "titulo" | "matricula" | "otro", archivo: File) {
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

// Componente Editor HTML para "Cuéntanos por qué quieres unirte a la red"
function EditorHtmlResumen({ valor, onChange }: { valor: string; onChange: (val: string) => void }) {
  const [modoHtml, setModoHtml] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

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

  return (
    <div style={{ border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "10px", overflow: "hidden", background: "#ffffff" }}>
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
          rows={5}
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
          onInput={() => editorRef.current && onChange(editorRef.current.innerHTML)}
          style={{
            minHeight: "110px",
            maxHeight: "260px",
            padding: "12px",
            fontSize: "0.88rem",
            color: "#111111",
            outline: "none",
            overflowY: "auto",
            lineHeight: "1.5",
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

// Componente Selector Multiselección Avanzado con "Otros" (Editable) para Web & Mobile
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

  // Mapear IDs o texto libre a nombres legibles
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
            Ninguno seleccionado. Haz clic abajo para agregar...
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
            {abierto ? "▲ Cerrar" : "▼ Desplegar Opciones"}
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

            {/* Lista de Opciones */}
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", paddingRight: "4px" }}>
              {filtradas.map((o) => {
                const checked = seleccionados.includes(o.id);
                return (
                  <label
                    key={o.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: checked ? "var(--violeta-suave, #F3E8FF)" : "transparent",
                      cursor: "pointer",
                      fontSize: "0.84rem",
                      fontWeight: checked ? 800 : 500,
                      color: checked ? "var(--violeta, #5000BA)" : "var(--negro, #111111)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => alternarId(o.id)}
                      style={{ accentColor: "var(--violeta, #5000BA)", width: "16px", height: "16px" }}
                    />
                    <span>{o.nombre}</span>
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

export function FormularioSolicitudSocio({ usuarioId, materias, provincias }: Props) {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [matriculaProfesional, setMatriculaProfesional] = useState("");
  const [universidad, setUniversidad] = useState("");
  const [anioGraduacion, setAnioGraduacion] = useState("");
  const [anosExperiencia, setAnosExperiencia] = useState("");
  const [resumenProfesional, setResumenProfesional] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [materiaIds, setMateriaIds] = useState<string[]>([]);
  const [provinciaIds, setProvinciaIds] = useState<string[]>([]);
  const [experiencia, setExperiencia] = useState<DatosExperienciaLaboral[]>([]);
  const [certificados, setCertificados] = useState<File[]>([]);
  const [tituloArchivo, setTituloArchivo] = useState<File | null>(null);
  const [matriculaArchivo, setMatriculaArchivo] = useState<File | null>(null);
  const [senescytVerificado, setSenescytVerificado] = useState(false);
  const [declaracion, setDeclaracion] = useState(false);
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
    const subidas = await Promise.all([
      tituloArchivo ? subirDocumento(solicitudId, "titulo", tituloArchivo) : null,
      matriculaArchivo ? subirDocumento(solicitudId, "matricula", matriculaArchivo) : null,
      ...certificados.map((archivo) => subirDocumento(solicitudId, "otro", archivo)),
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
      <label>
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

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span style={{ fontWeight: 700, display: "block", marginBottom: "6px" }}>
          Cuéntanos por qué quieres unirte a la red (Formato HTML / Rich Text)
        </span>
        <EditorHtmlResumen valor={resumenProfesional} onChange={setResumenProfesional} />
      </label>

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

      <label style={{ marginTop: "12px" }}>
        Certificados o cartas de referencia (opcional, PDF/imagen/Word, máx {TAMANO_MAXIMO_MB}MB c/u)
        <input
          type="file"
          multiple
          accept={TIPOS_ACEPTADOS}
          onChange={(e) => setCertificados(Array.from(e.target.files ?? []))}
        />
      </label>

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

      <label>
        Documento del título (PDF o imagen, máx {TAMANO_MAXIMO_MB}MB)
        <input type="file" accept={TIPOS_ACEPTADOS} onChange={(e) => setTituloArchivo(e.target.files?.[0] ?? null)} />
      </label>

      <label>
        Documento o Carné de la matrícula (PDF o imagen, máx {TAMANO_MAXIMO_MB}MB)
        <input type="file" accept={TIPOS_ACEPTADOS} onChange={(e) => setMatriculaArchivo(e.target.files?.[0] ?? null)} />
      </label>

      {/* Sección de Términos de Servicio y Autorización de Verificación LOPDP */}
      <div style={{ background: "rgba(80, 0, 186, 0.05)", border: "1px solid rgba(80, 0, 186, 0.2)", borderRadius: "12px", padding: "16px", marginTop: "20px" }}>
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
          {enviando ? "Enviando Solicitud..." : "Enviar Solicitud de Socio Abogado"}
        </button>
      )}
    </form>
  );
}
