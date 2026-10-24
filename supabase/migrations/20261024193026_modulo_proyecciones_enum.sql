-- Proyecciones: el módulo nuevo entra al enum en su propia migración (un valor recién creado no se puede usar en la misma transacción).
alter type public.modulo_app add value if not exists 'proyecciones';
