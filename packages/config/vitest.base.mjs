// Config base compartida. Sin dependencia directa de "vitest" en este
// paquete -- cada consumidor la combina con mergeConfig() usando su propio
// vitest instalado. Ver gobernanza/estandares/04-pruebas.md.
//
// Es .mjs y no .ts a proposito: Vite trata este import como externo (viene de
// otro paquete, no de una ruta relativa), asi que quien acaba cargando el
// archivo es Node, no el transpilador. Node 22 y anteriores no entienden
// sintaxis de TypeScript, y el `as const` que tenia este archivo reventaba en
// CI con `SyntaxError: Unexpected identifier 'as'` mientras en local pasaba,
// porque Node >= 23 borra los tipos por su cuenta.
export const vitestBaseConfig = {
  test: {
    environment: "node",
    globals: false,
  },
};
