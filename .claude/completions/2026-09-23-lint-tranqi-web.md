# 2026-09-23 — [TRQ-014] Lint de tranqi-web a 0 errores

**Problema**: el job `build` de CI fallaba en todos los PR (#48–#53) en `pnpm lint`: `tranqi-web#lint`
reportaba 347 errores heredados de `master` (193 `no-explicit-any`, 142 `no-unused-vars`, resto
`prefer-const`, `no-useless-escape`, `no-extra-boolean-cast`, `no-empty`, `no-html-link-for-pages`).

**Resultado**: 0 errores (quedan 34 warnings, que no rompen CI). `pnpm lint`, `typecheck` y `test` del
monorepo en verde; `pnpm --filter tranqi-web build` en verde.

## Cómo se garantizó "sin cambio de comportamiento"

Cada fichero se transpiló con TypeScript (borrado de tipos) antes y después, y se comparó el JS
resultante. Las únicas diferencias que quedan son equivalentes: imports/variables/estados sin lectura
eliminados, `let`→`const`, escapes de regex innecesarios, `Boolean()` redundante, parámetros renombrados
con `_`, `catch` sin variable y el `<a>`→`<Link>` interno de `FichaClienteDetalleModal`.

## Hallazgos para un PR aparte (NO corregidos aquí: serían cambios funcionales)

En `apps/tranqi-web/modulos/socios/acciones.ts` hay llamadas cuyos nombres no existen según
`packages/db/src/tipos-generados.ts`. Como el resultado no se comprueba, probablemente fallan en silencio.
Se conservan tal cual detrás del alias `ClienteSinTipar` (único `eslint-disable`, justificado en el código):

- RPC `comun_seguridad.seg_fn_asignar_perfil`: el código envía `p_target_usuario_id` y `p_perfil_clave`;
  los tipos declaran `p_usuario_id` y `p_perfil`.
- `comun_seguridad.seg_membresia_perfil`: el código usa columnas `mep_*`; las reales son `mpe_*`.
- Notificaciones in-app de versiones de contrato: el código inserta en `comun_notificaciones.not_notificacion`;
  el resto del módulo usa `comun_notificacion.not_registro`.
- `trq_fn_confirmar_contrato_socio`: se envía `p_comentario: null` explícito y el tipo generado solo admite `string`.

## Lección

Al delegar arreglos de tipos a un modelo, este tiende a "arreglar" el código para que cuadre con los
tipos (renombrar RPC/columnas, `null`→`undefined`, añadir `?.`), lo que cambia comportamiento. La
comparación del JS transpilado lo detecta de forma objetiva.
