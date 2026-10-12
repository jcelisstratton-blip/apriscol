-- Documentos de respaldo (resultados de laboratorio, actas de inspección) y controles de calidad con constancia.
-- Los análisis son decisión del propietario; lo que no se hace queda declarado en `controles_calidad` (estado «no_realizado»).

-- ───────────────────────── Storage: bucket «soportes» ─────────────────────────
-- Ruta: <finca_id>/<calidad|carne|sanidad>/<uuid>.<pdf|jpg|png|webp>. El servidor arma el nombre; el módulo sale de la carpeta.
create function private.modulo_soporte(p_ruta text)
returns public.modulo_app
language sql immutable set search_path = ''
as $$
  select case (storage.foldername(p_ruta))[2]
    when 'calidad' then 'leche'::public.modulo_app
    when 'carne' then 'carne'::public.modulo_app
    when 'sanidad' then 'sanidad'::public.modulo_app
  end;
$$;

create policy soportes_ver on storage.objects for select to authenticated
  using (bucket_id = 'soportes' and (select private.puede_ver(private.carpeta_finca(name), private.modulo_soporte(name))));
create policy soportes_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'soportes'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(calidad|carne|sanidad)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
    and (select private.puede_escribir(private.carpeta_finca(name), private.modulo_soporte(name)))
  );
create policy soportes_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'soportes' and (select private.puede_gestionar(private.carpeta_finca(name))));

-- ───────────────────────── Análisis de leche: más parámetros y documento ─────────────────────────
alter table public.analisis_leche
  add column solidos_totales_pct numeric(4, 2) check (solidos_totales_pct >= 0 and solidos_totales_pct <= 30),
  add column lactosa_pct numeric(4, 2) check (lactosa_pct >= 0 and lactosa_pct <= 10),
  -- Punto de congelación (siempre negativo): la leche pura congela hacia -0,530 a -0,550 °C; más cerca de cero sugiere agua añadida.
  add column crioscopia_c numeric(5, 3) check (crioscopia_c >= -1 and crioscopia_c < 0),
  add column residuos_antibioticos text check (residuos_antibioticos in ('negativo', 'positivo')),
  add column soporte_path text;
alter table public.analisis_leche add constraint analisis_leche_id_finca_uk unique (id, finca_id);
alter table public.analisis_leche add constraint analisis_leche_soporte_ck
  check (soporte_path is null or soporte_path ~ ('^' || finca_id::text || '/calidad/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'));
alter table public.analisis_leche drop constraint analisis_leche_algo_ck;
alter table public.analisis_leche add constraint analisis_leche_algo_ck
  check (grasa_pct is not null or proteina_pct is not null or rcs_miles_ml is not null or solidos_totales_pct is not null
         or lactosa_pct is not null or crioscopia_c is not null or residuos_antibioticos is not null);
-- La pureza y los residuos son del tanque o del lote, no de un animal suelto.
alter table public.analisis_leche add constraint analisis_leche_tanque_ck
  check (animal_id is null or (crioscopia_c is null and residuos_antibioticos is null));

alter table public.despachos_leche add constraint despachos_leche_id_finca_uk unique (id, finca_id);

-- ───────────────────────── Controles de calidad (con constancia de lo que no se hizo) ─────────────────────────
-- Un control es de un despacho de leche (residuos de antibióticos, crioscopia, composición, células somáticas) o de un animal que sale
-- para consumo (condición corporal, inspección en el matadero). Cada uno queda «realizado» (con su respaldo) o «no_realizado»
-- (constancia de que el propietario decidió no hacerlo). Sin fila = sin responder.
create table public.controles_calidad (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  despacho_id uuid,
  animal_id uuid,
  tipo text not null,
  estado text not null check (estado in ('realizado', 'no_realizado')),
  -- Leche: el análisis registrado en Calidad que respalda el control (lleva su documento).
  analisis_id uuid,
  fecha date,
  resultado text check (resultado in ('conforme', 'no_conforme')),
  -- Condición corporal en la escala de 1 a 5.
  valor numeric(2, 1) check (valor >= 1 and valor <= 5),
  detalle text check (detalle is null or char_length(detalle) <= 500),
  motivo text check (motivo is null or char_length(motivo) <= 300),
  soporte_path text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint controles_calidad_despacho_fk foreign key (despacho_id, finca_id) references public.despachos_leche (id, finca_id) on delete cascade,
  constraint controles_calidad_animal_fk foreign key (animal_id, finca_id) references public.animales (id, finca_id) on delete cascade,
  -- Sin «on delete»: un análisis que respalda un control no se puede borrar (se perdería la prueba).
  constraint controles_calidad_analisis_fk foreign key (analisis_id, finca_id) references public.analisis_leche (id, finca_id),
  constraint controles_calidad_despacho_tipo_uk unique (despacho_id, tipo),
  constraint controles_calidad_animal_tipo_uk unique (animal_id, tipo),
  constraint controles_calidad_ambito_ck check ((despacho_id is null) <> (animal_id is null)),
  constraint controles_calidad_tipo_ck check (
    (despacho_id is not null and tipo in ('residuos_antibioticos', 'crioscopia', 'composicion', 'celulas_somaticas'))
    or (animal_id is not null and tipo in ('condicion_corporal', 'inspeccion_postmortem'))
  ),
  constraint controles_calidad_estado_ck check (
    (estado = 'no_realizado' and fecha is null and resultado is null and valor is null and analisis_id is null and soporte_path is null and detalle is null)
    or (estado = 'realizado' and fecha is not null and motivo is null)
  ),
  constraint controles_calidad_leche_ck check (despacho_id is null or estado <> 'realizado' or analisis_id is not null),
  constraint controles_calidad_carne_ck check (
    animal_id is null or estado <> 'realizado'
    or (tipo = 'condicion_corporal' and valor is not null)
    or (tipo = 'inspeccion_postmortem' and soporte_path is not null and resultado is not null)
  ),
  constraint controles_calidad_analisis_solo_leche_ck check (analisis_id is null or despacho_id is not null),
  constraint controles_calidad_soporte_ck check (soporte_path is null or soporte_path ~ ('^' || finca_id::text || '/carne/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'))
);
create index controles_calidad_finca_idx on public.controles_calidad (finca_id, created_at desc);
create trigger controles_calidad_updated_at before update on public.controles_calidad for each row execute function private.set_updated_at();

-- El análisis que respalda un control de leche debe ser del tanque o lote, traer su documento y medir lo que el control dice.
create function private.controles_calidad_validar()
returns trigger
language plpgsql set search_path = ''
as $$
declare a public.analisis_leche;
begin
  if new.analisis_id is null then
    return new;
  end if;
  select * into a from public.analisis_leche where id = new.analisis_id and finca_id = new.finca_id;
  if not found then
    raise exception 'No encontramos ese análisis.' using errcode = 'check_violation';
  end if;
  if a.animal_id is not null then
    raise exception 'Para un despacho se usa un análisis del tanque o del lote, no de un animal.' using errcode = 'check_violation';
  end if;
  if a.soporte_path is null then
    raise exception 'Ese análisis no tiene su documento adjunto. Adjúntalo para usarlo como respaldo.' using errcode = 'check_violation';
  end if;
  if (new.tipo = 'residuos_antibioticos' and a.residuos_antibioticos is null)
     or (new.tipo = 'crioscopia' and a.crioscopia_c is null)
     or (new.tipo = 'composicion' and a.grasa_pct is null and a.proteina_pct is null and a.solidos_totales_pct is null and a.lactosa_pct is null)
     or (new.tipo = 'celulas_somaticas' and a.rcs_miles_ml is null) then
    raise exception 'Ese análisis no incluye el resultado de este control.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger controles_calidad_validar before insert or update on public.controles_calidad
  for each row execute function private.controles_calidad_validar();

-- RLS: los de un despacho siguen al módulo leche; los de un animal, al módulo carne. Borrar, solo propietario o administrador.
alter table public.controles_calidad enable row level security;
create policy controles_calidad_select on public.controles_calidad for select to authenticated
  using ((select case when despacho_id is not null then private.puede_ver(finca_id, 'leche') else private.puede_ver(finca_id, 'carne') end));
create policy controles_calidad_insert on public.controles_calidad for insert to authenticated
  with check ((select case when despacho_id is not null then private.puede_escribir(finca_id, 'leche') else private.puede_escribir(finca_id, 'carne') end));
create policy controles_calidad_update on public.controles_calidad for update to authenticated
  using ((select case when despacho_id is not null then private.puede_escribir(finca_id, 'leche') else private.puede_escribir(finca_id, 'carne') end))
  with check ((select case when despacho_id is not null then private.puede_escribir(finca_id, 'leche') else private.puede_escribir(finca_id, 'carne') end));
create policy controles_calidad_delete on public.controles_calidad for delete to authenticated
  using ((select private.puede_gestionar(finca_id)));
revoke all on public.controles_calidad from anon;
grant select, insert, update, delete on public.controles_calidad to authenticated;
