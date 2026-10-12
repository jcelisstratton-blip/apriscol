-- La raza del semental externo es obligatoria y va ligada a su especie: una cabra solo puede ser de una raza caprina y una oveja de una ovina.
-- (La columna de texto `raza` queda en desuso; se podrá quitar cuando se confirme el borrado de columnas.)
alter table public.razas add constraint razas_id_especie_uk unique (id, especie);

alter table public.sementales_externos add column raza_id smallint not null;
alter table public.sementales_externos
  add constraint sementales_externos_raza_fk foreign key (raza_id, especie) references public.razas (id, especie);
comment on column public.sementales_externos.raza is 'En desuso: la raza es obligatoria y sale de razas (raza_id), ligada a la especie.';
