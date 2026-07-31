// Sello de version: fecha y hora de compilacion, mas el commit del que salio.
// Sirve para responder de un vistazo "¿lo que estoy viendo incluye mi ultimo
// cambio?" sin abrir el panel de Vercel ni comparar hashes de CSS a mano.
//
// La cadena YA VIENE FORMATEADA desde next.config.mjs, y eso es deliberado: si
// se formateara aqui con toLocaleString(), servidor y navegador usarian zona
// horaria distinta y React tiraria un error de hidratacion en cada carga. El
// valor se congela en el build y ambos lados renderizan el mismo literal.
//
// Sin importar `next/*`: este paquete tambien lo consumen las apps nativas
// Capacitor (§8 de las convenciones de codificacion). `process.env` con prefijo
// NEXT_PUBLIC_ lo sustituye el empaquetador por el literal, no es una lectura
// en runtime.
export function SelloCompilacion({ className }: { className?: string }) {
  const compiladoEn = process.env.NEXT_PUBLIC_COMPILADO_EN;
  const commit = process.env.NEXT_PUBLIC_COMMIT;

  // En desarrollo no hay build del que hablar; mostrar una fecha ahi seria
  // ruido que ademas cambiaria en cada recarga.
  if (!compiladoEn) return null;

  return (
    <span className={className} title={commit ? `Compilado desde el commit ${commit}` : undefined}>
      v {compiladoEn}
      {commit ? ` · ${commit}` : ""}
    </span>
  );
}
