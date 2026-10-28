-- Etapas de crecimiento y mezcla en los corrales, editables por el propietario en Ajustes de la finca (grupo «Crecimiento y corrales»).
-- destete_dias: hasta qué edad un animal es lactante. corral_razon_peso: cuántas veces puede pesar el más pesado de un corral el más liviano antes de avisar.
-- Solo agrega columnas con su valor de fábrica: las fincas existentes no cambian (retrocompatible).

alter table public.finca_ajustes
  add column destete_dias smallint not null default 60 check (destete_dias between 45 and 90),
  add column corral_razon_peso numeric(3, 1) not null default 1.5 check (corral_razon_peso between 1.2 and 3);

-- «Restablecer» acepta también el grupo Crecimiento y corrales.
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
    else
      raise exception 'Ese grupo de ajustes no existe.' using errcode = 'invalid_parameter_value';
  end case;
  if v_filas = 0 then
    raise exception 'Solo el propietario puede cambiar los ajustes de la finca.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;
