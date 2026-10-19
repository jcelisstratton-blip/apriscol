-- Nómina · Costos: cada pago al personal entra a costos_base como mano de obra, y el aviso de doble conteo también compara la nómina con las compras de mano de obra.

create or replace function private.costos_base(p_finca uuid, p_desde date, p_hasta date)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date)
language sql stable security definer set search_path = ''
as $$
  select 'gasto'::text, g.id, g.fecha, g.rubro, g.descripcion, coalesce(t.nombre, g.proveedor), g.monto, g.destino_tipo, g.especie, g.ubicacion_id, g.lote_id, g.animal_id,
         g.pagado_en is not null, g.vence
    from public.gastos g
    left join public.finca_terceros t on t.id = g.tercero_id and t.finca_id = g.finca_id
   where g.finca_id = p_finca and (p_desde is null or g.fecha >= p_desde) and (p_hasta is null or g.fecha <= p_hasta)
  union all
  select 'sanidad'::text, e.id, e.fecha,
         case when e.tipo in ('podologia', 'pediluvio') then 'podologia'
              when e.tipo in ('vacunacion', 'desparasitacion') then 'vacunas_desparasitantes'
              else 'tratamientos' end,
         coalesce(nullif(btrim(e.producto_nombre), ''), initcap(e.tipo)), null::text, e.costo, 'evento'::text, null::text, null::uuid, null::uuid, null::uuid, true, null::date
    from public.eventos_sanitarios e
   where e.finca_id = p_finca and e.costo is not null and e.costo > 0 and (p_desde is null or e.fecha >= p_desde) and (p_hasta is null or e.fecha <= p_hasta)
  union all
  select 'ceba'::text, c.id, c.fecha, 'concentrado', coalesce(nullif(btrim(c.alimento), ''), 'Alimento de ceba'), null::text, c.costo, 'lote'::text, null::text, null::uuid, c.lote_id, null::uuid, true, null::date
    from public.consumo_lote c
   where c.finca_id = p_finca and c.costo is not null and c.costo > 0 and (p_desde is null or c.fecha >= p_desde) and (p_hasta is null or c.fecha <= p_hasta)
  union all
  select 'compra'::text, c.id, c.fecha, 'compra_animales'::text, 'Compra de ' || c.numero_arete || coalesce(' · ' || c.nombre, ''), null::text, c.valor_compra, 'adquisicion'::text,
         null::text, null::uuid, null::uuid, c.id, true, null::date
    from (select a.id, a.numero_arete, a.nombre, a.valor_compra, coalesce(a.fecha_compra, (a.created_at at time zone 'America/Bogota')::date) as fecha
            from public.animales a
           where a.finca_id = p_finca and a.origen = 'comprado' and a.valor_compra is not null and a.valor_compra > 0 and a.deleted_at is null) c
   where (p_desde is null or c.fecha >= p_desde) and (p_hasta is null or c.fecha <= p_hasta)
  union all
  -- Cada pago al personal, por lo que le cuesta a la finca (con el factor prestacional si es contrato laboral). Es un costo general de la finca.
  select 'nomina'::text, n.id, n.fecha, 'mano_obra'::text, per.nombre || coalesce(' · ' || per.cargo, ''), per.nombre, n.costo_total, 'finca'::text,
         null::text, null::uuid, null::uuid, null::uuid, n.pagado_en is not null, null::date
    from public.pagos_personal n
    join public.personal per on per.id = n.personal_id and per.finca_id = n.finca_id
   where n.finca_id = p_finca and n.costo_total > 0 and (p_desde is null or n.fecha >= p_desde) and (p_hasta is null or n.fecha <= p_hasta);
$$;
revoke all on function private.costos_base(uuid, date, date) from public, anon, authenticated;

-- Ahora también avisa cuando la mano de obra entra por dos caminos: como compra (registros anteriores a la nómina) y como pago al personal.
create or replace function public.costos_posible_doble_conteo(p_finca uuid, p_desde date, p_hasta date)
returns table (rubro text, compras numeric, consumo numeric, origen_consumo text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with b as (select * from private.costos_base(p_finca, p_desde, p_hasta)),
    g as (select x.rubro, sum(x.monto) as m from b x where x.origen = 'gasto' group by x.rubro),
    c as (select x.rubro, x.origen, sum(x.monto) as m from b x where x.origen in ('sanidad', 'ceba', 'nomina') group by x.rubro, x.origen)
    select g.rubro, g.m, c.m, c.origen from g join c on c.rubro = g.rubro order by g.m desc;
end;
$$;
