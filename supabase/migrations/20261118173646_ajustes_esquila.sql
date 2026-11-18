-- Ajustes de la esquila (por finca): cada cuánto se esquila una oveja de lana y con cuántos días de anticipación se avisa que toca.
-- Los valores de fábrica viven solo aquí (defaults de columna): 12 meses (una esquila al año) y aviso 30 días antes. El propietario los cambia en
-- «Ajustes de la finca» y «restablecer» vuelve a estos valores. Retrocompatible: solo agrega columnas con default y una rama en la función de restablecer.
alter table public.finca_ajustes
  add column esquila_cada_meses smallint not null default 12 check (esquila_cada_meses between 3 and 24),
  add column esquila_aviso_dias smallint not null default 30 check (esquila_aviso_dias between 7 and 90);
comment on column public.finca_ajustes.esquila_cada_meses is 'Cada cuántos meses se esquila una oveja de lana (3 a 24).';
comment on column public.finca_ajustes.esquila_aviso_dias is 'Cuántos días antes de la fecha prevista se avisa que toca esquilar (7 a 90).';

create or replace function public.restablecer_ajustes_finca(p_finca uuid, p_grupo text)
returns void
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
    when 'esquila' then
      update public.finca_ajustes set esquila_cada_meses = default, esquila_aviso_dias = default where finca_id = p_finca;
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
