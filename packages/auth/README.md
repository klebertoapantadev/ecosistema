# packages/auth

**Actualizado 2026-07-27:** la sesión (`@supabase/ssr`) y el registro/login/bienvenida/baja de cuenta que este README planeaba ya se construyeron, pero como dos paquetes separados en vez de uno solo — ver [`packages/supabase`](../supabase/README.md si existe) y [`packages/identidad`](../identidad/README.md). Razón: son 100% dependientes de `next/*` (Server Actions, Route Handlers, `next/headers`), así que no pueden vivir en un paquete pensado para las apps nativas Capacitor sin `next/*` (ver regla 4 de `AGENTS.md`).

Lo que queda pendiente y sí encaja en este paquete (una vez se necesite):
- Enrolamiento y verificación MFA TOTP (`PLT-002`).
- Resolución de rol desde el claim del JWT (*Custom Access Token Hook*) — hoy las políticas RLS resuelven el rol vía subconsulta a `seg_membresia`, ver `especificacion-tecnica.md` de Plataforma §1.

Ver [`gobernanza/politicas/seguridad-y-datos.md`](../../gobernanza/politicas/seguridad-y-datos.md) antes de modificar cualquier flujo de este paquete.
