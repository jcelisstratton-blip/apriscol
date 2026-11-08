-- IVA (impuesto al valor agregado) opcional en cada compra y en cada venta registrada.
--  · iva_tarifa: el porcentaje (19, 5, 0…) que escribe la persona; vacío = no se registró. Nunca se inventa una tarifa: la define quien registra.
--  · iva_valor: lo que del total es IVA, suponiendo que el total YA lo incluye (total − total / (1 + tarifa)). Es derivado: columna generada.
-- Solo agrega columnas: es retrocompatible y no cambia ningún total ni reporte existente.

alter table public.gastos
  add column iva_tarifa numeric(5, 2) check (iva_tarifa is null or (iva_tarifa >= 0 and iva_tarifa <= 100)),
  add column iva_valor numeric(14, 2) generated always as (
    case when iva_tarifa is null then null else round(monto - monto / (1 + iva_tarifa / 100), 2) end
  ) stored;

alter table public.ventas
  add column iva_tarifa numeric(5, 2) check (iva_tarifa is null or (iva_tarifa >= 0 and iva_tarifa <= 100)),
  add column iva_valor numeric(14, 2) generated always as (
    case when iva_tarifa is null then null
         else round(round(cantidad * precio_unitario, 2) - round(cantidad * precio_unitario, 2) / (1 + iva_tarifa / 100), 2) end
  ) stored;
