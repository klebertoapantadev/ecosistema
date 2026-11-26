-- ============================================================================
-- Migración: 20261126000003_tinkay_correccion_ortografia_y_terminologia_catalogo.sql
-- Revisa y corrige ortografía, concordancia, puntuación y terminología comercial
-- en todos los productos y variantes de Tinkay:
--   - Reemplaza "rosas de exportación" / "Rosas Exportación" -> "rosas seleccionadas"
--   - Reemplaza "follaje fino" / "follajes finos" -> "follaje natural"
--   - Estandariza descripciones breves de cantidad (ej. "Aprox. #40 Rosas." ->
--     "Aprox. 40 rosas seleccionadas con follaje natural.")
--   - Corrige tildes y errores tipográficos (Corazón, Orquídea, cilíndricas,
--     rígidas, Floral, Aprox., armoniosa, etc.).
-- ============================================================================

do $$
begin
  -- 1. Aro - Guirnalda de Globos
  update comun_comercio.com_producto
     set pro_nombre = 'Aro - Guirnalda de Globos',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'aro-guirnalda-de-globos' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Aro - Guirnalda de Globos (Tarifa Estándar)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-AROGUIRN' and var_eliminado_en is null;

  -- 2. Aro Floral
  update comun_comercio.com_producto
     set pro_descripcion = E'Aro floral con rosas seleccionadas y follaje natural.\nMedidas aproximadas de 2 × 2 metros instalado.',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'aro-floral' and pro_eliminado_en is null;

  -- 3. Backing - Media Luna (corrige typo "Backing Flloral" y "2mX 2m.")
  update comun_comercio.com_producto
     set pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Monumental guirnalda floral en media luna.","Medidas de 2 m × 2 m.","Servicio de montaje y desmontaje incluido."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'backing-flloral' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Backing Floral (Tarifa Estándar)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-BACKINGF' and var_eliminado_en is null;

  -- 4. Backing 2×2
  update comun_comercio.com_producto
     set pro_nombre = 'Backing 2×2',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'backing-2x2' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Backing 2×2 (Tarifa Estándar)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-BACKING2' and var_eliminado_en is null;

  -- 5. Bienvenida de Gala: Aro & Atriles
  update comun_comercio.com_producto
     set pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["1 aro floral en los colores de tu preferencia.","2 atriles con cartel para lista de invitados, mensaje de bienvenida o personalización para tu evento.","Incluye montaje y desmontaje en Quito."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'bienvenida-de-gala-aro-atriles' and pro_eliminado_en is null;

  -- 6. Bombones Chocolates (tilde en Corazón)
  update comun_comercio.com_variante
     set var_nombre = 'Ferrero x8 Corazón',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-CHOC-16' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Ferrero x1 en esfera acrílica',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-VAR-4' and var_eliminado_en is null;

  -- 7. Bouquet Clásico para Florero (elimina "exportación" y "follaje fino")
  update comun_comercio.com_producto
     set pro_descripcion = 'Ramos de rosas seleccionadas de tallo largo, preparados con follaje natural para lucir en florero.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{descripcion_corta}',
           '"Rosas seleccionadas de tallo largo con follaje natural de hidratación prolongada."'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-florero' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{receta_bom}',
           '"25 rosas seleccionadas + Follaje natural + 1 sobre de alimento floral + Cinta"'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-FLOR-25' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{receta_bom}',
           '"50 rosas seleccionadas + Follaje natural + 2 sobres de alimento floral + Cinta"'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-FLOR-50' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{receta_bom}',
           '"100 rosas seleccionadas + Follaje natural + 4 sobres de alimento floral + 2 cintas"'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-FLOR-100' and var_eliminado_en is null;

  -- 8. Bouquet Coreano (corrige "armoniza", espacio antes de coma, "Aporx.")
  update comun_comercio.com_producto
     set pro_descripcion = 'Composición floral armoniosa de rosas seleccionadas, follaje natural y flores silvestres de temporada. No requiere florero; incluye base y espuma floral para un fácil cuidado de tus flores.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Composición floral armoniosa de rosas seleccionadas, follaje natural y flores silvestres de temporada.","No requiere florero.","Incluye base y espuma floral para un fácil cuidado de tus flores."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-mix' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Aprox. 25 rosas seleccionadas con follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-MIX-PEQ' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Aprox. 40 rosas seleccionadas con follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-MIX-GRA' and var_eliminado_en is null;

  -- 9. Bouquet Coreano L (entrega inmediata — corrige "Globos burbuja personalizado")
  update comun_comercio.com_producto
     set pro_descripcion = E'Incluye peluche de graduación 🎓.\nIncluye globo burbuja personalizado.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{descripcion_corta}',
           '"Incluye peluche de graduación 🎓 y globo burbuja personalizado."'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'inmediato-bouquet-coreano-l-3a7ed3' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{detalle}',
           '"Incluye peluche de graduación 🎓 y globo burbuja personalizado."'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-EXP-5ED297' and var_eliminado_en is null;

  -- 10. Bouquet de Girasoles
  update comun_comercio.com_producto
     set pro_descripcion = 'Regala luz, alegría y distinción con nuestro bouquet de girasoles frescos cuidadosamente seleccionados, acompañados de delicados detalles en flores blancas tipo matricaria y follaje natural.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Envoltura en papel coreano.","Lazo decorativo en cinta.","Portatarjeta dorado con tarjeta dedicatoria (impresa y/o digital)."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'bouquet-de-girasoles' and pro_eliminado_en is null;

  -- 11. Bouquets Especiales
  update comun_comercio.com_producto
     set pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{descripcion_corta}',
           '"Edición estacional exclusiva de San Valentín (10 al 15 de febrero)."'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-san-valentin' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Corazón de aprox. 180 rosas seleccionadas rojas o del color de tu preferencia, con follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-VAL-24' and var_eliminado_en is null;

  -- 12. Box Corazón
  update comun_comercio.com_producto
     set pro_nombre = 'Box Corazón',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'box-corazon' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Box Corazón (Tarifa Estándar)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-BOXCORAZ' and var_eliminado_en is null;

  -- 13. Box Florales (tildes en cilíndricas/rígidas/Orquídea, "Aprox. #40 Rosas.", "follajes finos")
  update comun_comercio.com_producto
     set pro_descripcion = 'Arreglos redondos de rosas seleccionadas y flores frescas con follaje natural, dispuestos en cajas cilíndricas o cuadradas rígidas de lujo con base hidratada.',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'box-florales' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Aprox. 40 rosas seleccionadas con follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-BOXFLORA' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Aprox. 60 rosas seleccionadas con follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-BOX-L' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Box Floral (M) + Orquídea',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-VAR-7' and var_eliminado_en is null;

  -- 14. Cartel Bienvenida
  update comun_comercio.com_producto
     set pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Ideal para bienvenida, lista de invitados o menú.","Válido para servicios religiosos."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'cartel-bienvenida' and pro_eliminado_en is null;

  -- 15. Cilindro de Girasoles
  update comun_comercio.com_producto
     set pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Florero de cristal cilíndrico.","Detalle en yute natural con lazo de cordón.","Portatarjeta dorado con tarjeta dedicatoria (impresa y/o digital)."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'cilindro-de-girasoles' and pro_eliminado_en is null;

  -- 16. Cinta Condolencias
  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Cinta color blanco ◽ con letras doradas."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-VAR-2' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Cinta color lila 🟪 con letras doradas."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TNK-SRV-TRAN' and var_eliminado_en is null;

  -- 17. Corazón
  update comun_comercio.com_producto
     set pro_nombre = 'Corazón',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Box corazón con rosas seleccionadas, follaje natural y chocolates.","Incluye 35 chocolates en esfera acrílica."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'corazon' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Corazón (Tarifa Estándar)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-CORAZON' and var_eliminado_en is null;

  -- 18. Corona (concordancia "elaborada", doble espacio XXL, beneficios claros)
  update comun_comercio.com_producto
     set pro_descripcion = 'Imponente corona floral en trípode de madera, cuidadosamente elaborada con rosas seleccionadas, flores y follaje natural.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Incluye tarjeta \"Nota de Pesar\" personalizada.","Cinta fúnebre."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'corona' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Corona XXL (Solo Rosas)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-CORONA-MWE7L00U-3' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Corona de crisantemos blancos con detalle de rosas seleccionadas blancas o del color de su preferencia y follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-CORONA' and var_eliminado_en is null;

  update comun_comercio.com_variante
     set var_detalle_variante = jsonb_set(
           coalesce(var_detalle_variante, '{}'::jsonb),
           '{beneficios_custom}',
           '["Corona elaborada con rosas seleccionadas blancas o en la combinación de colores de su preferencia y follaje natural."]'::jsonb,
           true
         ),
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-CORONA-MWDVROO4-2' and var_eliminado_en is null;

  -- 19. Detalle
  update comun_comercio.com_producto
     set pro_descripcion = 'Delicado arreglo floral en base de cerámica con rosas seleccionadas y follaje natural.',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'detalle' and pro_eliminado_en is null;

  -- 20. Florero Grande
  update comun_comercio.com_producto
     set pro_descripcion = E'Florero de cristal grande.\nIdeal para 50 rosas o 25 girasoles.',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'florero-grande' and pro_eliminado_en is null;

  -- 21. Números de Luces
  update comun_comercio.com_producto
     set pro_nombre = 'Números de Luces',
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'numeros-de-luces' and pro_eliminado_en is null;

  update comun_comercio.com_variante
     set var_nombre = 'Números de Luces (Tarifa Estándar)',
         var_actualizado_en = now()
   where var_negocio = 'tinkay' and var_sku = 'TIN-NUMEROSD' and var_eliminado_en is null;

  -- 22. Orquídeas (corrige "orquideas" sin tilde y nombre "Orquídeas (1)")
  update comun_comercio.com_producto
     set pro_nombre = 'Orquídeas',
         pro_descripcion = 'Elegante florero cilíndrico de cristal con orquídeas seleccionadas y follaje natural.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Incluye florero de cristal en forma de cilindro."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'orquideas-3' and pro_eliminado_en is null;

  -- 23. Pedestal Floral
  update comun_comercio.com_producto
     set pro_descripcion = 'Imponente arreglo floral en pedestal/trípode de madera, cuidadosamente elaborado con rosas seleccionadas, flores y follaje natural.',
         pro_detalle_producto = jsonb_set(
           coalesce(pro_detalle_producto, '{}'::jsonb),
           '{beneficios}',
           '["Incluye tarjeta \"Nota de Pesar\" personalizada.","Cinta fúnebre."]'::jsonb,
           true
         ),
         pro_actualizado_en = now()
   where pro_negocio = 'tinkay' and pro_slug = 'pedestal-floral' and pro_eliminado_en is null;

  -- 24. Categoría "Arreglos Florales": agregar punto final limpio
  update comun_comercio.com_categoria
     set ctg_descripcion = 'Hermosos diseños florales decorados según la ocasión.',
         ctg_actualizado_en = now()
   where ctg_negocio = 'tinkay' and ctg_slug = 'arreglos-florales' and ctg_eliminado_en is null;
end $$;
