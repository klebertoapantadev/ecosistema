// La configuracion real vive en `@eco/config` para no duplicarla por app. Se
// importa por ruta de archivo y no por un subpath de `exports`: declarar
// `exports` en ese paquete convertiria `vitest.base.ts` en una entrada de
// paquete y Node intentaria cargar el `.ts` sin transpilar (rompe `pnpm test`).
export { default } from "@eco/config/eslint.base.mjs";
