// Config base compartida. Sin dependencia directa de "vitest" en este
// paquete -- cada consumidor la combina con mergeConfig() usando su propio
// vitest instalado. Ver gobernanza/estandares/04-pruebas.md.
export const vitestBaseConfig = {
  test: {
    environment: "node" as const,
    globals: false,
  },
};
