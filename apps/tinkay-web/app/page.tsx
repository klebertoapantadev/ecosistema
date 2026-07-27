// Pagina de validacion, no de negocio: prueba que el monorepo despliega
// esta app de forma independiente en Vercel. Ver gobernanza/productos/tinkay/.
// Enlaces a /registro y /ingresar son temporales, solo para probar
// @eco/identidad contra Supabase mientras no existe una landing real.

import Link from "next/link";

export default function Page() {
  return (
    <div className="placeholder">
      <h1>tinkay</h1>
      <p>Próximamente — página de validación del monorepo</p>
      <div className="placeholder-enlaces">
        <Link href="/registro" className="btn btn-primario">Registrarme</Link>
        <Link href="/ingresar" className="placeholder-enlace-secundario">Ingresar</Link>
      </div>
    </div>
  );
}
