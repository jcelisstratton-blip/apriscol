-- Moneda de cada finca (código ISO 4217): con ella se escribe todo el dinero de la app (compras, ventas, costos, reportes).
-- De fábrica COP (peso colombiano): las fincas existentes no cambian. Solo agrega una columna: retrocompatible.
alter table public.fincas
  add column moneda text not null default 'COP' check (moneda ~ '^[A-Z]{3}$');
