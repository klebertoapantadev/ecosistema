# inicio-cliente

Pantalla de inicio del cliente en el panel web (`/panel`, función `PanelCliente` de
`app/panel/page.tsx`).

## Requerimientos que cubre

- **`TRQ-CLI-001`** — Portal de Casos, Solicitud de Patrocinio y Consultas Telemáticas.
  Este módulo aporta la parte de portal: el cliente ve sus trámites, su caso más reciente,
  su billetera y su próxima cita. La solicitud de patrocinio sigue pendiente.
- Rediseño **`TRQ-013`** (2026-09-22). Traslado de la maqueta aprobada
  `gobernanza/productos/tranqi/maquetas/maqueta-cliente-v2.html`.

## Estructura

| Fichero | Qué hace |
| :--- | :--- |
| `consultas.ts` | Lecturas server-only: `obtenerResumenInicioCliente(usuarioId)` |
| `vigencia.ts` | Cálculo puro de vigencia de un documento; probado en `vigencia.test.ts` |
| `componentes/CifraQueCuenta.tsx` | Cifra que sube desde cero al entrar en pantalla (variante 10A) |
| `componentes/TarjetaCaso.tsx` | Etapas del caso (6B) y detalle en pestañas deslizantes (4A) |
| `componentes/RejillaPlanes.tsx` | Planes y servicios con selector (3B) y confirmación con IVA antes de Payphone (7A) |
| `componentes/BilleteraVacia.tsx` | Estado vacío de la billetera con la carpeta animada (10E) |

No hay `acciones.ts`: el módulo solo lee. El pago lo hace `ModalCheckoutPayphone` de
`@eco/comercio`, que es de plataforma y no se modifica aquí.

## Decisiones locales

1. **Nada inventado.** Cada dato sale de una tabla del propio cliente:
   - `trq_caso_judicial` y sus `trq_documento_caso`;
   - `trq_consulta_rapida`;
   - `trq_billetera_documento`;
   - `trq_cita`.

   Si una consulta falla, el dato vuelve `null` y la pantalla lo omite. Si no hay caso,
   estado vacío. De la maqueta **no** se trasladaron el «ahorro con tu plan», las pestañas
   «Pagos» y «Mensajes» del caso, el pago por transferencia ni la preferencia de canal de
   contacto: no existe tabla de la que leerlos.
2. **Filtro explícito por usuario además de RLS.** Un superadmin que mira el panel «como
   cliente» tiene políticas más amplias; sin el `.eq(usuario)` vería los casos de todos en
   su inicio.
3. **«Por vencer» es la ventana que configuró el usuario.** Son los meses de anticipación
   de cada documento, igual que en `app/api/billetera/documentos/route.ts`, no un umbral
   fijo de la pantalla.
4. **Etapas del caso.** Salen de `cas_estado`: `nuevo` → Recibido, `asignado` → Asignado,
   `en_curso` → En curso, `cerrado` → Cerrado. `suspendido` no es una etapa: se queda en
   «En curso» y lo dice la píldora.
5. **El carrusel de `@eco/comercio` sale del inicio de tranqi.** Traía su apariencia en
   `style={{}}` con la paleta de otro producto, y la apariencia no se comparte entre negocios
   (`gobernanza/arquitectura/marco-de-trabajo.md`). Se reutilizan los datos
   (`obtenerProductosDestacadosClienteAction`) y el pago, no la vista. El carrusel sigue en el
   paquete para quien lo use.
6. **Plan recomendado sin color pleno.** Lleva borde y fondo tenue: la pantalla solo admite
   una superficie de color pleno (sistema visual §2).
7. **Sin dependencias nuevas.** CountUp y Stepper vienen de ideas de React Bits, pero están
   reescritos sin la librería `motion`. Respetan «reducir movimiento» y el lector de
   pantalla oye el valor final, no la cuenta.
