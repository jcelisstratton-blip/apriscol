-- IVA predeterminado de la finca (ajuste del propietario, grupo «Dinero») y IVA opcional también en la leche despachada y en la venta de un animal.
--  · finca_ajustes.iva_tarifa_defecto: el porcentaje que aparece ya escrito en los formularios de compra y de venta (se puede cambiar en cada uno o borrar).
--    Vacío = no se precarga nada. De fábrica 19 (tarifa general de Colombia); cada finca lo cambia según su país.
--  · despachos_leche y bajas: iva_tarifa + iva_valor (columna generada, el total ya incluye el IVA), igual que gastos y ventas.
-- Solo agrega columnas: retrocompatible.

alter table public.finca_ajustes
  add column iva_tarifa_defecto numeric(5, 2) default 19 check (iva_tarifa_defecto is null or (iva_tarifa_defecto >= 0 and iva_tarifa_defecto <= 100));

alter table public.despachos_leche
  add column iva_tarifa numeric(5, 2) check (iva_tarifa is null or (iva_tarifa >= 0 and iva_tarifa <= 100)),
  add column iva_valor numeric(14, 2) generated always as (
    case when iva_tarifa is null or precio_litro is null then null
         else round(round(litros * precio_litro, 2) - round(litros * precio_litro, 2) / (1 + iva_tarifa / 100), 2) end
  ) stored;

alter table public.bajas
  add column iva_tarifa numeric(5, 2) check (iva_tarifa is null or (iva_tarifa >= 0 and iva_tarifa <= 100)),
  add column iva_valor numeric(14, 2) generated always as (
    case when iva_tarifa is null or valor is null then null else round(valor - valor / (1 + iva_tarifa / 100), 2) end
  ) stored;

-- «Restablecer» acepta también el grupo Dinero (el resto de grupos queda como estaba en 20261028050034).
create or replace function public.restablecer_ajustes_finca(p_finca uuid, p_grupo text) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_filas integer;
begin
  case p_grupo
    when 'reproduccion' then
      update public.finca_ajustes set servicio_edad_min_meses = default, servicio_peso_adulto_pct = default, servicio_cc_min = default,
        dx_prenez_dia_desde = default, dx_prenez_dia_hasta = default, ultimo_tercio_dia = default,
        parto_preparar_dias = default, parto_vigilar_dias = default, vacia_aviso_dias = default, vacia_urgente_dias = default
      where finca_id = p_finca;
      get diagnostics v_filas = row_count;
      update public.finca_ajustes_especie f set gestacion_dias = p.gestacion_dias, peso_adulto_hembra_kg = null
      from public.parametros_especie p where p.especie = f.especie and f.finca_id = p_finca;
    when 'ceba' then
      update public.finca_ajustes set gdp_minima_g = default, cc_venta_min = default, cc_venta_max = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
      update public.finca_ajustes_especie f set peso_faena_min_kg = p.peso_faena_min_kg, peso_faena_max_kg = p.peso_faena_max_kg
      from public.parametros_especie p where p.especie = f.especie and f.finca_id = p_finca;
    when 'leche' then
      update public.finca_ajustes set ccs_limite_miles_ml = default, secado_dias_antes_parto = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
      update public.finca_ajustes_especie f set grasa_min_pct = p.grasa_min_pct, grasa_max_pct = p.grasa_max_pct,
        proteina_min_pct = p.proteina_min_pct, proteina_max_pct = p.proteina_max_pct
      from public.parametros_especie p where p.especie = f.especie and f.finca_id = p_finca;
    when 'sanidad' then
      update public.finca_ajustes set pediluvio_dias = default, pediluvio_dias_lluvia = default, meses_lluvia = default,
        podologia_inspeccion_dias = default, vacuna_rabia_dias = default, vacuna_clostridiosis_dias = default
      where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    when 'nutricion' then
      update public.finca_ajustes set ms_mantenimiento_pct = default, ms_produccion_min_pct = default, ms_produccion_max_pct = default,
        stock_autonomia_dias = default
      where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    when 'crecimiento' then
      update public.finca_ajustes set destete_dias = default, corral_razon_peso = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    when 'personal' then
      update public.finca_ajustes set factor_prestacional = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    when 'dinero' then
      update public.finca_ajustes set iva_tarifa_defecto = default where finca_id = p_finca;
      get diagnostics v_filas = row_count;
    else
      raise exception 'Ese grupo de ajustes no existe.' using errcode = 'invalid_parameter_value';
  end case;
  if v_filas = 0 then
    raise exception 'Solo el propietario puede cambiar los ajustes de la finca.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;
