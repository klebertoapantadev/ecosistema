# packages/db

Tipos generados desde el esquema de Supabase (`supabase gen types typescript`) y helpers de consulta por esquema. Única puerta de acceso a la base de datos — ningún componente instancia su propio cliente Supabase.

Los tipos se regeneran y commitean en el mismo PR que introduce una migración. Nunca se escriben a mano.
