import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSocioDetalle } from "../../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Detalle de socio — tranqi" };

export default async function PaginaDetalleSocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await obtenerSocioDetalle(id);
  if (!detalle) notFound();

  const { socio, usuario, solicitud } = detalle;

  return (
    <div>
      <Link href="/panel/socios">← Volver a socios</Link>
      <h1>{[usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo}</h1>
      <p className="historial-fecha">
        {usuario?.usu_correo} {usuario?.usu_whatsapp ? `· ${usuario.usu_whatsapp}` : ""}
      </p>

      <div className="tarjeta-panel detalle-solicitud">
        <h2>Estado del socio</h2>
        <dl className="lista-detalle">
          <dt>Estado</dt>
          <dd>{socio.abg_estado}</dd>
          <dt>Verificado desde</dt>
          <dd>{new Date(socio.abg_verificado_en).toLocaleDateString("es-EC")}</dd>
          <dt>MFA configurado</dt>
          <dd>{socio.abg_mfa_verificado ? "Sí" : "Pendiente — se exigirá para activar capacidades (ver PLT-002)"}</dd>
        </dl>
      </div>

      {solicitud && (
        <div className="tarjeta-panel detalle-solicitud">
          <h2>Datos de la solicitud aceptada</h2>
          <dl className="lista-detalle">
            <dt>Universidad</dt>
            <dd>{solicitud.solicitud.ssc_universidad}</dd>
            <dt>Años de experiencia</dt>
            <dd>{solicitud.solicitud.ssc_anos_experiencia}</dd>
            <dt>Especialidades</dt>
            <dd>{solicitud.materias.map((m) => m.mat_nombre).join(", ") || "—"}</dd>
            <dt>Cobertura</dt>
            <dd>{solicitud.provincias.map((p) => p.cat_nombre).join(", ") || "—"}</dd>
          </dl>
          <Link href={`/panel/socios/solicitudes/${solicitud.solicitud.ssc_id}`} className="btn-mini">
            Ver solicitud completa
          </Link>
        </div>
      )}
    </div>
  );
}
