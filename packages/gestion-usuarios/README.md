# Paquete: @eco/gestion-usuarios

Implementa el widget obligatorio de `PLT-011` (buscar entre usuarios registrados en un negocio y asignarles rol). Visible por defecto para el rol `ADMINISTRADOR` — seed aplicado en `20260727000002_comun_seguridad.sql`.

**Común a los 4 negocios** (extraído de `tranqi-web` el 2026-07-27, mismo patrón que `@eco/identidad`). `buscarUsuarios()` y `asignarRol()` reciben el slug del negocio como parámetro; la lista de roles asignables (`ROLES_TRANQI` tenía `ABOGADO` fijo, específico de Tranqi) ahora la pasa cada app vía la prop `roles` de `<FilaUsuario />`.

## Cómo lo consume una app

```tsx
// app/panel/usuarios/page.tsx
import { buscarUsuarios, FilaUsuario } from "@eco/gestion-usuarios";

const NEGOCIO = "tranqi";
const ROLES = ["CLIENTE", "ADMINISTRADOR", "ABOGADO"]; // roles propios del negocio

export default async function Pagina({ searchParams }) {
  const { q = "" } = await searchParams;
  const { data: usuarios } = await buscarUsuarios(q, NEGOCIO);
  return usuarios.map((u) => <FilaUsuario key={u.usu_id} usuario={u} negocio={NEGOCIO} roles={ROLES} />);
}
```

## Alcance actual

- Solo ve/gestiona usuarios que **ya tienen membresía en el negocio que llama**, no todo el ecosistema — coherente con PLT-003 regla 2 (aislamiento de roles por negocio).
- Asignar rol es un RPC transaccional (`seg_fn_asignar_rol`), no un `UPDATE` directo — ver [`acciones.ts`](src/acciones.ts) y la regla 5 de `AGENTS.md`.

**✅ Montado en las 4 apps** (`app/panel/usuarios/page.tsx` de cada una, 2026-07-27) — roles asignables por app: Tranqi `CLIENTE/ADMINISTRADOR/ABOGADO`, FastFix `CLIENTE/ADMINISTRADOR/TECNICO`, Tinkay y Margaritas `CLIENTE/ADMINISTRADOR/OPERADOR`.

## Pendiente

- Búsqueda vía formulario GET (`?q=`), sin paginación (límite fijo de 50 resultados) — suficiente para el volumen actual, revisar si crece.
- Suspender/reactivar membresía (`mem_estado`) — no implementado en esta pasada, solo cambio de rol.
