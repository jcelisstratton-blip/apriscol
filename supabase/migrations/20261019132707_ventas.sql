-- Ventas: lo que entra a la finca, separado de lo que sale.
--  · ventas: lo que se vende y no tiene otro módulo (carne en canal o en cortes, queso, abono, lana, pieles…). Se elige el producto del catálogo
--    (con su unidad y su último precio), quién compró, y si ya se cobró o queda por cobrar.
--  · La leche despachada (Leche → Despachos) y los animales vendidos o sacrificados (su baja) YA son ventas: no se vuelven a digitar. Las funciones
--    `ventas_*` las suman con su origen, igual que los costos suman gastos, sanidad y ceba.
-- Módulo «contabilidad» (propietario, administrador y contador). Todas las funciones validan quién llama.

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  fecha date not null,
  producto_id uuid not null,
  cantidad numeric(12, 2) not null check (cantidad > 0 and cantidad <= 9999999999),
  unidad text check (unidad is null or char_length(btrim(unidad)) between 1 and 20),
  precio_unitario numeric(14, 2) not null check (precio_unitario >= 0 and precio_unitario <= 100000000000),
  valor_total numeric(14, 2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  tercero_id uuid,
  -- Cobro: sin `cobrado_en` la venta está por cobrar; `cobro_vence` es cuándo se espera el pago.
  cobrado_en date,
  cobro_vence date,
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ventas_producto_fk foreign key (producto_id, finca_id) references public.finca_productos (id, finca_id) on delete restrict,
  constraint ventas_tercero_fk foreign key (tercero_id, finca_id) references public.finca_terceros (id, finca_id) on delete restrict,
  constraint ventas_cobro_ck check (cobrado_en is null or cobrado_en >= fecha)
);
create index ventas_finca_fecha_idx on public.ventas (finca_id, fecha desc, created_at desc);
create index ventas_por_cobrar_idx on public.ventas (finca_id, cobro_vence) where cobrado_en is null;
create unique index ventas_client_req_uk on public.ventas (finca_id, client_request_id) where client_request_id is not null;
create trigger ventas_updated_at before update on public.ventas for each row execute function private.set_updated_at();
select private.crear_politicas_finca('ventas', 'contabilidad');
revoke all on public.ventas from anon;
grant select, insert, update, delete on public.ventas to authenticated;

-- Todo lo que se vendió: las ventas registradas, la leche despachada con precio y los animales vendidos o sacrificados con valor.
-- `origen_id` es el id de la venta o del despacho; para un animal es el id del animal (a su ficha se llega desde ahí).
create function private.ventas_base(p_finca uuid, p_desde date, p_hasta date)
returns table (origen text, origen_id uuid, fecha date, linea text, producto text, cantidad numeric, unidad text, valor numeric, tercero text, cobrado boolean, cobro_vence date)
language sql stable security definer set search_path = ''
as $$
  select 'venta'::text, v.id, v.fecha, p.linea, p.nombre, v.cantidad, coalesce(v.unidad, p.unidad), v.valor_total, t.nombre, v.cobrado_en is not null, v.cobro_vence
    from public.ventas v
    join public.finca_productos p on p.id = v.producto_id and p.finca_id = v.finca_id
    left join public.finca_terceros t on t.id = v.tercero_id and t.finca_id = v.finca_id
   where v.finca_id = p_finca and (p_desde is null or v.fecha >= p_desde) and (p_hasta is null or v.fecha <= p_hasta)
  union all
  select 'leche'::text, d.id, d.fecha, 'leche'::text, 'Leche'::text, d.litros, 'litros'::text, d.valor_total, coalesce(t.nombre, d.comprador), d.cobrado_en is not null, d.cobro_vence
    from public.despachos_leche d
    left join public.finca_terceros t on t.id = d.tercero_id and t.finca_id = d.finca_id
   where d.finca_id = p_finca and d.valor_total is not null and d.valor_total > 0 and (p_desde is null or d.fecha >= p_desde) and (p_hasta is null or d.fecha <= p_hasta)
  union all
  select 'animal'::text, x.animal_id, x.fecha, case when x.tipo = 'venta' then 'animales' else 'carne' end,
         case when x.tipo = 'venta' then 'Animal en pie' else 'Animal sacrificado' end || ' · ' || a.numero_arete, 1::numeric, 'animales'::text, x.valor,
         coalesce(t.nombre, x.comprador), x.cobrado_en is not null, x.cobro_vence
    from public.bajas x
    join public.animales a on a.id = x.animal_id and a.finca_id = x.finca_id
    left join public.finca_terceros t on t.id = x.tercero_id and t.finca_id = x.finca_id
   where x.finca_id = p_finca and x.tipo in ('venta', 'sacrificio') and x.valor is not null and x.valor > 0
     and (p_desde is null or x.fecha >= p_desde) and (p_hasta is null or x.fecha <= p_hasta);
$$;
revoke all on function private.ventas_base(uuid, date, date) from public, anon, authenticated;

-- Las ventas del periodo, lo más reciente primero, con el total de filas del filtro para paginar. `p_linea` filtra por línea de ingreso.
create function public.ventas_pagina(p_finca uuid, p_desde date, p_hasta date, p_linea text default null, p_limite integer default 20, p_salto integer default 0)
returns table (origen text, origen_id uuid, fecha date, linea text, producto text, cantidad numeric, unidad text, valor numeric, tercero text, cobrado boolean, cobro_vence date, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with f as (select b.*, count(*) over () as total from private.ventas_base(p_finca, p_desde, p_hasta) b where p_linea is null or b.linea = p_linea)
    select f.origen, f.origen_id, f.fecha, f.linea, f.producto, f.cantidad, f.unidad, f.valor, f.tercero, f.cobrado, f.cobro_vence, f.total
      from f order by f.fecha desc, f.origen, f.origen_id
     limit least(greatest(p_limite, 1), 200) offset greatest(p_salto, 0);
end;
$$;

-- Todas las ventas del filtro (para el Excel).
create function public.ventas_detalle(p_finca uuid, p_desde date, p_hasta date, p_linea text default null)
returns table (origen text, origen_id uuid, fecha date, linea text, producto text, cantidad numeric, unidad text, valor numeric, tercero text, cobrado boolean, cobro_vence date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query select b.* from private.ventas_base(p_finca, p_desde, p_hasta) b where p_linea is null or b.linea = p_linea order by b.fecha desc, b.origen, b.origen_id limit 5000;
end;
$$;

-- Cuánto se vendió en cada línea y cuánto de eso falta por cobrar.
create function public.ventas_por_linea(p_finca uuid, p_desde date, p_hasta date)
returns table (linea text, total numeric, por_cobrar numeric, vencido numeric, movimientos integer)
language plpgsql stable security definer set search_path = ''
as $$
declare v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  perform private.costos_permiso(p_finca);
  return query
    select b.linea, sum(b.valor), coalesce(sum(b.valor) filter (where not b.cobrado), 0),
           coalesce(sum(b.valor) filter (where not b.cobrado and b.cobro_vence is not null and b.cobro_vence < v_hoy), 0), count(*)::integer
      from private.ventas_base(p_finca, p_desde, p_hasta) b
     group by b.linea order by sum(b.valor) desc;
end;
$$;

-- Marcar una venta como cobrada (en la fecha dada) o devolverla a «por cobrar» (fecha nula). Funciona para los tres orígenes: quien lleva las
-- cuentas no necesita permiso sobre Leche ni sobre el Hato para registrar un cobro.
create function public.marcar_cobro_venta(p_finca uuid, p_origen text, p_id uuid, p_fecha date) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_fecha date;
begin
  if not private.puede_escribir(p_finca, 'contabilidad') then
    raise exception 'No tienes permiso para registrar cobros en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_fecha is not null and p_fecha > (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha de cobro no puede ser futura.' using errcode = 'check_violation';
  end if;
  if p_origen = 'venta' then
    select fecha into v_fecha from public.ventas where id = p_id and finca_id = p_finca;
  elsif p_origen = 'leche' then
    select fecha into v_fecha from public.despachos_leche where id = p_id and finca_id = p_finca;
  elsif p_origen = 'animal' then
    select fecha into v_fecha from public.bajas where animal_id = p_id and finca_id = p_finca and tipo in ('venta', 'sacrificio');
  else
    raise exception 'Ese tipo de venta no existe.' using errcode = 'invalid_parameter_value';
  end if;
  if v_fecha is null then
    raise exception 'No encontramos esa venta.' using errcode = 'no_data_found';
  end if;
  if p_fecha is not null and p_fecha < v_fecha then
    raise exception 'No se puede cobrar antes de la fecha de la venta.' using errcode = 'check_violation';
  end if;
  if p_origen = 'venta' then
    update public.ventas set cobrado_en = p_fecha where id = p_id and finca_id = p_finca;
  elsif p_origen = 'leche' then
    update public.despachos_leche set cobrado_en = p_fecha where id = p_id and finca_id = p_finca;
  else
    update public.bajas set cobrado_en = p_fecha where animal_id = p_id and finca_id = p_finca and tipo in ('venta', 'sacrificio');
  end if;
end;
$$;

revoke execute on function public.ventas_pagina(uuid, date, date, text, integer, integer), public.ventas_detalle(uuid, date, date, text),
  public.ventas_por_linea(uuid, date, date), public.marcar_cobro_venta(uuid, text, uuid, date) from public, anon;
grant execute on function public.ventas_pagina(uuid, date, date, text, integer, integer), public.ventas_detalle(uuid, date, date, text),
  public.ventas_por_linea(uuid, date, date), public.marcar_cobro_venta(uuid, text, uuid, date) to authenticated;
