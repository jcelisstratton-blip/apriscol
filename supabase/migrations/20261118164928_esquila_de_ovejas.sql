-- Esquila de ovejas.
-- En Colombia hay ovejas de lana (Merino, Corriedale, Romney Marsh…) y de pelo (Pelibuey, Katahdin, Blackbelly, Santa Inés…), y muchas que
-- pueden ser de cualquiera de las dos (criollas y cruces). Solo se esquilan las de lana. Por eso:
--  · cada RAZA trae su cobertura de referencia: «lana», «pelo» o «variable» (catálogo global, solo lectura);
--  · cada OVEJA puede llevar su propia cobertura («lana» o «pelo») que manda sobre la de la raza, para las variables o las excepciones;
--  · la cobertura efectiva (la de la oveja y, si no tiene, la de su raza) NO se guarda: se calcula (lib/esquila.ts y esta migración);
--  · una esquila es un evento de la finca (fecha, quién esquiló, costo, notas) con las ovejas esquiladas y, si se pesó, los kilos de vellón de cada una.
-- Retrocompatible: solo agrega columnas y tablas. Sin borrados: una esquila mal registrada se ANULA (queda en la bitácora), igual que los animales
-- no se borran sino que se marcan.

-- 1) Cobertura de referencia de cada raza ovina (las cabras no llevan: no se esquilan).
alter table public.razas
  add column cobertura text check (cobertura in ('lana', 'pelo', 'variable'));
comment on column public.razas.cobertura is 'Solo ovinos. lana = se esquila; pelo = no se esquila; variable = puede ser de lana o de pelo (la persona lo define en cada oveja).';

update public.razas set cobertura = 'lana'
where especie = 'ovino' and nombre in ('Merino', 'Corriedale', 'Romney Marsh', 'Cheviot', 'Hampshire', 'Dorset', 'Suffolk', 'Île de France');
update public.razas set cobertura = 'pelo'
where especie = 'ovino' and nombre in ('Pelibuey', 'Blackbelly', 'Katahdin', 'Santa Inés', 'Dorper', 'White Dorper', 'Abisinia', 'Etíope', 'Sudán');
update public.razas set cobertura = 'variable'
where especie = 'ovino' and nombre in ('Criollo colombiano', 'Cruce');

-- 2) Cobertura propia de la oveja (la define la persona; vacía = la de su raza).
alter table public.animales
  add column cobertura text check (cobertura in ('lana', 'pelo')),
  add constraint animales_cobertura_solo_ovinos check (cobertura is null or especie = 'ovino');
comment on column public.animales.cobertura is 'Solo ovinos. lana o pelo; vacía = la de su raza. Manda sobre la de la raza.';
