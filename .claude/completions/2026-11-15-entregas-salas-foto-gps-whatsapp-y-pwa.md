# Cierre de Tarea — Entregas Exequiales: Salas (1–4 / Capilla), Sello GPS estilo Map Camera, Compartir por WhatsApp e Instalación PWA

**Fecha:** 2026-11-15
**Negocio / Paquetes:** `apps/tinkay-web`, `@eco/comercio`, `@eco/configuracion-negocio`, `supabase/migrations`

## Resumen de Cambios Implementados

1. **Único campo obligatorio en entregas Exequiales IESS = Número de Sala (`salaServicio`):**
   - Agregado selector táctil obligatorio de **Número de Sala \*** con opciones `Sala 1`, `Sala 2`, `Sala 3`, `Sala 4` y `Capilla / Oficina` en `ConsolaConfirmacionEntregas.tsx`.
   - Eliminada la obligatoriedad (`required`) de `Nombre del Fallecido`, `Ubicación / Funeraria / Edificio` y `Coordinador del Servicio`, permitiendo que el entregador solo tome la foto y marque la sala (los demás campos pueden completarse o editarse después para el informe quincenal IESS).
   - Añadida columna `ent_sala_servicio` y actualización de RPCs en `supabase/migrations/20261115000011_entregas_salas_sello_gps_y_pwa.sql`.

2. **Descripción del Servicio con 3 opciones:**
   - Selector táctil en campo y en programación de OT con:
     1. `Set condolencias (3 arreglos)`
     2. `Cubre cofre (1 arreglo)`
     3. `Otros` (despliega caja editable de libre escritura).

3. **Fotografía Georreferenciada estilo *GPS Map Camera* (`evidenciaImagenGps.ts`):**
   - Estampado unificado directamente sobre la imagen JPEG con miniatura cuadrada inferior izquierda de mapa satelital/vial + pin rojo y tarjeta oscura traslúcida inferior derecha con `Quito, Pichincha, Ecuador` + bandera del Ecuador pintada en Canvas, dirección vial obtenida por geocodificación inversa, `Lat / Long`, fecha/hora `GMT -05:00` y `Detalle : Sala • Servicio • Entrega`.
   - Re-estampado reactivo automático si el entregador cambia la Sala o Descripción después de capturar la foto.

4. **Compartir Imagen Directamente por WhatsApp:**
   - Botón `Compartir WhatsApp` integrado con Web Share API Level 2 (`navigator.share({ files })`) en vista previa de captura, banner de confirmación y filas entregadas del DataGrid para enviar el archivo `.jpg` georreferenciado directamente a WhatsApp en 1 toque (con respaldo de descarga + `wa.me` en escritorio).

5. **Instalación PWA reparada y visible (`manifest.ts`, iconos PNG reales y `MarcoPanelLateral.tsx`):**
   - Generados iconos reales `icon-192.png`, `icon-512.png` y `apple-touch-icon.png` en `apps/tinkay-web/public/icons/` corrigiendo los enlaces 404 previos del manifiesto web.
   - Botón siempre visible `Instalar` en la barra móvil superior del panel, `Instalar Aplicación` en el menú lateral y `Instalar App` en la consola de entregas, con disparo nativo de `beforeinstallprompt` y guía visual de 2 pasos para Android / iOS.
