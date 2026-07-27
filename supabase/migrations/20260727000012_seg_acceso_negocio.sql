-- La identidad es una sola en todo el ecosistema (PLT-001), asi que
-- seg_acceso ya era intencionalmente comun a los 4 negocios (PLT-018 regla
-- 4) -- un usuario que entra a Tranqi, Tinkay y Margaritas ve las 3
-- entradas en su historial, no una lista separada por app. Eso es correcto
-- por diseno, pero sin saber DE QUE APP fue cada acceso la lista confunde
-- (se ve como si "duplicara" accesos de otra app). Se agrega acc_negocio
-- para que la UI pueda mostrar "Margaritas", "Tranqi", etc. junto a cada
-- fila -- nullable porque las filas ya existentes no lo tienen.
alter table comun_seguridad.seg_acceso
  add column acc_negocio text;
