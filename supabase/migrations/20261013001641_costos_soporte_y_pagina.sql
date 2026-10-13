-- Costos: (1) la carpeta «gastos» del bucket de soportes (facturas) pertenece al módulo contabilidad; (2) costos_pagina lista el detalle y devuelve también
-- el total de filas del filtro, para paginar con «Mostrando X de N».
create or replace function private.modulo_soporte(p_ruta text)
returns public.modulo_app
language sql immutable set search_path = ''
as $$
  select case (storage.foldername(p_ruta))[2]
    when 'calidad' then 'leche'::public.modulo_app
    when 'carne' then 'carne'::public.modulo_app
    when 'sanidad' then 'sanidad'::public.modulo_app
    when 'gastos' then 'contabilidad'::public.modulo_app
  end;
$$;

create function public.costos_pagina(p_finca uuid, p_desde date, p_hasta date, p_rubro text default null, p_limite integer default 20, p_salto integer default 0)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with f as (select b.*, count(*) over () as total from private.costos_base(p_finca, p_desde, p_hasta) b where p_rubro is null or b.rubro = p_rubro)
    select f.origen, f.origen_id, f.fecha, f.rubro, f.descripcion, f.proveedor, f.monto, f.destino_tipo, f.especie, f.ubicacion_id, f.lote_id, f.animal_id, f.pagado, f.vence, f.total
      from f
     order by f.fecha desc, f.origen, f.origen_id
     limit least(greatest(p_limite, 1), 200) offset greatest(p_salto, 0);
end;
$$;
revoke execute on function public.costos_pagina(uuid, date, date, text, integer, integer) from public, anon;
grant execute on function public.costos_pagina(uuid, date, date, text, integer, integer) to authenticated;
