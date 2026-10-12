-- Totales de premios de toda la finca (el compendio de «Premios»). Modo invoker: respeta RLS.
create view public.v_palmares_finca with (security_invoker = true) as
select p.finca_id,
       count(*) as participaciones,
       count(*) filter (where p.resultado <> 'participacion') as premios,
       count(*) filter (where p.resultado in ('gran_campeon', 'campeon')) as campeonatos,
       coalesce(sum(p.premio_en_dinero), 0) as dinero,
       count(distinct p.animal_id) filter (where p.resultado <> 'participacion') as animales_premiados
from public.participaciones_feria p
group by p.finca_id;

revoke all on public.v_palmares_finca from anon;
grant select on public.v_palmares_finca to authenticated;
