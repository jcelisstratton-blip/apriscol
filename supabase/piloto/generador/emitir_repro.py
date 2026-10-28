"""Emite carga/03*.sql: lactancias abiertas, gestaciones (servicio, diagnóstico, parto y crías), secado y celos."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import sim, hato, repro
from emitir_hato import FINCA, DUENO, SALIDA, jd, filas_json, trozos, escribir

def main():
    for v in SALIDA.glob("03*.sql"): v.unlink()
    r = sim.simular(hato.SEED)
    o = repro.construir(r)
    # a) lactancias abiertas a la adopción
    sql = f"""-- PILOTO · 03a · Lactancias abiertas al adoptar Apriscol ({len(o['lact_pre'])}): el parto fue antes y la cabra seguía en leche.
do $l$
declare f constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(o['lact_pre'])}
$j$::jsonb) loop
    insert into public.lactancias (finca_id, animal_id, numero, fecha_parto, fecha_secado, created_by, created_at)
    select f, a.id, (r->>1)::smallint, (r->>2)::date, nullif(r->>3,'')::date, u, (r->>2)::timestamptz
    from public.animales a where a.finca_id = f and a.numero_arete = r->>0
      and not exists (select 1 from public.lactancias x where x.animal_id = a.id and x.numero = (r->>1)::smallint);
  end loop;
end
$l$;
"""
    escribir("03a_lactancias_previas.sql", sql)
    # b) gestaciones
    grupos = trozos(o["filas"], 52)
    for i, g in enumerate(grupos, 1):
        sql = f"""-- PILOTO · 03b · Gestaciones {i}/{len(grupos)} (servicio → diagnóstico → parto → crías). El parto abre solo la lactancia de las cabras.
do $g$
declare f constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb; v_h uuid; v_s uuid; v_p uuid; c jsonb; vet constant text := '{repro.VET}';
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(g)}
$j$::jsonb) loop
    select id into v_h from public.animales where finca_id = f and numero_arete = r->>0;
    if v_h is null then raise exception 'Hembra inexistente: %', r->>0; end if;
    if exists (select 1 from public.servicios where hembra_id = v_h and fecha = (r->>1)::date) then continue; end if;
    insert into public.servicios (finca_id, hembra_id, fecha, tipo, macho_id, macho_externo, semen_lote, responsable, tecnica_inseminacion, created_by, created_at)
    values (f, v_h, (r->>1)::date, r->>2, (select m.id from public.animales m where m.finca_id = f and m.numero_arete = r->>3), nullif(r->>4,''), nullif(r->>5,''),
            case when r->>2 = 'inseminacion' then vet end, case when r->>2 = 'inseminacion' then 'cervical' end, u, (r->>1)::timestamptz)
    returning id into v_s;
    if r->>6 is not null then
      insert into public.diagnosticos_gestacion (finca_id, hembra_id, servicio_id, fecha, metodo, resultado, dias_gestacion, num_fetos, viabilidad_fetal, indicador_palpacion,
                                                 condicion_corporal, responsable, created_by, created_at)
      values (f, v_h, v_s, (r->>6)::date, r->>8, r->>7, nullif(r->>9,'')::smallint, nullif(r->>10,'')::smallint,
              case when r->>8 = 'ecografia' and r->>7 = 'gestante' then 'latido' end, nullif(r->>11,''), nullif(r->>12,'')::numeric, vet, u, (r->>6)::timestamptz);
    end if;
    if r->>13 is not null then
      insert into public.partos (finca_id, madre_id, servicio_id, fecha, tipo, numero_crias, causa_aborto, asistido_por, protocolo_posoperatorio, created_by, created_at)
      values (f, v_h, v_s, (r->>13)::date, r->>14, jsonb_array_length(r->16), nullif(r->>15,''),
              case r->>14 when 'asistido' then 'Wilson Atehortúa' when 'cesarea' then vet end,
              case r->>14 when 'cesarea' then 'Antibiótico por 5 días y antiinflamatorio por 3' end, u, (r->>13)::timestamptz)
      returning id into v_p;
      for c in select value from jsonb_array_elements(r->16) loop
        insert into public.crias (finca_id, parto_id, animal_id, sexo, peso_nacer_kg, vivo, created_at)
        values (f, v_p, (select x.id from public.animales x where x.finca_id = f and x.numero_arete = c->>0), (c->>1)::public.sexo_animal, nullif(c->>2,'')::numeric, true, (r->>13)::timestamptz);
      end loop;
    end if;
  end loop;
end
$g$;
"""
        escribir(f"03b_gestaciones_{i:02d}.sql", sql)
    # c) secado y celos
    sql = f"""-- PILOTO · 03c · Fechas de secado de las lactancias del año ({len(o['lact_upd'])}) y celos observados ({len(o['celos'])}).
do $c$
declare f constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(o['lact_upd'])}
$j$::jsonb) loop
    update public.lactancias l set fecha_secado = (r->>2)::date
    from public.animales a where a.finca_id = f and a.numero_arete = r->>0 and l.animal_id = a.id and l.fecha_parto = (r->>1)::date and l.fecha_secado is null;
  end loop;
  for r in select value from jsonb_array_elements($j$
{filas_json(o['celos'])}
$j$::jsonb) loop
    insert into public.celos (finca_id, hembra_id, fecha, observaciones, created_by, created_at)
    select f, a.id, (r->>1)::date, r->>2, u, (r->>1)::timestamptz from public.animales a where a.finca_id = f and a.numero_arete = r->>0
      and not exists (select 1 from public.celos x where x.hembra_id = a.id and x.fecha = (r->>1)::date);
  end loop;
end
$c$;
"""
    escribir("03c_secado_y_celos.sql", sql)
    print({k: len(v) for k, v in o.items()}, "abortos:", sum(1 for x in o["filas"] if x[14] == "aborto"))

if __name__ == "__main__":
    main()
