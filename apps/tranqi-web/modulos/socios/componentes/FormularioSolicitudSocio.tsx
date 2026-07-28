"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enviarSolicitudSocio } from "../acciones";
import { ENLACES_VERIFICACION, type DatosExperienciaLaboral } from "../esquema";

interface Props {
  usuarioId: string;
  materias: { mat_id: string; mat_nombre: string }[];
  provincias: { cat_id: string; cat_nombre: string }[];
  correoInicial?: string | null;
}

const EXPERIENCIA_VACIA: DatosExperienciaLaboral = { empresa: "", cargo: "", fechaInicio: "", fechaFin: "", descripcion: "" };

export function FormularioSolicitudSocio({ usuarioId, materias, provincias, correoInicial }: Props) {
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
  const [senescytVerificado, setSenescytVerificado] = useState(false);
  const [foroVerificado, setForoVerificado] = useState(false);
  const [declaracion, setDeclaracion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const alternar = (lista: string[], id: string, set: (v: string[]) => void) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const actualizarExperiencia = (i: number, campo: keyof DatosExperienciaLaboral, valor: string) =>
    setExperiencia((prev) => prev.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        enlaceForoVerificado: foroVerificado,
        declaracionVeracidad: declaracion,
      },
      usuarioId,
    );
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/panel/solicitud-socio");
    router.refresh();
  }

  return (
    <form className="form-panel form-solicitud-socio" onSubmit={onSubmit}>
      <h2>Datos profesionales</h2>
      <label>
        Cédula
        <input value={cedula} onChange={(e) => setCedula(e.target.value)} required maxLength={13} />
      </label>
      <label>
        Matrícula profesional (Foro de Abogados)
        <input value={matriculaProfesional} onChange={(e) => setMatriculaProfesional(e.target.value)} required />
      </label>
      <label>
        Universidad de graduación
        <input value={universidad} onChange={(e) => setUniversidad(e.target.value)} required />
      </label>
      <div className="fila-dos-columnas">
        <label>
          Año de graduación
          <input type="number" value={anioGraduacion} onChange={(e) => setAnioGraduacion(e.target.value)} required min={1960} max={new Date().getFullYear()} />
        </label>
        <label>
          Años de experiencia
          <input type="number" value={anosExperiencia} onChange={(e) => setAnosExperiencia(e.target.value)} min={0} max={70} />
        </label>
      </div>
      <label>
        Teléfono de contacto
        <input value={telefonoContacto} onChange={(e) => setTelefonoContacto(e.target.value)} placeholder={correoInicial ?? ""} />
      </label>
      <label>
        Cuéntanos por qué quieres unirte a la red
        <textarea value={resumenProfesional} onChange={(e) => setResumenProfesional(e.target.value)} required minLength={30} rows={4} />
      </label>

      <h2>Especialidades</h2>
      <div className="grupo-chips">
        {materias.map((m) => (
          <label key={m.mat_id} className="chip-seleccionable">
            <input type="checkbox" checked={materiaIds.includes(m.mat_id)} onChange={() => alternar(materiaIds, m.mat_id, setMateriaIds)} />
            {m.mat_nombre}
          </label>
        ))}
      </div>

      <h2>Cobertura geográfica</h2>
      <div className="grupo-chips">
        {provincias.map((p) => (
          <label key={p.cat_id} className="chip-seleccionable">
            <input type="checkbox" checked={provinciaIds.includes(p.cat_id)} onChange={() => alternar(provinciaIds, p.cat_id, setProvinciaIds)} />
            {p.cat_nombre}
          </label>
        ))}
      </div>

      <h2>Experiencia laboral</h2>
      {experiencia.map((exp, i) => (
        <div key={i} className="tarjeta-experiencia">
          <div className="fila-dos-columnas">
            <label>
              Empresa
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

      <h2>Verificación asistida</h2>
      <p className="aviso-borrador">
        La verificación de tu título y matrícula es manual — visita los portales oficiales, confírmalo ahí y luego marca las casillas.
        Nuestro equipo también lo revisará antes de aceptar tu solicitud.
      </p>
      <label className="campo-check">
        <input type="checkbox" checked={senescytVerificado} onChange={(e) => setSenescytVerificado(e.target.checked)} />
        Verifiqué mi título en{" "}
        <a href={ENLACES_VERIFICACION.senescyt} target="_blank" rel="noopener noreferrer">
          SENESCYT ↗
        </a>
      </label>
      <label className="campo-check">
        <input type="checkbox" checked={foroVerificado} onChange={(e) => setForoVerificado(e.target.checked)} />
        Verifiqué mi matrícula en el{" "}
        <a href={ENLACES_VERIFICACION.foroAbogados} target="_blank" rel="noopener noreferrer">
          Foro de Abogados ↗
        </a>
      </label>
      <label className="campo-check">
        <input type="checkbox" checked={declaracion} onChange={(e) => setDeclaracion(e.target.checked)} />
        Confirmo que la información proporcionada es verídica
      </label>

      {error && <p className="error-auth">{error}</p>}
      <button type="submit" className="btn btn-primario" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
