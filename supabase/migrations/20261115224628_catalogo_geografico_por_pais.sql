-- Catálogo geográfico por país (para poder recibir fincas de otros países, empezando por Ecuador) y el país de cada finca.
-- Se AGREGA sin quitar nada: `divipola_*` y las columnas `departamento_dane`/`municipio_dane` siguen funcionando igual (retrocompatible).
-- A partir de aquí la fuente general es `geo_divisiones`; Colombia se copia de `divipola_*` (no se vuelve a escribir a mano).
--
-- Niveles: 1 = departamento (CO) / provincia (EC); 2 = municipio (CO) / cantón (EC); 3 = reservado (parroquia en EC).
-- Para sumar un país: una fila en `geo_paises` (activo = false hasta tener sus datos), sus divisiones oficiales en `geo_divisiones`
-- (códigos del organismo estadístico del país), sus equivalencias de nombres en `geo_alias` si la app los nombra distinto, y activarlo.

create table public.geo_paises (
  codigo text primary key check (codigo ~ '^[A-Z]{2}$'),            -- ISO 3166-1 alfa-2
  nombre text not null unique,
  nivel1_nombre text not null,                                      -- cómo se llama el primer nivel allí: «Departamento», «Provincia»
  nivel2_nombre text not null,                                      -- «Municipio», «Cantón»
  moneda_defecto text not null check (moneda_defecto ~ '^[A-Z]{3}$'), -- ISO 4217
  zona_horaria text not null,
  fuente text not null,                                             -- organismo y catálogo de donde salen los códigos
  activo boolean not null default false                             -- solo los activos se ofrecen al crear una finca
);

create table public.geo_divisiones (
  pais text not null references public.geo_paises (codigo),
  codigo text not null,
  nivel smallint not null check (nivel between 1 and 3),
  padre_codigo text,
  nombre text not null,
  tipo text,                                                        -- p. ej. «Municipio», «Área no municipalizada», «Isla»
  primary key (pais, codigo),
  foreign key (pais, padre_codigo) references public.geo_divisiones (pais, codigo),
  check ((nivel = 1) = (padre_codigo is null))
);
create index geo_divisiones_padre_idx on public.geo_divisiones (pais, padre_codigo);

-- Nombres que la app usa y que el catálogo oficial escribe distinto. `alias` va ya normalizado (sin tildes, minúsculas, solo letras y números).
create table public.geo_alias (
  pais text not null,
  codigo text not null,
  alias text not null,
  primary key (pais, codigo, alias),
  foreign key (pais, codigo) references public.geo_divisiones (pais, codigo)
);

comment on table public.geo_paises is 'Países que Apriscol conoce: cómo se llaman sus dos primeros niveles, su moneda y su zona horaria. Solo los activos se ofrecen. Catálogo global de solo lectura.';
comment on table public.geo_divisiones is 'División político-administrativa oficial de cada país (DIVIPOLA en Colombia, DPA del INEC en Ecuador) con los códigos del organismo estadístico. Catálogo global de solo lectura.';
comment on table public.geo_alias is 'Equivalencias de nombres entre lo que ofrece la app y el catálogo oficial. Catálogo global de solo lectura.';

alter table public.geo_paises enable row level security;
alter table public.geo_divisiones enable row level security;
alter table public.geo_alias enable row level security;
create policy geo_paises_select on public.geo_paises for select to authenticated using (true);
create policy geo_divisiones_select on public.geo_divisiones for select to authenticated using (true);
create policy geo_alias_select on public.geo_alias for select to authenticated using (true);
revoke all on public.geo_paises, public.geo_divisiones, public.geo_alias from public, anon, authenticated;
grant select on public.geo_paises, public.geo_divisiones, public.geo_alias to authenticated;

-- Colombia (activa) y Ecuador (conocido pero sin activar: todavía no tiene sus divisiones cargadas).
insert into public.geo_paises (codigo, nombre, nivel1_nombre, nivel2_nombre, moneda_defecto, zona_horaria, fuente, activo) values
  ('CO', 'Colombia', 'Departamento', 'Municipio', 'COP', 'America/Bogota', 'DANE - DIVIPOLA', true),
  ('EC', 'Ecuador', 'Provincia', 'Cantón', 'USD', 'America/Guayaquil', 'INEC - Clasificador geográfico estadístico DPA', false);

insert into public.geo_divisiones (pais, codigo, nivel, padre_codigo, nombre, tipo)
select 'CO', codigo, 1, null, nombre, null from public.divipola_departamentos;
insert into public.geo_divisiones (pais, codigo, nivel, padre_codigo, nombre, tipo)
select 'CO', codigo, 2, departamento_codigo, nombre, tipo from public.divipola_municipios;

insert into public.geo_alias (pais, codigo, alias) values
  ('CO', '05150', 'carolinadelprincipe'),
  ('CO', '05541', 'elpenol'),
  ('CO', '05607', 'elretiro'),
  ('CO', '11001', 'bogota'),
  ('CO', '13468', 'mompos'),
  ('CO', '15332', 'guican'),
  ('CO', '19548', 'piendamo'),
  ('CO', '19760', 'sotara'),
  ('CO', '23586', 'purisima'),
  ('CO', '25843', 'ubate'),
  ('CO', '94888', 'morichalnuevo'),
  ('CO', '52427', 'maguipayan'),
  ('CO', '52019', 'sanjosedealban'),
  ('CO', '52835', 'tumaco'),
  ('CO', '54001', 'cucuta'),
  ('CO', '54398', 'laplayadebelen'),
  ('CO', '54660', 'salazardelaspalmas'),
  ('CO', '54743', 'santodomingodesilos'),
  ('CO', '88564', 'providenciaysantacatalina'),
  ('CO', '70742', 'since'),
  ('CO', '70820', 'tolu'),
  ('CO', '70823', 'toluviejo'),
  ('CO', '73443', 'mariquita'),
  ('CO', '76111', 'buga'),
  ('CO', '76001', 'cali'),
  ('CO', '11', 'bogota'),
  ('CO', '88', 'sanandresyprovidencia'),
  ('CO', '88', 'sanandres');

-- El país de cada finca (y de cada feria) y sus códigos por nivel. Las columnas `departamento_dane`/`municipio_dane` siguen existiendo
-- (Colombia) y se quitarán cuando todo lea las nuevas.
alter table public.fincas
  add column pais text not null default 'CO' references public.geo_paises (codigo),
  add column nivel1_codigo text,
  add column nivel2_codigo text,
  add constraint fincas_nivel1_fkey foreign key (pais, nivel1_codigo) references public.geo_divisiones (pais, codigo),
  add constraint fincas_nivel2_fkey foreign key (pais, nivel2_codigo) references public.geo_divisiones (pais, codigo),
  add constraint fincas_nivel2_en_nivel1 check (nivel2_codigo is null or (nivel1_codigo is not null and left(nivel2_codigo, length(nivel1_codigo)) = nivel1_codigo));

alter table public.ferias
  add column pais text not null default 'CO' references public.geo_paises (codigo),
  add column nivel1_codigo text,
  add column nivel2_codigo text,
  add constraint ferias_nivel1_fkey foreign key (pais, nivel1_codigo) references public.geo_divisiones (pais, codigo),
  add constraint ferias_nivel2_fkey foreign key (pais, nivel2_codigo) references public.geo_divisiones (pais, codigo),
  add constraint ferias_nivel2_en_nivel1 check (nivel2_codigo is null or (nivel1_codigo is not null and left(nivel2_codigo, length(nivel1_codigo)) = nivel1_codigo));

create index fincas_pais_nivel1_idx on public.fincas (pais, nivel1_codigo);
create index fincas_pais_nivel2_idx on public.fincas (pais, nivel2_codigo);
create index ferias_pais_nivel1_idx on public.ferias (pais, nivel1_codigo);
create index ferias_pais_nivel2_idx on public.ferias (pais, nivel2_codigo);

update public.fincas set nivel1_codigo = departamento_dane, nivel2_codigo = municipio_dane where departamento_dane is not null;
update public.ferias set nivel1_codigo = departamento_dane, nivel2_codigo = municipio_dane where departamento_dane is not null;

-- Normaliza un nombre para compararlo: sin tildes, en minúsculas y solo letras y números.
create function public.geo_normalizar(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(translate(coalesce(p_texto, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g'), '')
$$;

-- Traduce el nombre del primer y del segundo nivel (como los ofrece la app) a los códigos oficiales del país. Si no hay coincidencia
-- devuelve null: nunca adivina.
create function public.geo_codigos(p_pais text, p_nivel1 text, p_nivel2 text)
returns table (nivel1_codigo text, nivel2_codigo text)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (
    select public.geo_normalizar(p_nivel1) as n1, public.geo_normalizar(p_nivel2) as n2
  ),
  d as (
    select g.codigo
    from n, public.geo_divisiones g
    where g.pais = p_pais and g.nivel = 1 and n.n1 is not null
      and (public.geo_normalizar(g.nombre) = n.n1
           or exists (select 1 from public.geo_alias a where a.pais = g.pais and a.codigo = g.codigo and a.alias = n.n1))
    limit 1
  ),
  m as (
    select g.codigo
    from n, d, public.geo_divisiones g
    where g.pais = p_pais and g.nivel = 2 and g.padre_codigo = d.codigo and n.n2 is not null
      and (public.geo_normalizar(g.nombre) = n.n2
           or exists (select 1 from public.geo_alias a where a.pais = g.pais and a.codigo = g.codigo and a.alias = n.n2))
    limit 1
  )
  select (select codigo from d), (select codigo from m)
$$;

revoke all on function public.geo_normalizar(text), public.geo_codigos(text, text, text) from public, anon;
grant execute on function public.geo_normalizar(text), public.geo_codigos(text, text, text) to authenticated;

-- `divipola_codigos` (Colombia) sigue existiendo para el código que ya está desplegado: ahora delega en la general.
create or replace function public.divipola_codigos(p_departamento text, p_municipio text)
returns table (departamento_dane text, municipio_dane text)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.nivel1_codigo, c.nivel2_codigo from public.geo_codigos('CO', p_departamento, p_municipio) c
$$;
