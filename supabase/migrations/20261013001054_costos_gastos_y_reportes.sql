-- Costos y gastos del aprisco (documento «Componentes de gastos del aprisco»). Módulo «contabilidad» (propietario, administrador y contador).
--  · gastos: cada egreso con su rubro, proveedor, monto y a quién se carga (toda la finca, una especie, un corral o potrero, un lote de ceba
--    o un animal), con su fecha de pago o de vencimiento y su soporte. Lo que ya se registra en Sanidad (costo de cada tratamiento) y en Ceba
--    (costo del alimento de cada lote) NO se vuelve a digitar: las funciones de reporte lo suman con su origen.
--  · animales.valor_compra: lo que costó el animal, para medir la pérdida por saca y por mortalidad.
--  · costos_*: funciones de reporte (SECURITY DEFINER: un contador no ve Sanidad ni Ceba, pero sí sus costos). Todas validan quién llama.

alter table public.animales add column valor_compra numeric(14, 0) check (valor_compra is null or valor_compra >= 0);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  fecha date not null,
  rubro text not null check (rubro in (
    'concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada',
    'vacunas_desparasitantes', 'tratamientos', 'pruebas_laboratorio', 'podologia', 'bioseguridad',
    'material_reproductivo', 'asistencia_veterinaria',
    'identificacion', 'fletes',
    'mano_obra', 'arriendo', 'servicios_publicos', 'combustible', 'mantenimiento', 'otros')),
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 160),
  proveedor text check (proveedor is null or char_length(btrim(proveedor)) between 1 and 120),
  cantidad numeric(12, 2) check (cantidad is null or cantidad > 0),
  unidad text check (unidad is null or char_length(btrim(unidad)) between 1 and 20),
  monto numeric(14, 2) not null check (monto > 0 and monto <= 100000000000),
  -- A quién se carga el gasto.
  destino_tipo text not null default 'finca' check (destino_tipo in ('finca', 'especie', 'ubicacion', 'lote', 'animal')),
  especie text check (especie is null or especie in ('caprino', 'ovino')),
  ubicacion_id uuid,
  lote_id uuid,
  animal_id uuid,
  -- Pago: sin `pagado_en` el gasto está por pagar; `vence` es cuándo hay que pagarlo.
  vence date,
  pagado_en date,
  soporte_path text,
  observaciones text check (observaciones is null or char_length(observaciones) <= 1000),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gastos_destino_ck check (
    (destino_tipo = 'finca' and especie is null and ubicacion_id is null and lote_id is null and animal_id is null)
    or (destino_tipo = 'especie' and especie is not null and ubicacion_id is null and lote_id is null and animal_id is null)
    or (destino_tipo = 'ubicacion' and ubicacion_id is not null and especie is null and lote_id is null and animal_id is null)
    or (destino_tipo = 'lote' and lote_id is not null and especie is null and ubicacion_id is null and animal_id is null)
    or (destino_tipo = 'animal' and animal_id is not null and especie is null and ubicacion_id is null and lote_id is null)),
  constraint gastos_ubicacion_fk foreign key (ubicacion_id, finca_id) references public.ubicaciones (id, finca_id) on delete restrict,
  constraint gastos_lote_fk foreign key (lote_id, finca_id) references public.lotes_ceba (id, finca_id) on delete restrict,
  constraint gastos_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete restrict
);
create index gastos_finca_fecha_idx on public.gastos (finca_id, fecha desc, created_at desc);
create index gastos_por_pagar_idx on public.gastos (finca_id, vence) where pagado_en is null;
create index gastos_animal_idx on public.gastos (animal_id) where animal_id is not null;
create unique index gastos_client_req_uk on public.gastos (finca_id, client_request_id) where client_request_id is not null;
create trigger gastos_updated_at before update on public.gastos for each row execute function private.set_updated_at();
select private.crear_politicas_finca('gastos', 'contabilidad');
revoke all on public.gastos from anon;
grant select, insert, update, delete on public.gastos to authenticated;

-- Todo lo que cuesta: los gastos, el costo de cada tratamiento sanitario y el costo del alimento de cada lote de ceba.
create function private.costos_base(p_finca uuid, p_desde date, p_hasta date)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date)
language sql stable security definer set search_path = ''
as $$
  select 'gasto'::text, g.id, g.fecha, g.rubro, g.descripcion, g.proveedor, g.monto, g.destino_tipo, g.especie, g.ubicacion_id, g.lote_id, g.animal_id,
         g.pagado_en is not null, g.vence
    from public.gastos g
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
   where c.finca_id = p_finca and c.costo is not null and c.costo > 0 and (p_desde is null or c.fecha >= p_desde) and (p_hasta is null or c.fecha <= p_hasta);
$$;
revoke all on function private.costos_base(uuid, date, date) from public, anon, authenticated;

create function private.costos_permiso(p_finca uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.puede_ver(p_finca, 'contabilidad') then
    raise exception 'No tienes permiso para ver los costos de esta finca.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;
revoke all on function private.costos_permiso(uuid) from public, anon, authenticated;

-- El detalle de todo lo que cuesta, lo más reciente primero (para listarlo y para el Excel). `p_rubro` filtra por un rubro.
create function public.costos_detalle(p_finca uuid, p_desde date, p_hasta date, p_rubro text default null, p_limite integer default 1000, p_salto integer default 0)
returns table (origen text, origen_id uuid, fecha date, rubro text, descripcion text, proveedor text, monto numeric, destino_tipo text,
               especie text, ubicacion_id uuid, lote_id uuid, animal_id uuid, pagado boolean, vence date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    select b.* from private.costos_base(p_finca, p_desde, p_hasta) b
     where p_rubro is null or b.rubro = p_rubro
     order by b.fecha desc, b.origen, b.origen_id
     limit least(greatest(p_limite, 1), 5000) offset greatest(p_salto, 0);
end;
$$;

-- Cuánto se gastó en cada rubro, cuánto de eso sigue por pagar y de dónde viene (gastos, sanidad, ceba).
create function public.costos_por_rubro(p_finca uuid, p_desde date, p_hasta date)
returns table (rubro text, total numeric, por_pagar numeric, de_gastos numeric, de_sanidad numeric, de_ceba numeric, movimientos integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    select b.rubro, sum(b.monto), coalesce(sum(b.monto) filter (where not b.pagado), 0),
           coalesce(sum(b.monto) filter (where b.origen = 'gasto'), 0), coalesce(sum(b.monto) filter (where b.origen = 'sanidad'), 0),
           coalesce(sum(b.monto) filter (where b.origen = 'ceba'), 0), count(*)::integer
      from private.costos_base(p_finca, p_desde, p_hasta) b
     group by b.rubro
     order by sum(b.monto) desc;
end;
$$;

-- Mes a mes: lo que se gastó, lo que entró (leche despachada y animales vendidos) y los litros producidos.
create function public.costos_por_mes(p_finca uuid, p_desde date, p_hasta date)
returns table (mes date, costos numeric, ingresos_leche numeric, ingresos_animales numeric, litros numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with c as (select date_trunc('month', b.fecha)::date as mes, sum(b.monto) as v from private.costos_base(p_finca, p_desde, p_hasta) b group by 1),
    l as (select date_trunc('month', d.fecha)::date as mes, sum(coalesce(d.valor_total, 0)) as v from public.despachos_leche d
           where d.finca_id = p_finca and (p_desde is null or d.fecha >= p_desde) and (p_hasta is null or d.fecha <= p_hasta) group by 1),
    v as (select date_trunc('month', x.fecha)::date as mes, sum(coalesce(x.valor, 0)) as v from public.bajas x
           where x.finca_id = p_finca and x.tipo in ('venta', 'sacrificio') and (p_desde is null or x.fecha >= p_desde) and (p_hasta is null or x.fecha <= p_hasta) group by 1),
    q as (select date_trunc('month', pd.fecha)::date as mes, sum(coalesce(pd.litros_tanque, 0)) as v from public.v_produccion_diaria pd
           where pd.finca_id = p_finca and (p_desde is null or pd.fecha >= p_desde) and (p_hasta is null or pd.fecha <= p_hasta) group by 1),
    m as (select c.mes from c union select l.mes from l union select v.mes from v union select q.mes from q)
    select m.mes, coalesce(c.v, 0), coalesce(l.v, 0), coalesce(v.v, 0), coalesce(q.v, 0)
      from m left join c on c.mes = m.mes left join l on l.mes = m.mes left join v on v.mes = m.mes left join q on q.mes = m.mes
     order by m.mes;
end;
$$;

-- Las cifras de cabecera del periodo.
create function public.costos_indicadores(p_finca uuid, p_desde date, p_hasta date)
returns table (total_costos numeric, por_pagar numeric, vencido numeric, ingresos_leche numeric, ingresos_animales numeric, litros numeric, animales_activos integer)
language plpgsql stable security definer set search_path = ''
as $$
declare v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  perform private.costos_permiso(p_finca);
  return query
    select coalesce((select sum(b.monto) from private.costos_base(p_finca, p_desde, p_hasta) b), 0),
           coalesce((select sum(b.monto) from private.costos_base(p_finca, p_desde, p_hasta) b where not b.pagado), 0),
           coalesce((select sum(b.monto) from private.costos_base(p_finca, p_desde, p_hasta) b where not b.pagado and b.vence is not null and b.vence < v_hoy), 0),
           coalesce((select sum(coalesce(d.valor_total, 0)) from public.despachos_leche d where d.finca_id = p_finca and (p_desde is null or d.fecha >= p_desde) and (p_hasta is null or d.fecha <= p_hasta)), 0),
           coalesce((select sum(coalesce(x.valor, 0)) from public.bajas x where x.finca_id = p_finca and x.tipo in ('venta', 'sacrificio') and (p_desde is null or x.fecha >= p_desde) and (p_hasta is null or x.fecha <= p_hasta)), 0),
           coalesce((select sum(coalesce(pd.litros_tanque, 0)) from public.v_produccion_diaria pd where pd.finca_id = p_finca and (p_desde is null or pd.fecha >= p_desde) and (p_hasta is null or pd.fecha <= p_hasta)), 0),
           (select count(*)::integer from public.animales a where a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null);
end;
$$;

-- Cuánto costó cada animal en el periodo. Directo: gastos cargados al animal y su parte de cada tratamiento. Repartido: lo cargado a su lote, a su
-- corral (por los animales que estaban ahí ese día) o a su especie, en partes iguales. Lo cargado a toda la finca no se reparte.
create function public.costos_por_animal(p_finca uuid, p_desde date, p_hasta date)
returns table (animal_id uuid, numero_arete text, nombre text, especie text, sexo text, estado text, directo numeric, repartido numeric, total numeric, valor_compra numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with b as (select * from private.costos_base(p_finca, p_desde, p_hasta)),
    dir as (
      select x.animal_id as aid, x.monto as m from b x where x.destino_tipo = 'animal'
      union all
      select ea.animal_id, x.monto / n.n
        from b x
        join public.evento_sanitario_animales ea on ea.evento_id = x.origen_id and ea.finca_id = p_finca
        join lateral (select count(*)::numeric as n from public.evento_sanitario_animales y where y.evento_id = x.origen_id and y.finca_id = p_finca) n on true
       where x.destino_tipo = 'evento'
    ),
    rep as (
      select a.id as aid, x.monto / n.n as m
        from b x
        join public.animales a on a.lote_ceba_id = x.lote_id and a.finca_id = p_finca and a.deleted_at is null
        join lateral (select count(*)::numeric as n from public.animales y where y.lote_ceba_id = x.lote_id and y.finca_id = p_finca and y.deleted_at is null) n on true
       where x.destino_tipo = 'lote'
      union all
      select mv.animal_id, x.monto / n.n
        from b x
        join public.movimientos_animales mv on mv.ubicacion_id = x.ubicacion_id and mv.finca_id = p_finca and mv.desde <= x.fecha and (mv.hasta is null or mv.hasta >= x.fecha)
        join lateral (select count(distinct y.animal_id)::numeric as n from public.movimientos_animales y
                       where y.ubicacion_id = x.ubicacion_id and y.finca_id = p_finca and y.desde <= x.fecha and (y.hasta is null or y.hasta >= x.fecha)) n on true
       where x.destino_tipo = 'ubicacion'
      union all
      select a.id, x.monto / n.n
        from b x
        join public.animales a on a.finca_id = p_finca and a.especie = x.especie and a.deleted_at is null
             and (a.fecha_nacimiento is null or a.fecha_nacimiento <= x.fecha)
             and not exists (select 1 from public.bajas z where z.animal_id = a.id and z.fecha < x.fecha)
        join lateral (select count(*)::numeric as n from public.animales y
                       where y.finca_id = p_finca and y.especie = x.especie and y.deleted_at is null
                         and (y.fecha_nacimiento is null or y.fecha_nacimiento <= x.fecha)
                         and not exists (select 1 from public.bajas z where z.animal_id = y.id and z.fecha < x.fecha)) n on true
       where x.destino_tipo = 'especie'
    ),
    d as (select dir.aid, sum(dir.m) as m from dir group by dir.aid),
    r as (select rep.aid, sum(rep.m) as m from rep group by rep.aid)
    select a.id, a.numero_arete, a.nombre, a.especie, a.sexo, a.estado,
           round(coalesce(d.m, 0), 2), round(coalesce(r.m, 0), 2), round(coalesce(d.m, 0) + coalesce(r.m, 0), 2), a.valor_compra
      from public.animales a
      left join d on d.aid = a.id
      left join r on r.aid = a.id
     where a.finca_id = p_finca and (d.m is not null or r.m is not null)
     order by coalesce(d.m, 0) + coalesce(r.m, 0) desc, a.numero_arete;
end;
$$;

-- Pérdida por saca (animales descartados y vendidos por debajo de lo que costaron) y por mortalidad (animales muertos o perdidos).
-- Solo cuenta los animales con valor de compra; `con_valor` dice cuántos tienen el dato para que la cifra esté completa.
create function public.costos_depreciacion(p_finca uuid, p_desde date, p_hasta date)
returns table (tipo text, animales integer, con_valor integer, perdida numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    select 'saca'::text, count(*)::integer, count(*) filter (where a.valor_compra is not null and x.valor is not null)::integer,
           coalesce(sum(a.valor_compra - x.valor) filter (where a.valor_compra is not null and x.valor is not null), 0)
      from public.bajas x join public.animales a on a.id = x.animal_id and a.finca_id = x.finca_id
     where x.finca_id = p_finca and x.tipo in ('venta', 'sacrificio') and x.motivo in ('edad', 'partos', 'baja_produccion', 'sanidad', 'reproductivo')
       and (p_desde is null or x.fecha >= p_desde) and (p_hasta is null or x.fecha <= p_hasta)
    union all
    select 'mortalidad'::text, count(*)::integer, count(*) filter (where a.valor_compra is not null)::integer,
           coalesce(sum(a.valor_compra) filter (where a.valor_compra is not null), 0)
      from public.bajas x join public.animales a on a.id = x.animal_id and a.finca_id = x.finca_id
     where x.finca_id = p_finca and x.tipo in ('muerte', 'perdida')
       and (p_desde is null or x.fecha >= p_desde) and (p_hasta is null or x.fecha <= p_hasta);
end;
$$;

revoke execute on function public.costos_detalle(uuid, date, date, text, integer, integer), public.costos_por_rubro(uuid, date, date), public.costos_por_mes(uuid, date, date),
  public.costos_indicadores(uuid, date, date), public.costos_por_animal(uuid, date, date), public.costos_depreciacion(uuid, date, date) from public, anon;
grant execute on function public.costos_detalle(uuid, date, date, text, integer, integer), public.costos_por_rubro(uuid, date, date), public.costos_por_mes(uuid, date, date),
  public.costos_indicadores(uuid, date, date), public.costos_por_animal(uuid, date, date), public.costos_depreciacion(uuid, date, date) to authenticated;
