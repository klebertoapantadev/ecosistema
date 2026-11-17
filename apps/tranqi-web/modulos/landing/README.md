# landing

Landing pública de la membresía tranqi (`/`, `app/page.tsx`).

## Requerimientos que cubre

- **`TRQ-024`** (16-nov-2026) — Landing de la membresía en 10 bloques, a partir del
  «Recorrido gráfico de la landing membresía», revisión 1 (14-nov-2026), y del
  brandbook (tipografía Inter). Traslado de la maqueta aprobada
  `gobernanza/productos/tranqi/maquetas/landing-membresia-v2.html`.

## Estructura

| Fichero | Qué hace |
| :--- | :--- |
| `esquema.ts` | Zod del formulario «Escríbenos»: persona, empresa o abogado |
| `acciones.ts` | `enviarContactoLanding`: valida, guarda a la empresa en `tranqui_legal.trq_contacto_empresa` y avisa a operaciones por correo (`@eco/notificaciones`) |
| `componentes/LandingTranqi.tsx` | Los 10 bloques, la cinta y el precio «desde» de `/api/planes-publicos` |
| `componentes/BarraLanding.tsx` | Barra fija con el desplegable Planes (Personas / Empresas) y hamburguesa |
| `componentes/FormularioContacto.tsx` | Formulario «Escríbenos» con sus tres públicos |
| `componentes/BuddieLanding.tsx` | Buddie y chat con ARIA (`/api/chat`), trasladado sin cambios de lógica |
| `componentes/IconosLanding.tsx` | Sprite de íconos de línea (lámina 30 del brandbook) |
| `componentes/landing.css` | Estilo de la página, todo bajo `.landing` |

## Decisiones locales

- **Orden de los bloques:** Hero · Cómo funciona · Qué incluye · Soluciones legales · Planes ·
  ¿Tienes una duda legal? · Red de expertos · ¿Eres abogado? · Contacto · FAQ · Nosotros.
  «¿Eres abogado?» va delante del contacto y Nosotros al final (decidido el 14-nov).
- **Empresas vuelve** (lo pidieron el recorrido y el docx del 14-nov). Su «Más información»
  lleva a `/empresas/contacto`, como dice la especificación funcional; el formulario de la
  landing también acepta «Mi empresa» y escribe en la misma tabla.
- **«¿Eres abogado?» → `/abogados`**, la página que ya tiene el alta en la red.
- **CSS acotado a `.landing`:** `globals.css` define `section` (página completa), `.wrap` y
  `.btn` para todo el sitio y el panel los hereda. Aquí se pisan solo dentro de la landing.
- **Sin paginación por secciones:** los bloques tienen alto variable; el scroll es normal.
- **Persona y abogado solo llegan por correo:** `tranqui_legal.trq_prospecto` (la bandeja de
  prospectos del CRM) todavía no existe en producción. Cuando exista, el formulario debería
  escribir allí.
