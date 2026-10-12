-- Último análisis de calidad de cada animal (para la lista de Hato → Ordeño → Calidad y para avisar de células somáticas altas) sin
-- depender de cuántos análisis tenga la finca. Modo invoker: respetan RLS.
create view public.v_analisis_leche_ultimo with (security_invoker = true) as
select distinct on (animal_id) *
from public.analisis_leche
where animal_id is not null
order by animal_id, fecha desc, created_at desc;

-- Igual, pero el último que midió células somáticas (el último análisis puede ser solo de grasa).
create view public.v_rcs_leche_ultimo with (security_invoker = true) as
select distinct on (animal_id) *
from public.analisis_leche
where animal_id is not null and rcs_miles_ml is not null
order by animal_id, fecha desc, created_at desc;

revoke all on public.v_analisis_leche_ultimo, public.v_rcs_leche_ultimo from anon;
grant select on public.v_analisis_leche_ultimo, public.v_rcs_leche_ultimo to authenticated;
