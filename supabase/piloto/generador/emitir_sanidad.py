import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import sim, hato, sanidad
from emitir_hato import FINCA, DUENO, SALIDA, jd, filas_json, trozos, escribir

def main():
    for v in SALIDA.glob("05*.sql"): v.unlink()
    r = sim.simular(hato.SEED)
    o = sanidad.construir(r)
    sanidad.verificar(r, o)
    ev = o["eventos"]
    grupos = trozos(ev, 22)
    for i, g in enumerate(grupos, 1):
        sql = f"""-- PILOTO · 05a · Eventos sanitarios {i}/{len(grupos)} (vacunas, pediluvio, podología, tratamientos, desparasitaciones y cirugías), con los animales de cada uno.
do $e$
declare fn constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb; v_e uuid; vet constant text := '{sanidad.VET}';
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(g)}
$j$::jsonb) loop
    if exists (select 1 from public.eventos_sanitarios x where x.finca_id = fn and x.fecha = (r->>0)::date and x.tipo = r->>1 and coalesce(x.producto_nombre,'') = coalesce(r->>5,'') and coalesce(x.categoria,'') = coalesce(r->>2,'') and coalesce(x.diagnostico,'') = coalesce(r->>14,'') and exists (select 1 from public.evento_sanitario_animales ea join public.animales a on a.id = ea.animal_id where ea.evento_id = x.id and a.numero_arete = (r->21->>0))) then continue; end if;
    insert into public.eventos_sanitarios (finca_id, fecha, tipo, producto_id, producto_nombre, lote_producto, fecha_vencimiento, dosis, unidad_dosis, via, responsable, retiro_leche_dias, retiro_carne_dias,
        diagnostico, observaciones, proxima_fecha, categoria, motivo, etapa, dias_tratamiento, cojera, concentracion_pct, minutos, anestesia, created_by, created_at)
    values (fn, (r->>0)::date, r->>1, (select p.id from public.productos_veterinarios p where p.finca_id = fn and p.nombre = r->>5), nullif(r->>5,''), nullif(r->>9,''), nullif(r->>10,'')::date,
        nullif(r->>6,'')::numeric, nullif(r->>7,''), nullif(r->>8,''), case when r->>1 in ('pediluvio') or (r->>1 = 'podologia' and r->>2 = 'recorte') then 'Jhon Fredy Giraldo' else vet end,
        nullif(r->>11,'')::smallint, nullif(r->>12,'')::smallint, nullif(r->>14,''), nullif(r->>15,''), nullif(r->>13,'')::date, nullif(r->>2,''), nullif(r->>4,''), nullif(r->>3,''),
        nullif(r->>20,'')::smallint, nullif(r->>19,'')::smallint, nullif(r->>16,'')::numeric, nullif(r->>17,'')::smallint, nullif(r->>18,''), u, (r->>0)::timestamptz)
    returning id into v_e;
    insert into public.evento_sanitario_animales (evento_id, animal_id, finca_id)
    select v_e, a.id, fn from public.animales a where a.finca_id = fn and a.numero_arete in (select jsonb_array_elements_text(r->21));
  end loop;
end
$e$;
"""
        escribir(f"05a_eventos_{i:02d}.sql", sql)
    fam = o["famacha"]
    for i, g in enumerate(trozos(fam, 350), 1):
        sql = f"""-- PILOTO · 05b · Evaluaciones FAMACHA {i} ({len(g)} de {len(fam)}): rondas cada 6 a 8 semanas, con la de 21-oct armada para mostrar qué hacer hoy.
do $f$
declare fn constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(g)}
$j$::jsonb) loop
    insert into public.evaluaciones_famacha (finca_id, animal_id, fecha, puntaje, observaciones, created_by, created_at)
    select fn, a.id, (r->>1)::date, (r->>2)::smallint, nullif(r->>3,''), u, (r->>1)::timestamptz
    from public.animales a where a.finca_id = fn and a.numero_arete = r->>0
      and not exists (select 1 from public.evaluaciones_famacha x where x.animal_id = a.id and x.fecha = (r->>1)::date);
  end loop;
end
$f$;
"""
        escribir(f"05b_famacha_{i:02d}.sql", sql)
    sql = f"""-- PILOTO · 05c · Pruebas de laboratorio ({len(o['pruebas'])}) y programas sanitarios que vienen ({len(o['programas'])}).
do $p$
declare fn constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb; v_p uuid;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(o['pruebas'])}
$j$::jsonb) loop
    insert into public.pruebas_sanitarias (finca_id, animal_id, prueba, fecha, resultado, laboratorio, observaciones, created_by, created_at)
    select fn, a.id, r->>1, (r->>2)::date, r->>3, nullif(r->>4,''), nullif(r->>5,''), u, (r->>2)::timestamptz
    from public.animales a where a.finca_id = fn and a.numero_arete = r->>0
      and not exists (select 1 from public.pruebas_sanitarias x where x.animal_id = a.id and x.prueba = r->>1 and x.fecha = (r->>2)::date);
  end loop;
  for r in select value from jsonb_array_elements($j$
{filas_json(o['programas'])}
$j$::jsonb) loop
    if exists (select 1 from public.programas_sanitarios x where x.finca_id = fn and x.tipo = r->>0 and x.fecha_programada = (r->>1)::date) then continue; end if;
    insert into public.programas_sanitarios (finca_id, tipo, fecha_programada, producto_id, producto_nombre, dosis, unidad_dosis, via, retiro_leche_dias, retiro_carne_dias, observaciones, created_by)
    select fn, r->>0, (r->>1)::date, p.id, coalesce(p.nombre, r->>2),
           case r->>0 when 'vacunacion' then 2 when 'desparasitacion' then 1 end, case when r->>0 <> 'pediluvio' then p.unidad_dosis end,
           case r->>0 when 'vacunacion' then 'subcutanea' when 'desparasitacion' then 'subcutanea' end, coalesce(p.retiro_leche_dias,0), coalesce(p.retiro_carne_dias,0), r->>3, u
    from (select 1) x left join public.productos_veterinarios p on p.finca_id = fn and p.nombre = r->>2
    returning id into v_p;
    insert into public.programa_sanitario_animales (programa_id, animal_id, finca_id)
    select v_p, a.id, fn from public.animales a where a.finca_id = fn and a.numero_arete in (select jsonb_array_elements_text(r->4));
  end loop;
end
$p$;
"""
    escribir("05c_pruebas_y_programas.sql", sql)
    print({k: len(v) for k, v in o.items()}, len(grupos), "grupos de eventos")

if __name__ == "__main__":
    main()
