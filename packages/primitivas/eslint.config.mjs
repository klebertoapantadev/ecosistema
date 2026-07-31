// La configuracion real vive en `@eco/config`. Aqui importa especialmente la
// regla `no-restricted-imports` de §8: este paquete no puede depender de
// `next/*` porque lo consumen tambien las apps nativas Capacitor.
export { default } from "@eco/config/eslint.base.mjs";
