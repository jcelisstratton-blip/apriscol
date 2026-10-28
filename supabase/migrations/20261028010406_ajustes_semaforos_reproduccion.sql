-- Plazos de los semáforos de reproducción, editables por el propietario en Ajustes de la finca (grupo Reproducción).
-- Solo agrega columnas con su valor de fábrica: las fincas existentes quedan como están hoy (retrocompatible).

alter table public.finca_ajustes
  add column parto_preparar_dias smallint not null default 30 check (parto_preparar_dias between 15 and 60),
  add column parto_vigilar_dias smallint not null default 14 check (parto_vigilar_dias between 3 and 30),
  add column vacia_aviso_dias smallint not null default 60 check (vacia_aviso_dias between 30 and 180),
  add column vacia_urgente_dias smallint not null default 120 check (vacia_urgente_dias between 60 and 365),
  add constraint finca_ajustes_parto_ck check (parto_vigilar_dias <= parto_preparar_dias),
  add constraint finca_ajustes_vacia_ck check (vacia_aviso_dias <= vacia_urgente_dias);

-- «Restablecer» el grupo Reproducción vuelve también a los plazos nuevos.
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
