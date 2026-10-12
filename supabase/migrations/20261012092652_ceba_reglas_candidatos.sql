-- Candidatos a ceba: qué animales conviene pasar a engorde o están por llegar a ese punto, con reglas que cada finca puede ajustar.
-- Nada derivado se guarda: los candidatos salen de una función. Lo único guardado es la regla de la finca y el «recordármelo después» de un animal.

-- ───────────────────────── Reglas por finca y especie ─────────────────────────
-- Los valores por defecto son criterios orientativos (no una norma): cada finca los ajusta según su raza y su sistema.
-- Si cambian aquí, cambian también en public.reglas_ceba_efectivas (que cubre a las fincas que aún no guardaron reglas).
create table public.reglas_ceba (
  finca_id uuid not null references public.fincas (id) on delete cascade,
  especie public.especie not null,
  hembra_partos_proxima smallint not null default 5 check (hembra_partos_proxima between 1 and 20),
  hembra_partos_toca smallint not null default 7 check (hembra_partos_toca between 1 and 20),
  hembra_meses_proxima smallint not null default 72 check (hembra_meses_proxima between 12 and 240),
  hembra_meses_toca smallint not null default 96 check (hembra_meses_toca between 12 and 240),
  macho_meses_proxima smallint not null default 3 check (macho_meses_proxima between 1 and 36),
  macho_meses_toca smallint not null default 4 check (macho_meses_toca between 1 and 36),
  reproductor_meses_viejo smallint not null default 84 check (reproductor_meses_viejo between 24 and 240),
  dias_entre_pesajes smallint not null default 30 check (dias_entre_pesajes between 7 and 365),
  hembra_dias_entre_pesajes smallint not null default 90 check (hembra_dias_entre_pesajes between 7 and 365),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (finca_id, especie),
  constraint reglas_ceba_partos_ck check (hembra_partos_proxima <= hembra_partos_toca),
  constraint reglas_ceba_hembra_edad_ck check (hembra_meses_proxima <= hembra_meses_toca),
  constraint reglas_ceba_macho_edad_ck check (macho_meses_proxima <= macho_meses_toca)
);
create trigger reglas_ceba_updated_at before update on public.reglas_ceba for each row execute function private.set_updated_at();
select private.crear_politicas_finca('reglas_ceba', 'carne');
grant select, insert, update, delete on public.reglas_ceba to authenticated;

-- «Recordármelo después»: mientras la fecha no pase, el animal no aparece como candidato.
alter table public.animales add column ceba_pospuesto_hasta date;

-- Las reglas que de verdad aplican a una finca: las suyas o, si no guardó nada, las sugeridas. Una fila por especie.
create function public.reglas_ceba_efectivas(p_finca uuid)
returns table (
  especie public.especie,
  hembra_partos_proxima smallint, hembra_partos_toca smallint,
  hembra_meses_proxima smallint, hembra_meses_toca smallint,
  macho_meses_proxima smallint, macho_meses_toca smallint,
  reproductor_meses_viejo smallint,
  dias_entre_pesajes smallint, hembra_dias_entre_pesajes smallint,
  personalizada boolean
)
language sql stable
set search_path = ''
as $$
  select e,
    coalesce(r.hembra_partos_proxima, 5::smallint), coalesce(r.hembra_partos_toca, 7::smallint),
    coalesce(r.hembra_meses_proxima, 72::smallint), coalesce(r.hembra_meses_toca, 96::smallint),
    coalesce(r.macho_meses_proxima, 3::smallint), coalesce(r.macho_meses_toca, 4::smallint),
    coalesce(r.reproductor_meses_viejo, 84::smallint),
    coalesce(r.dias_entre_pesajes, 30::smallint), coalesce(r.hembra_dias_entre_pesajes, 90::smallint),
    r.finca_id is not null
  from unnest(enum_range(null::public.especie)) as e
  left join public.reglas_ceba r on r.finca_id = p_finca and r.especie = e
  order by e;
$$;

-- ───────────────────────── Candidatos a ceba ─────────────────────────
-- Hembras: por partos (los registrados + los que ya había tenido) o por edad. Machos: «por definir» cuando llegan a la edad de decidir,
-- reproductores viejos y machos de carne sin lote. Una hembra gestante (o servida hace menos de lo que dura la gestación + 60 días) no se
-- lista si es joven; si ya pasó la edad límite se lista con la advertencia. Una hembra en lactancia o un animal en retiro de carne se listan
-- con su advertencia. Quien ya está en un lote abierto o tiene un «recordármelo después» vigente no aparece.
-- SECURITY DEFINER porque el estado reproductivo sale de partos y servicios, que un rol sin acceso a Reproducción no puede leer: así nadie
-- recibe un consejo equivocado por no ver una gestación. Valida dentro que quien llama pueda ver Carne en esa finca.
create function public.candidatos_ceba(p_finca uuid, p_animal uuid default null)
returns table (
  animal_id uuid, sexo text, especie text, edad_meses integer, partos_totales integer, uso_macho text,
  nivel text, motivos text[], advertencias text[], estado_repro text, en_lactancia boolean, retiro_carne_hasta date,
  peso_ultimo numeric, fecha_ultimo_peso date, gdp_reciente_g numeric
)
language sql stable security definer
set search_path = ''
as $$
  with hoy as (select (now() at time zone 'America/Bogota')::date as d),
  reglas as (select * from public.reglas_ceba_efectivas(p_finca)),
  pesos as (select * from public.ceba_animales(p_finca)),
  retiros as (select r.animal_id, r.retiro_carne_hasta from public.animales_en_retiro(p_finca) r where r.retiro_carne_hasta is not null and r.retiro_carne_hasta >= (select d from hoy)),
  base as (
    select a.id, a.sexo::text as sexo, a.especie::text as especie, a.uso_macho,
           (extract(year from age(h.d, a.fecha_nacimiento)) * 12 + extract(month from age(h.d, a.fecha_nacimiento)))::int as edad_meses,
           v.partos_totales::int as partos_totales, v.estado as estado_repro, coalesce(v.en_lactancia, false) as en_lactancia, v.ultimo_servicio,
           coalesce(pe.gestacion_dias, 150) as gestacion_dias, h.d as hoy,
           g.hembra_partos_proxima, g.hembra_partos_toca, g.hembra_meses_proxima, g.hembra_meses_toca,
           g.macho_meses_proxima, g.macho_meses_toca, g.reproductor_meses_viejo, g.dias_entre_pesajes, g.hembra_dias_entre_pesajes
    from public.animales a
    cross join hoy h
    join reglas g on g.especie::text = a.especie::text
    left join public.lotes_ceba l on l.id = a.lote_ceba_id and l.finca_id = a.finca_id
    left join public.v_repro_hembras v on v.animal_id = a.id
    left join public.parametros_especie pe on pe.especie::text = a.especie::text
    where a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null
      and (p_animal is null or a.id = p_animal)
      and (a.ceba_pospuesto_hasta is null or a.ceba_pospuesto_hasta <= h.d)
      and (l.id is null or l.cerrado_en is not null)
      and (select private.puede_ver(p_finca, 'carne'::public.modulo_app))
  ),
  evaluado as (
    select b.*,
      (b.estado_repro in ('gestante', 'servida') and b.ultimo_servicio is not null and b.ultimo_servicio >= b.hoy - (b.gestacion_dias + 60)) as preniada,
      case
        when b.sexo = 'hembra' then
          case when b.partos_totales >= b.hembra_partos_toca or b.edad_meses >= b.hembra_meses_toca then 'toca'
               when b.partos_totales >= b.hembra_partos_proxima or b.edad_meses >= b.hembra_meses_proxima then 'proxima' end
        when b.uso_macho is null then
          case when b.edad_meses >= b.macho_meses_toca then 'toca'
               when b.edad_meses >= b.macho_meses_proxima then 'proxima' end
        when b.uso_macho = 'reproductor' then
          case when b.edad_meses >= b.reproductor_meses_viejo then 'toca'
               when b.edad_meses >= b.reproductor_meses_viejo - 12 then 'proxima' end
        when b.uso_macho = 'carne' then 'toca'
      end as nivel
    from base b
  )
  select e.id, e.sexo, e.especie, e.edad_meses, e.partos_totales, e.uso_macho, e.nivel,
         array_remove(array[
           case when e.sexo = 'hembra' and e.partos_totales >= e.hembra_partos_proxima then 'partos' end,
           case when e.sexo = 'hembra' and e.edad_meses >= e.hembra_meses_proxima then 'edad' end,
           case when e.sexo = 'macho' and e.uso_macho is null then 'definir_uso' end,
           case when e.uso_macho = 'reproductor' then 'reproductor_viejo' end,
           case when e.uso_macho = 'carne' then 'carne_sin_lote' end
         ], null),
         array_remove(array[
           case when e.preniada and e.estado_repro = 'gestante' then 'gestante' end,
           case when e.preniada and e.estado_repro = 'servida' then 'probable_gestante' end,
           case when e.en_lactancia then 'lactancia' end,
           case when rt.animal_id is not null then 'retiro_carne' end,
           case when p.fecha_ultimo is null or e.hoy - p.fecha_ultimo > (case when e.sexo = 'hembra' then e.hembra_dias_entre_pesajes else e.dias_entre_pesajes end) then 'sin_pesar' end
         ], null),
         e.estado_repro, e.en_lactancia, rt.retiro_carne_hasta, p.peso_ultimo, p.fecha_ultimo, p.gdp_reciente_g
  from evaluado e
  left join pesos p on p.animal_id = e.id
  left join retiros rt on rt.animal_id = e.id
  where e.nivel is not null
    and (not e.preniada or (e.sexo = 'hembra' and (e.edad_meses >= e.hembra_meses_toca or (e.edad_meses is null and e.nivel = 'toca'))))
  order by (e.nivel = 'toca') desc, e.edad_meses desc nulls last;
$$;

revoke execute on function public.reglas_ceba_efectivas(uuid), public.candidatos_ceba(uuid, uuid) from public, anon;
grant execute on function public.reglas_ceba_efectivas(uuid), public.candidatos_ceba(uuid, uuid) to authenticated;
