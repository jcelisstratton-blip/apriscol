-- Cómo y quién tomó la muestra del coprológico: «limpia» (directo del animal) o «contaminada» (recogida del piso), y quién la tomó (el veterinario de la finca u otra persona).
-- Nulos en los exámenes anteriores (no se sabe); el formulario los pide al registrar uno nuevo. Una muestra del piso no se puede atribuir con certeza a un animal: no dispara
-- la alerta individual ni cuenta como «último examen» del animal. Solo agrega columnas y reemplaza una vista (retrocompatible).
alter table public.examenes_coprologicos
  add column tipo_muestra text check (tipo_muestra is null or tipo_muestra in ('limpia', 'contaminada')),
  add column tomada_por text check (tomada_por is null or char_length(tomada_por) between 1 and 120);

create or replace view public.v_coprologico_animal with (security_invoker = true) as
select distinct on (x.animal_id)
       x.animal_id, x.finca_id, x.id as examen_id, x.fecha as ultima_fecha, x.hpg, x.opg,
       (select max(e.fecha)
          from public.evento_sanitario_animales ea
          join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
         where ea.animal_id = x.animal_id and ea.finca_id = x.finca_id and e.tipo = 'desparasitacion' and e.fecha >= x.fecha) as desparasitado_en
from public.examenes_coprologicos x
join public.animales a on a.id = x.animal_id and a.finca_id = x.finca_id and a.estado = 'activo' and a.deleted_at is null
where x.momento <> 'despues' and x.tipo_muestra is distinct from 'contaminada'
order by x.animal_id, x.fecha desc;
