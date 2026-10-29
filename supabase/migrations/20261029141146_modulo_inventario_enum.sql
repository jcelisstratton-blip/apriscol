-- Inventario de bodega: el módulo entra al enum en su propia migración (un valor de enum recién creado no puede usarse en la misma transacción).
alter type public.modulo_app add value if not exists 'inventario';
