-- Pediluvio (baño de patas): la última vez que se le hizo a cada animal activo. Con el intervalo de la finca (`finca_ajustes.pediluvio_dias`,
-- más corto en meses de lluvia) sale la lista de animales a los que ya les toca. Igual que `v_podologia_animal`, pero del tipo «pediluvio».
create view public.v_pediluvio_animal with (security_invoker = true) as
select a.id as animal_id, a.finca_id,
       (select max(e.fecha) from public.evento_sanitario_animales ea join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
         where ea.animal_id = a.id and ea.finca_id = a.finca_id and e.tipo = 'pediluvio') as ultima_fecha
from public.animales a
where a.estado = 'activo' and a.deleted_at is null;
revoke all on public.v_pediluvio_animal from anon;
grant select on public.v_pediluvio_animal to authenticated;
