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

| Perfil | Superficie | Acento |
| :--- | :--- | :--- |
| Administración (`/panel`) | `--negro` | `--violeta` |
| Cliente | Violeta oscuro `#1E0046` | `--menta` |
| Abogado | Verde oscuro `#052A23` | `--lima` |

La opción activa se marca con un **filo de 2 px** en el color de acento más un
fondo apenas más claro, no con un relleno saturado: el color entra por el borde
y la superficie oscura no se ensucia.

## 5. Escala y forma

- Radios: 8 px (controles), 12 px (bloques), 16 px (tarjetas). Píldora (999 px)
  solo en botones de la landing y en etiquetas.
- Líneas: 1 px. La jerarquía la dan el peso tipográfico y el espacio, no la sombra.
- Densidad: la pantalla de cliente respira; la del abogado es una herramienta de
  trabajo y admite más densidad y cifras tabulares.

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
