-- El lote del producto aplicado también se ve en los listados (historial de la finca y de cada animal). Columna al final: retrocompatible.
create or replace view public.v_eventos_sanitarios with (security_invoker = true) as
select e.id,
       e.finca_id,
       e.fecha,
       e.tipo,
       e.producto_id,
       e.producto_nombre,
       e.dosis,
       e.unidad_dosis,
       e.retiro_leche_dias,
       e.retiro_carne_dias,
       e.fin_retiro_leche,
       e.fin_retiro_carne,
       e.proxima_fecha,
       e.responsable,
       e.diagnostico,
       e.created_at,
       (select count(*) from public.evento_sanitario_animales ea where ea.evento_id = e.id and ea.finca_id = e.finca_id) as animales,
       (select ea.animal_id
          from public.evento_sanitario_animales ea
          join public.animales a on a.id = ea.animal_id and a.finca_id = ea.finca_id
         where ea.evento_id = e.id and ea.finca_id = e.finca_id
         order by a.numero_arete limit 1) as primer_animal_id,
       (select case when a.nombre is null then a.numero_arete else a.nombre || ' · ' || a.numero_arete end
          from public.evento_sanitario_animales ea
          join public.animales a on a.id = ea.animal_id and a.finca_id = ea.finca_id
         where ea.evento_id = e.id and ea.finca_id = e.finca_id
         order by a.numero_arete limit 1) as primer_animal,
       e.lote_producto
from public.eventos_sanitarios e;

create or replace view public.v_eventos_animal with (security_invoker = true) as
select ea.animal_id,
       e.id,
       e.finca_id,
       e.fecha,
       e.tipo,
       e.producto_nombre,
       e.dosis,
       e.unidad_dosis,
       e.retiro_leche_dias,
       e.retiro_carne_dias,
       e.fin_retiro_leche,
       e.fin_retiro_carne,
       e.proxima_fecha,
       e.diagnostico,
       e.created_at,
       e.lote_producto
from public.evento_sanitario_animales ea
join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id;
