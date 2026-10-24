-- Diagnóstico de gestación: datos propios de cada método (ecografía, palpación u otro) y vínculo obligatorio con un servicio.
-- Solo agrega columnas y un disparador de inserción: es retrocompatible (los diagnósticos ya guardados no se tocan).
--  · Ecografía: `dias_gestacion` (estimados por el ecografista), `num_fetos` (1 a 4) y `viabilidad_fetal` (latido / sin actividad).
--  · Palpación: `indicador_palpacion` (ausencia o retorno de celo, llenado uterino, revisión manual) y `condicion_corporal` (1 a 5).
--  · Otro método: `prueba_nombre` (prueba o kit) y `prueba_resultado` (valor o resultado analítico).
-- El estado de la hembra (gestante, vacía, en observación) y la fecha prevista de parto siguen saliendo de `v_repro_hembras`: no se guardan.

alter table public.diagnosticos_gestacion
  add column dias_gestacion smallint check (dias_gestacion between 1 and 200),
  add column num_fetos smallint check (num_fetos between 1 and 4),
  add column viabilidad_fetal text check (viabilidad_fetal in ('latido', 'sin_actividad')),
  add column indicador_palpacion text check (indicador_palpacion in ('ausencia_celo', 'retorno_celo', 'llenado_uterino', 'revision_manual')),
  add column condicion_corporal numeric(2, 1) check (condicion_corporal between 1 and 5),
  add column prueba_nombre text,
  add column prueba_resultado text;

-- Un diagnóstico nuevo siempre cuelga de un servicio de la misma hembra y no es anterior a él.
create or replace function private.dx_validar_servicio()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_servicio public.servicios%rowtype;
begin
  if new.servicio_id is null then
    raise exception 'El diagnóstico debe corresponder a un servicio de la hembra: registra primero el servicio.' using errcode = 'check_violation';
  end if;
  select * into v_servicio from public.servicios where id = new.servicio_id and finca_id = new.finca_id;
  if not found or v_servicio.hembra_id <> new.hembra_id then
    raise exception 'El servicio no corresponde a esta hembra.' using errcode = 'check_violation';
  end if;
  if new.fecha < v_servicio.fecha then
    raise exception 'El diagnóstico no puede ser anterior al servicio.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger diagnosticos_validar_servicio before insert on public.diagnosticos_gestacion
  for each row execute function private.dx_validar_servicio();
