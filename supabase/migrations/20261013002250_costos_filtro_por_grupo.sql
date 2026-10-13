-- Costos: el filtro de rubro de costos_detalle y costos_pagina también acepta un grupo completo («grupo:alimentacion»).
create function private.grupo_rubro(p_rubro text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_rubro in ('concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada') then 'alimentacion'
    when p_rubro in ('vacunas_desparasitantes', 'tratamientos', 'pruebas_laboratorio', 'podologia', 'bioseguridad') then 'sanidad'
    when p_rubro in ('material_reproductivo', 'asistencia_veterinaria') then 'reproduccion'
    when p_rubro in ('identificacion', 'fletes') then 'logistica'
    else 'operacion'
  end;
$$;

create or replace function public.costos_detalle(p_finca uuid, p_desde date, p_hasta date, p_rubro text default null, p_limite integer default 1000, p_salto integer default 0)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    select b.* from private.costos_base(p_finca, p_desde, p_hasta) b
     where p_rubro is null or b.rubro = p_rubro or ('grupo:' || private.grupo_rubro(b.rubro)) = p_rubro
     order by b.fecha desc, b.origen, b.origen_id
     limit least(greatest(p_limite, 1), 5000) offset greatest(p_salto, 0);
end;
$$;

create or replace function public.costos_pagina(p_finca uuid, p_desde date, p_hasta date, p_rubro text default null, p_limite integer default 20, p_salto integer default 0)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with f as (select b.*, count(*) over () as total from private.costos_base(p_finca, p_desde, p_hasta) b
                where p_rubro is null or b.rubro = p_rubro or ('grupo:' || private.grupo_rubro(b.rubro)) = p_rubro)
    select f.origen, f.origen_id, f.fecha, f.rubro, f.descripcion, f.proveedor, f.monto, f.destino_tipo, f.especie, f.ubicacion_id, f.lote_id, f.animal_id, f.pagado, f.vence, f.total
      from f
     order by f.fecha desc, f.origen, f.origen_id
     limit least(greatest(p_limite, 1), 200) offset greatest(p_salto, 0);
end;
$$;
