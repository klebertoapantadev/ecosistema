import { mergeConfig, defineConfig } from "vitest/config";
import { vitestBaseConfig } from "@eco/config/vitest.base.mjs";

// Solo lógica pura: nada de aquí monta React ni toca la red. Los módulos con
// `"use server"` o Server Components no se prueban con vitest, se prueban
// contra la base (ver gobernanza/estandares/04-pruebas.md).
export default mergeConfig(
  defineConfig(vitestBaseConfig),
  defineConfig({ test: { include: ["modulos/**/*.test.ts"] } }),
);
