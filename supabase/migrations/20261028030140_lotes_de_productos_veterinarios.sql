-- Lotes de los productos veterinarios: los registra quien compra (propietario o administrador) y los elige quien aplica (veterinario).
-- La compra de un medicamento o vacuna guarda de qué producto veterinario es, su lote y cuándo vence. Columnas nuevas y opcionales: retrocompatible.
alter table public.gastos
  add column producto_vet_id uuid,
  add column lote_producto text,
  add column lote_vencimiento date,
  add constraint gastos_lote_producto_largo check (lote_producto is null or char_length(lote_producto) between 1 and 60),
  add constraint gastos_producto_vet_fk foreign key (producto_vet_id, finca_id) references public.productos_veterinarios (id, finca_id) on delete set null (producto_vet_id);

create index gastos_producto_vet_idx on public.gastos (finca_id, producto_vet_id, fecha desc) where lote_producto is not null;

-- Los lotes que el veterinario puede elegir. Quien aplica no ve las compras (precios, proveedores): solo recibe el lote, su vencimiento y cuándo se compró.
-- Se omiten los lotes vencidos: no se debe aplicar un producto vencido.
create or replace function public.lotes_sanidad(p_finca uuid)
returns table (gasto_id uuid, producto_id uuid, lote text, vencimiento date, comprado date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.puede_ver(p_finca, 'sanidad') then
    raise exception 'No tienes permiso para ver la sanidad de esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select g.id, g.producto_vet_id, g.lote_producto, g.lote_vencimiento, g.fecha
      from public.gastos g
     where g.finca_id = p_finca and g.producto_vet_id is not null and g.lote_producto is not null
       and (g.lote_vencimiento is null or g.lote_vencimiento >= (now() at time zone 'America/Bogota')::date)
     order by g.fecha desc, g.created_at desc
     limit 1000;
end
$$;
revoke execute on function public.lotes_sanidad(uuid) from public, anon;
grant execute on function public.lotes_sanidad(uuid) to authenticated;
