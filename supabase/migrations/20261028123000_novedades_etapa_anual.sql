-- La revacunación se guarda como «anual», igual que en los registros de Sanidad.
alter table public.novedades drop constraint novedades_etapa_check;
alter table public.novedades add constraint novedades_etapa_check check (etapa is null or etapa in ('primera', 'refuerzo', 'anual'));
