---
tipo: estandar
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Estándar de Pruebas

## 1. Principio: para un equipo pequeño, cobertura no es la meta

Con un equipo de una persona, "probar todo" no es una opción realista y perseguir un % de cobertura produce el peor resultado posible: tests de bajo valor escritos solo para subir el número, mientras lo que de verdad puede doler (una política RLS mal escrita) queda sin probar porque es más difícil de testear que un componente trivial.

La pregunta que decide si algo se prueba no es "¿qué % cubrimos?" sino: **¿qué tan caro es este error si llega a producción sin que nadie lo note?**

## 2. Qué se prueba, en orden de prioridad

| Prioridad | Qué | Por qué |
| :--- | :--- | :--- |
| **1 — obligatorio** | Políticas RLS de toda tabla nueva | Es la barrera de autorización real (ver [`marco-de-trabajo.md`](../arquitectura/marco-de-trabajo.md) §3). Un bug aquí es una fuga de datos, no un defecto visual. Ya exigido en [Definition of Done](03-definition-of-done.md) como "prueba negativa de RLS". |
| **2 — obligatorio** | Funciones RPC transaccionales | Que un fallo a mitad de camino no deje estado parcial (ej. aprobar solicitud → crea perfil + asigna rol). |
| **3 — obligatorio para lógica nueva** | Funciones puras de `packages/*` (validaciones Zod, resolución de agente, cálculos) | Rápido de escribir, rápido de correr, alto valor por ser lógica que varios productos reutilizan. |
| **4 — smoke test, no suite completa** | Que la app compila y las rutas críticas cargan | Lo que ya hicimos manualmente al migrar Tranqi (build limpio + verificación de `/api/chat` + revisión visual). Se formaliza como el mínimo aceptable, no como un paso intermedio hacia algo más grande. |
| **Diferido, no omitido** | E2E de flujos completos (Playwright), tests de componentes UI, testing visual | Alto costo de mantenimiento para un equipo de una persona. Se reconsidera cuando el equipo crezca o cuando un área acumule bugs recurrentes que un E2E dirigido hubiera atajado — no antes. |

**Regla práctica:** un CRUD trivial que solo llama a Supabase y delega la autorización a RLS no necesita test unitario propio — la prueba de RLS ya cubre lo que importa de esa pieza.

## 3. Herramienta: Vitest

Elegido por ser nativo de TypeScript/ESM, rápido, y con buen soporte de monorepos pnpm + Turborepo — sin configuración adicional de transpilación como requeriría Jest en este stack.

- Config base compartida: `packages/config/vitest.base.ts`.
- Cada `package`/`app` que tenga tests trae su propio `vitest.config.ts` extendiendo la base, y un script `test` en su `package.json`.
- Comando raíz: `pnpm test` → `turbo run test` (Turborepo corre solo los tests de paquetes afectados por el cambio, igual que `build`).

## 4. Pruebas de RLS — la pieza que de verdad importa

Mecanismo: [`pgTAP`](https://pgtap.org/) vía `supabase test db`, el soporte oficial de Supabase CLI para pruebas a nivel de base de datos. El patrón:

1. Migración crea la tabla + política RLS.
2. Un archivo `supabase/tests/{esquema}_{tabla}.sql` crea usuarios de prueba simulando distintos roles (vía `set_config('request.jwt.claims', ...)`), ejecuta una consulta con cada uno, y verifica con `pgtap` que el rol correcto puede y el incorrecto no puede.
3. `supabase test db` corre todos los archivos de `supabase/tests/` contra una base efímera.

**Estado actual: bloqueado.** No existe ninguna migración todavía (Sprint 0 de Tranqi sigue pendiente — ver [`gobernanza/manuales/habilitar-ambiente.md`](../manuales/habilitar-ambiente.md) §9). Este mecanismo se activa en el mismo PR que introduzca la primera tabla con RLS.

## 5. CI

`pnpm test` corre en el mismo workflow de `ci.yml` que lint/typecheck/build, en cada PR. El job de pgTAP para RLS se agrega como paso separado cuando exista `supabase/migrations/` con contenido real — no antes, para no tener un paso de CI que siempre pasa vacío y da falsa confianza.

## 6. Qué NO perseguir

- Cobertura % como meta u obligación de PR.
- Test unitario de cada componente visual — el costo de mantenimiento supera el valor para un equipo de este tamaño.
- Suite E2E amplia desde el día uno.
- Mocks elaborados de Supabase para simular RLS en JS — la prueba de RLS real (pgTAP contra Postgres) es más barata de mantener y la única que prueba lo que realmente protege los datos.
