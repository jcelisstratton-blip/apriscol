-- Ubicación con código DANE en fincas y ferias.
-- Hasta hoy `departamento` y `municipio` se guardan solo como texto (el nombre que se elige en el formulario). Aquí se agregan,
-- ADEMÁS, sus códigos DIVIPOLA (`departamento_dane`, `municipio_dane`), para poder agrupar y reportar por departamento o municipio
-- sin depender de cómo esté escrito el nombre (hay 67 nombres de municipio repetidos en el país). Las columnas de texto no se tocan
-- (retrocompatible): el código se calcula a partir de ellas con `divipola_codigos` y la app lo guarda junto al nombre.

alter table public.fincas
  add column departamento_dane text references public.divipola_departamentos (codigo),
  add column municipio_dane text references public.divipola_municipios (codigo),
  add constraint fincas_municipio_en_departamento check (municipio_dane is null or (departamento_dane is not null and left(municipio_dane, 2) = departamento_dane));

alter table public.ferias
  add column departamento_dane text references public.divipola_departamentos (codigo),
  add column municipio_dane text references public.divipola_municipios (codigo),
  add constraint ferias_municipio_en_departamento check (municipio_dane is null or (departamento_dane is not null and left(municipio_dane, 2) = departamento_dane));

create index fincas_departamento_dane_idx on public.fincas (departamento_dane);
create index fincas_municipio_dane_idx on public.fincas (municipio_dane);
create index ferias_departamento_dane_idx on public.ferias (departamento_dane);
create index ferias_municipio_dane_idx on public.ferias (municipio_dane);

-- Traduce el nombre del departamento y del municipio (como los ofrece la app) a sus códigos DIVIPOLA. Compara sin tildes, sin
-- mayúsculas y sin signos. Los 25 municipios que la app nombra distinto al DANE (Cúcuta = San José de Cúcuta, Cali = Santiago de Cali…)
-- se resuelven con la tabla de equivalencias de abajo. Si no hay coincidencia devuelve null (nunca adivina).
create function public.divipola_codigos(p_departamento text, p_municipio text)
returns table (departamento_dane text, municipio_dane text)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (
    select
      nullif(regexp_replace(lower(translate(coalesce(p_departamento, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g'), '') as dep,
      nullif(regexp_replace(lower(translate(coalesce(p_municipio, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g'), '') as mun
  ),
  d as (
    select dd.codigo
    from n, public.divipola_departamentos dd
    where n.dep is not null
      and (regexp_replace(lower(translate(dd.nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g') = n.dep
           or (dd.codigo = '11' and n.dep like 'bogota%')
           or (dd.codigo = '88' and n.dep like 'sanandres%'))
    limit 1
  ),
  alias (dep, nombre, codigo) as (
    values
      ('05', 'carolinadelprincipe', '05150'),
      ('05', 'elpenol', '05541'),
      ('05', 'elretiro', '05607'),
      ('11', 'bogota', '11001'),
      ('13', 'mompos', '13468'),
      ('15', 'guican', '15332'),
      ('19', 'piendamo', '19548'),
      ('19', 'sotara', '19760'),
      ('23', 'purisima', '23586'),
      ('25', 'ubate', '25843'),
      ('94', 'morichalnuevo', '94888'),
      ('52', 'maguipayan', '52427'),
      ('52', 'sanjosedealban', '52019'),
      ('52', 'tumaco', '52835'),
      ('54', 'cucuta', '54001'),
      ('54', 'laplayadebelen', '54398'),
      ('54', 'salazardelaspalmas', '54660'),
      ('54', 'santodomingodesilos', '54743'),
      ('88', 'providenciaysantacatalina', '88564'),
      ('70', 'since', '70742'),
      ('70', 'tolu', '70820'),
      ('70', 'toluviejo', '70823'),
      ('73', 'mariquita', '73443'),
      ('76', 'buga', '76111'),
      ('76', 'cali', '76001')
  ),
  m as (
    select mm.codigo
    from n, d, public.divipola_municipios mm
    where n.mun is not null
      and mm.departamento_codigo = d.codigo
      and (regexp_replace(lower(translate(mm.nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g') = n.mun
           or exists (select 1 from alias a where a.codigo = mm.codigo and a.nombre = n.mun))
    limit 1
  )
  select (select codigo from d), (select codigo from m)
$$;

revoke all on function public.divipola_codigos(text, text) from public, anon;
grant execute on function public.divipola_codigos(text, text) to authenticated;

-- Las filas que ya existen: se calcula su código a partir del nombre que tienen.
update public.fincas f
set departamento_dane = (select c.departamento_dane from public.divipola_codigos(f.departamento, f.municipio) c),
    municipio_dane = (select c.municipio_dane from public.divipola_codigos(f.departamento, f.municipio) c)
where f.departamento is not null;

update public.ferias f
set departamento_dane = (select c.departamento_dane from public.divipola_codigos(f.departamento, f.municipio) c),
    municipio_dane = (select c.municipio_dane from public.divipola_codigos(f.departamento, f.municipio) c)
where f.departamento is not null;
