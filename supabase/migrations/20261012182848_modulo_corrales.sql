-- Módulo «corrales» (instalaciones y rotación). Va en su propia migración: un valor de enum recién creado no puede usarse
-- en la misma transacción (las tablas y políticas del módulo se crean en la migración siguiente).
alter type public.modulo_app add value if not exists 'corrales';
