# Checklist: Incorporar un Producto Nuevo al Ecosistema

Copiar como issue usando `.github/ISSUE_TEMPLATE/producto-nuevo.yml`.

1. [ ] Definir identificador corto de marca y completar la tabla de nomenclatura ([`estandares/00-nomenclatura-base-datos.md`](../estandares/00-nomenclatura-base-datos.md) §1).
2. [ ] Crear esquema de negocio dedicado en la instancia Supabase compartida.
3. [ ] Modelar entidades con prefijos de tabla/columna siguiendo la fórmula estándar.
4. [ ] Vincular usuarios del producto a `comun_seguridad.seg_usuario` vía rol(es) nuevos en `seg_membresia`.
5. [ ] Aplicar `aud_fn_auditar_tabla()` a cada tabla de negocio antes de producción.
6. [ ] Habilitar RLS en el 100% de las tablas nuevas; definir políticas por rol.
7. [ ] Cifrar columnas sensibles identificadas en el modelado; aplicar `seg_enmascarar_texto()` donde corresponda.
8. [ ] Si el producto cobra: integrar con `comun_facturacion` en vez de tabla propia.
9. [ ] Crear la app en `apps/{producto}-web` a partir de `apps/_plantilla-web` (o `pnpm crear-producto`).
10. [ ] Registrar el producto: nuevo proyecto de Vercel (Root Directory + dominio + `turbo-ignore`), entrada en `gobernanza/productos/{producto}/`.
11. [ ] Redactar `especificacion-funcional.md` y `especificacion-tecnica.md` iniciales del producto.
12. [ ] Validar que el producto aparece correctamente en las vistas del GitHub Project.
13. [ ] Confirmar con el responsable de plataforma si el producto requiere workflow de entrega/escrow (ver [`estandares/02-git-y-despliegue.md`](../estandares/02-git-y-despliegue.md) §8) — depende del modelo comercial del cliente, no es automático.
