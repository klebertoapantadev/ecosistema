import { mergeConfig, defineConfig } from "vitest/config";
import { vitestBaseConfig } from "@eco/config/vitest.base.mjs";

// Solo lógica pura: los widgets de este paquete son React y no se prueban aquí.
export default mergeConfig(
  defineConfig(vitestBaseConfig),
  defineConfig({ test: { include: ["src/**/*.test.ts"] } }),
);
