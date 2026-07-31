import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginNext from "@next/eslint-plugin-next";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Configuracion ESLint compartida por las 4 apps (flat config, ESLint 9).
// Vive aqui y no duplicada en cada app por la misma razon que el resto de
// `@eco/config`: una sola fuente de verdad para todo el ecosistema.
//
// Se usa `recommended` de typescript-eslint y NO el variante type-checked:
// esta no necesita cargar el programa de TypeScript, asi que corre en segundos
// en CI. Los errores de tipos ya los cubre `pnpm typecheck` en el mismo job.
export const configuracionBase = tseslint.config(
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**", "**/out/**", "**/coverage/**", "next-env.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@next/next": pluginNext,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
      ...pluginReactHooks.configs.recommended.rules,
      // Los parametros sin usar se marcan con `_` en vez de borrarlos cuando la
      // firma la impone una libreria (handlers de eventos, callbacks de React).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // §8 de gobernanza/estandares/01-convenciones-codificacion.md: `primitivas`
    // y `core` deben seguir siendo usables desde una app nativa Capacitor, asi
    // que no pueden depender de Next. Hoy ambos son placeholders sin `src/`;
    // la regla queda lista para cuando tengan codigo y su propio script `lint`.
    files: ["**/packages/primitivas/**/*.{ts,tsx}", "**/packages/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message: "primitivas/core no pueden importar de next/*: rompe la portabilidad a Capacitor.",
            },
          ],
        },
      ],
    },
  },
);

export default configuracionBase;
