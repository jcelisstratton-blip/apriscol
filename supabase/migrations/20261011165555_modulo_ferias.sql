-- Módulo «ferias». Va en su propia migración: un valor de enum recién creado no puede usarse
-- en la misma transacción (las políticas del módulo se crean en la migración siguiente).
alter type public.modulo_app add value if not exists 'ferias';
