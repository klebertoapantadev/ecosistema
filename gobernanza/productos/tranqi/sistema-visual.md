---
tipo: sistema_visual
estado: borrador
version: 0.1
fecha: 2026-07-27
responsable: Kleber Toapanta
---

# Tranqi — Sistema Visual

Aplica a `apps/tranqi-web` y a las futuras apps nativas Tranqi Cliente y Tranqi
Abogado. **No es compartible con otros productos**: color, tipografía, layout e
identidad son propios de cada negocio — ver
[`estandares/01-convenciones-codificacion.md`](../../estandares/01-convenciones-codificacion.md)
§1. Lo que sí se comparte es comportamiento sin apariencia (`packages/primitivas`).

El código vive en [`apps/tranqi-web/app/globals.css`](../../../apps/tranqi-web/app/globals.css):
CSS plano, variables CSS y clases en español. Sin Tailwind, sin librería de
componentes visuales.

## 1. Origen

El sistema sale del brochure de marca. La landing pública lo usa en su forma
más expresiva —color pleno por sección y una cinta continua que recorre la
página—; las pantallas de trabajo lo usan en su forma sobria. Es el mismo
sistema en dos registros, no dos sistemas.

## 2. Paleta

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--violeta` | `#5000BA` | Identidad y acción del lado **cliente** |
| `--lavanda` | `#7866FF` | Buddie, hilo decorativo sobre fondo oscuro |
| `--menta` | `#B1FBE3` | Estado positivo del lado cliente ("activa", "resuelto") |
| `--esmeralda` | `#05876E` | Identidad y acción del lado **abogado**; mensaje de éxito |
| `--lima` | `#D8FFB3` | Acento sobre oscuro del lado abogado |
| `--amarillo` | `#FEE300` | CTA de la landing; etiqueta `SuperAdmin` |
| `--rosa` | `#FEB9FF` | Solo landing |
| `--lila` | `#D0BBE2` | Solo landing |
| `--naranja` | `#FE5800` | **Urgente, nunca decorativo** |
| `--negro` | `#111111` | Texto y rail del panel administrativo |
| `--blanco` | `#FFFFFF` | Superficies |

Tipografía: **Archivo** (grotesca), pesos 400–800. Cifras con
`font-variant-numeric: tabular-nums` en tablas y métricas.

## 3. Las tres reglas del color

1. **En pantallas de trabajo, el color es señal, no superficie.** Fondo neutro,
   tarjetas blancas con línea de 1 px, y **una sola superficie de color pleno
   por pantalla** — la que concentra la información que el usuario vino a ver
   (su póliza, su cuenta digital). Dos superficies llenas compiten y ninguna gana.
2. **El acento identifica el perfil.** Violeta para cliente, esmeralda para
   abogado, negro para administración. Un usuario que ve las tres pantallas debe
   saber en cuál está sin leer el título.
3. **El naranja está reservado a lo urgente** — algo que caduca o exige acción
   inmediata. Si empieza a decorar, deja de avisar.

## 4. Rail de navegación

Ancho 240 px, superficie oscura, tipografía blanca al 66–72 % de opacidad.

| Perfil | Superficie | Acento | Clase |
| :--- | :--- | :--- | :--- |
| Administración | `--negro` | `--lavanda` | `.perfil-admin` |
| Cliente | `--violeta-oscuro` `#33007A` | `--menta` | `.perfil-cliente` |
| Abogado | `--esmeralda-tinta` `#052A23` | `--lima` | `.perfil-abogado` |

La opción activa se marca con un **filo de 2 px** en el color de acento más un
fondo apenas más claro, no con un relleno saturado: el color entra por el borde
y la superficie oscura no se ensucia.

El rail **no tiene color propio**: lo toma de tres variables
(`--rail-superficie`, `--rail-alta`, `--rail-acento`) que define la clase de
perfil que el layout del panel pone en `.panel-layout`. Añadir un perfil es
añadir un bloque de tres líneas en `globals.css`, no duplicar las reglas del
rail. La clase la decide `clasePerfilVisual()` en `app/panel/layout.tsx` y es
**solo apariencia**: no concede ni restringe ningún permiso.

Tres decisiones que conviene no revertir sin motivo:

- **El rail de cliente es `#33007A`, no el `#1E0046` de la maqueta.** La maqueta
  usaba una tinta más honda, y en pantalla se lee casi negro: el rail dejaba de
  decir "cliente", que es su única función (regla 2). Se subió al púrpura
  inmediatamente superior, que ya existía en la maqueta como hover del botón
  primario. **No se sube a `--violeta` `#5000BA`**: ese es el color de la
  superficie de contenido —la tarjeta de Legal Score, antes la de póliza— y con
  el rail del mismo tono las dos superficies llenas compiten y ninguna gana
  (§3, regla 1).
  **Se revirtió una vez y se volvió a restaurar (TRQ-008 → TRQ-009):** el calco
  de la maqueta devolvió el rail a `#1E0046` buscando fidelidad, y el resultado
  fue indistinguible del rail negro de administración —contraste 1.03 entre
  ambas superficies, frente a 1.28 con `#33007A`—. Se reportó como fallo visual.
  Si alguien vuelve a proponer la tinta de la maqueta, este es el dato que lo
  cierra: no es cuestión de gusto, es que deja de cumplir la regla 2.
- El acento de administración es `--lavanda`, no `--violeta`. El violeta
  `#5000BA` sobre negro `#111111` no llega a distinguirse como filo; la lavanda
  sí. La tabla decía `--violeta` desde el borrador inicial y el código nunca lo
  implementó así.
- Un superadmin de plataforma ve el rail **negro** aunque su `mem_rol` en el
  negocio sea `CLIENTE` — caso real, la membresía cliente se crea sola al
  registrarse. Si mirásemos solo `mem_rol` vería el rail violeta con la consola
  de administración delante, que es justo la confusión que evita la regla 2.

- **El conmutador «Ver como» recolorea el rail, no solo el contenido.** Un
  superadmin que elige «Cliente» ve el rail del perfil cliente: si el
  conmutador existe para mirar el portal con los ojos de otro rol, enseñar la
  cromática de administración contradice su único propósito. Se implementa en
  `CapaPerfilRail`, un componente cliente, porque un layout de Next no recibe
  `searchParams` y el modo viaja en la URL. El parámetro se ignora para quien
  no puede conmutar — apariencia, sí, pero apariencia que afirmaría un rol
  que no se tiene.
Cada enlace lleva icono (`lucide-react`, ver §5) + texto. En `≤860px` el rail
ya es horizontal con scroll (ver §9); en `≤600px` el texto se oculta
**solo visualmente** (`.etiqueta-nav`, técnica de clip-rect, no `display:none`)
y queda solo el icono — sigue en el DOM para lector de pantalla y como
`title` en desktop. Se adoptó al crecer el rail a 6 enlaces (2026-07-28):
con texto completo el scroll horizontal era largo e incómodo con el pulgar.

## 5. Escala y forma

- Radios: 8 px (controles), 12 px (bloques), 16 px (tarjetas). Píldora (999 px)
  solo en botones de la landing y en etiquetas.
- Líneas: 1 px. La jerarquía la dan el peso tipográfico y el espacio, no la sombra.
- Densidad: la pantalla de cliente respira; la del abogado es una herramienta de
  trabajo y admite más densidad y cifras tabulares.
- **Iconos: `lucide-react` (2026-07-28), no emoji.** Mismo registro de trazo fino
  (`strokeWidth` 1.6–2, sin relleno) que los SVG inline de las maquetas de
  referencia — ver §9. Un emoji renderiza distinto por SO/navegador y no se puede
  afinar (grosor de trazo, tamaño exacto, color); un icono de trazo sí. Sustituye
  los emoji que existían en `/panel` y en las pantallas de socios.

## 6. Estados

Chips en versalita, 11 px, peso 800. Fondo diluido del color del estado, nunca
el color pleno:

| Estado | Cliente | Abogado |
| :--- | :--- | :--- |
| En curso / en trámite | Violeta diluido | Esmeralda diluido |
| Resuelto / positivo | Menta diluida | Lima |
| Neutro / en espera | Gris de línea | Gris de línea |
| Urgente | Naranja diluido `#FFE9DE` sobre texto `#C33F00` | igual |

## 7. La cinta

Es el elemento de marca más reconocible y el más fácil de arruinar. En la
landing se dibuja al hacer scroll y ocupa la pantalla. **En pantallas de trabajo
es textura**: un solo trazo, entre 10 % y 35 % de opacidad, dentro del rail o de
la superficie de color, nunca sobre texto y nunca en más de dos elementos por
pantalla.

**Va en los tres perfiles del rail, administración incluida.** Una versión
anterior la excluía del rail negro por considerarla ahí "decoración sin
significado"; el efecto real fue que administración quedaba como la única
superficie plana de las tres, y se reportó como fallo visual. La cinta se dibuja
con `--rail-acento`, que en administración es la lavanda `#7866FF` — el mismo
color que §4 eligió precisamente porque se distingue sobre el negro.

La opacidad **se calibra por perfil, no se fija una sola**: lo que debe coincidir
es el peso visual, no el número. Menta al 9 % sobre `#33007A` da 1.16 de
contraste contra su propio fondo; lavanda necesita el 14 % sobre `#111111` para
dar 1.15. Al añadir un perfil, medir ese contraste en vez de copiar la opacidad
del anterior.

Detalle de implementación: el SVG va posicionado contra un ancestro con
`position: relative` u otro valor posicionado. Si el contenedor queda `static`
—por ejemplo un rail que deja de ser `sticky` en móvil— el trazo se posiciona
contra el `body`, escapa del `overflow: hidden` y cubre la página.

## 8. Accesibilidad

- Contraste mínimo AA (4.5:1) en texto sobre color. La menta y la lima **no son
  fondos de texto oscuro pequeño**: se usan como acento o con tinta honda encima.
- Todo bloque animado respeta `prefers-reduced-motion: reduce`.
- El estado nunca se comunica solo por color: chip con texto, siempre.

## 9. Referencias

Maquetas de referencia navegables en [`maquetas/`](maquetas/) — abrir en el
navegador. Son material de decisión, no código a copiar: al implementar se
reescribe siguiendo la estructura de módulo obligatoria.

- `maqueta-cliente.html` — pantalla principal del cliente.
- `maqueta-abogado.html` — escritorio del abogado.
- `maqueta-equipo.html` — sección "Nuestro equipo" de la landing pública (TRQ-002), con acento
  esmeralda/lima del lado abogado. A diferencia de las dos anteriores, esta sí es la landing web
  actual (`apps/tranqi-web/app/page.tsx`), no una futura app nativa.

Las dos primeras maquetas son de las futuras apps nativas Cliente/Abogado — más ricas
(buscador, notificaciones, mensajes, agenda) que el panel web de hoy, que no
tiene esa funcionalidad construida todavía. Lo que sí se adoptó ya en
`apps/tranqi-web` (2026-07-28): el quiebre responsive del rail (`≤860px`, el
rail deja de ser columna lateral fija y se vuelve barra horizontal con
scroll) — ver `.rail` en ambas maquetas y su equivalente `.panel-nav` en
`app/globals.css`. Antes de esto el panel no era usable en móvil (el rail
fijo de 240px no colapsaba, empujando el contenido fuera de pantalla).

## 10. Composición adaptable — clases, no estilos inline

Regla que TRQ-010 tuvo que hacer explícita: **la apariencia de un widget se
escribe en `globals.css`, no en un `style={{}}` dentro del componente.** No es
preferencia de estilo. Un objeto de estilo inline **no admite media queries**,
así que un widget pintado inline no se puede adaptar a un teléfono desde la hoja
de estilos — por muchos quiebres que tenga §11. Cuando se auditó el panel había
2.479 bloques inline entre `app/`, `modulos/` y `packages/`, y el CSS
responsive no gobernaba casi nada de lo que se veía.

Esto vale también —sobre todo— para los componentes de `packages/*`: el paquete
aporta comportamiento, la app aporta apariencia
([`01-convenciones-codificacion.md`](../../estandares/01-convenciones-codificacion.md) §1).
El CSS de un widget compartido vive en el `globals.css` del producto.

Vocabulario base disponible, para no reinventarlo en cada widget:

| Clase | Para qué | Se ajusta con |
| :--- | :--- | :--- |
| `.rejilla-auto` | Rejilla que colapsa sola | `--min` (ancho mínimo de columna), `--hueco` |
| `.fila-acciones` | Botones en fila que se apilan al no caber | — |
| `.accion-menor` | Acción dentro de tarjeta o fila | `.es-principal`, `.es-discreta`, `.es-peligro` |
| `.contenedor-panel` | Ancho de lectura centrado | — |

Dos detalles que costaron encontrar y conviene no revertir:

- **`minmax(min(var(--min), 100%), 1fr)`**, no `minmax(var(--min), 1fr)`. Sin el
  `min()`, una columna de mínimo 260px sigue midiendo 260px en un viewport de
  240 y desborda la página en horizontal.
- **El ancho de lectura no se topa en la columna de contenido.** `.panel-layout`
  es flex: un `max-width` en `.panel-contenido` deja el sobrante al final del
  eje, y la barra del asistente deja de tocar el borde derecho (~680px de hueco
  en un monitor de 2560). El tope va en `.contenedor-panel`, centrado dentro de
  una columna que sí crece.

## 11. Objetivo táctil

Mínimo **44 px** de alto para cualquier control. Se decide por
`@media (pointer: coarse)`, **no por ancho de pantalla**: una tablet ancha se
toca igual que un teléfono, y un portátil estrecho se sigue usando con ratón.
Los botones de `padding: 4px 8px` con letra de 0.75rem que había en los widgets
medían 26-30 px.

En `≤860px` el rail es barra inferior fija, así que reserva la zona segura con
`env(safe-area-inset-bottom)` — sin ella el indicador de inicio del iPhone tapa
media barra. Por el mismo motivo el asistente usa `100dvh` y no `100vh`: en
Safari y Chrome de móvil `100vh` cuenta la barra de direcciones y el campo de
escribir queda fuera de la pantalla.

## 12. Responsive — regla de orden de cascada

Un bug real encontrado al implementar el punto anterior: varias reglas base
(`.correo-usuario-activo`, `.fila-dos-columnas`, etc.) están definidas *sin*
`@media` en secciones que se fueron agregando a lo largo del archivo. Un
`@media (max-width: ...)` insertado en medio del archivo, con igual
especificidad que una regla base que aparece *después* en el texto, **pierde**
esa pelea de cascada sin importar el viewport — el override nunca se aplica.
Regla a seguir: todo bloque `@media` de ajuste móvil va **al final** de
`globals.css`, nunca intercalado entre secciones — así siempre gana por orden
de cascada contra cualquier regla base ya existente, sin depender de subir
especificidad artificialmente.
