# TRQ-012 — Correcciones del informe de pruebas de la web (16-sep)

**Fecha:** 2026-09-22 · **Rama:** `TRQ-012-correcciones-web-16sep` · **App:** `apps/tranqi-web`

Origen: PDF «Página Web tranqi 16-sep», 9 observaciones con capturas.

## Resuelto

| # | Observación | Causa | Cambio |
|---|---|---|---|
| 1 | Mayúscula inicial en títulos e inicios de oración | Textos escritos en minúscula en el JSX | Menú, «Hola,», frase del manifiesto, cabecera del chat; bolsa de empleo en *sentence case*. Regla en `sistema-visual.md` §13 |
| 2 | La cinta tapa el texto de «hola, somos tranqi» | Trazado cruzaba párrafo y lista | Nuevo tramo por la derecha y bajo la lista; empalmes 1016/252 intactos |
| 2b | «somos» desalineado con el logo | `translateY(6px)` fijo; la cola de la «q» es el 22 % del alto | `translateY(22%)` |
| 3 | La cinta cubre la cara en el manifiesto | Trazado por la frente | Cruza pegado bajo la barra fija y baja por la derecha |
| 4 | «alaño» | `letter-spacing` heredado en px (-4,7) | `.periodo` con espaciado propio |
| 5 | Colores de marca | Vacantes con paleta GitHub; cinta de equipo lima al 55 % = `#7A9F73` | Vacantes a tokens (55 estilos inline → clases); cinta de equipo `--esmeralda`; pie de equipo con fondo propio |
| 6 | La bolsa de empleo no deja hacer scroll | `scroll-snap-type: y mandatory` en `html` + `<section>` de 100svh | Anclaje solo en `html:has(.nav-landing)`; la portada de vacantes deja de ser `<section>` |
| 7 | Flecha para retroceder | Subvistas en estado local, sin URL; solo una X | `useWidgetEnUrl` (`?widget=` + historial) y `BotonVolverWidget` en las 4 vistas modulares. `sistema-visual.md` §14 |
| 8 | Fallo al entrar en Gestión de usuarios / Membresía | **No reproducido** (sin acceso a la BD `ecosistema` ni al usuario de pruebas) | Blindaje de 3 accesos a `usu_correo` nulo en `packages/gestion-usuarios` que tumbaban la vista entera |

## Verificación

- Capturas headless 1440×900 antes/después de hola, manifiesto, planes y equipo; vacantes en 1440×900 y 375×812.
- Scroll de `/vacantes` hasta el final (569/569 px) en escritorio y móvil; con las reglas antiguas inyectadas vuelve a quedar atrapado (scrollY 62).
- `tsc --noEmit` y `eslint` de `apps/tranqi-web` sin errores.
- **No verificado en navegador:** el botón «Volver» y el historial del panel (requiere sesión iniciada).

## Pendiente

- Punto 8: reproducir con el usuario y el rol de la prueba. El menú lateral mezcla la configuración de `localStorage` (`tranqi_paneles_sidebar_*`, `tranqi_perfiles_*`) con la de BD, así que un navegador con una matriz antigua puede ver paneles que ya no existen.
- Decidir si «Tranqi» va con mayúscula también dentro de la frase.
- La cinta de «Lo legal, para todos» es naranja decorativo, y la regla 3 del color reserva el naranja a lo urgente. No se tocó: decisión de marca.
