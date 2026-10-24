-- Personal: datos propios de cada perfil (veterinario, ordeñador, administrador, contador y quien trabaja sin acceso a la app).
-- Solo agrega columnas y amplía `registrar_persona`: retrocompatible. No se guarda documento de identidad (regla de nómina): la tarjeta profesional es el
-- registro del oficio, no la cédula.
--  · Todos: `telefono` (obligatorio al agregar un veterinario) y `experiencia_anios`.
--  · Veterinario: `tarjeta_profesional`, `especialidades` (reproducción, sanidad, cirugía, nutrición, calidad de leche) y `acreditaciones` (ICA u otras).
--  · Ordeñador: `turno_ordeno`, `tipo_ordeno` y `curso_manipulacion` (con su vencimiento): quien toca la leche debe tenerlo vigente.
--  · Administrador: `formacion`.
--  · Contador: `tipo_contador` (público o auxiliar) y `tarjeta_profesional` (la del contador público).
--  · Sin acceso a la app: `labor_principal`.

alter table public.personal
  add column telefono text check (telefono is null or char_length(btrim(telefono)) between 7 and 20),
  add column experiencia_anios smallint check (experiencia_anios between 0 and 60),
  add column formacion text check (formacion in ('empirica', 'tecnica', 'tecnologica', 'profesional')),
  add column tarjeta_profesional text check (tarjeta_profesional is null or char_length(btrim(tarjeta_profesional)) between 3 and 40),
  add column tipo_contador text check (tipo_contador in ('publico', 'auxiliar')),
  add column especialidades text[] not null default '{}'
    check (especialidades <@ array['reproduccion', 'sanidad', 'cirugia', 'nutricion', 'calidad_leche']::text[]),
  add column acreditaciones text check (acreditaciones is null or char_length(acreditaciones) <= 200),
  add column turno_ordeno text check (turno_ordeno in ('manana', 'tarde', 'ambos')),
  add column tipo_ordeno text check (tipo_ordeno in ('manual', 'mecanico', 'ambos')),
  add column curso_manipulacion boolean,
  add column curso_manipulacion_vence date,
  add column labor_principal text check (labor_principal in ('hato', 'potreros', 'alimentacion', 'mantenimiento', 'otra'));

-- p_persona ahora también trae los datos del perfil. Lo demás igual que en 20261021165634.
create or replace function public.registrar_persona(p_finca uuid, p_persona jsonb, p_email text default null, p_rol text default null)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_persona uuid;
  v_token uuid;
  v_correo text := nullif(btrim(p_email), '');
begin
  if not (private.puede_gestionar(p_finca) and private.puede_escribir(p_finca, 'contabilidad')) then
    raise exception 'Solo el propietario o un administrador puede agregar personas.' using errcode = 'insufficient_privilege';
  end if;
  if v_correo is not null and nullif(p_rol, '') is null then
    raise exception 'Elige el perfil de la persona.' using errcode = 'check_violation';
  end if;
  insert into public.personal (
    finca_id, nombre, cargo, vinculacion, forma_pago, valor_base, fecha_ingreso, correo, rol,
    telefono, experiencia_anios, formacion, tarjeta_profesional, tipo_contador, especialidades, acreditaciones,
    turno_ordeno, tipo_ordeno, curso_manipulacion, curso_manipulacion_vence, labor_principal
  ) values (
    p_finca, btrim(p_persona ->> 'nombre'), nullif(btrim(p_persona ->> 'cargo'), ''), p_persona ->> 'vinculacion',
    p_persona ->> 'forma_pago', (p_persona ->> 'valor_base')::numeric, nullif(p_persona ->> 'fecha_ingreso', '')::date,
    v_correo, case when v_correo is not null then p_rol::public.rol_finca end,
    nullif(btrim(p_persona ->> 'telefono'), ''), nullif(p_persona ->> 'experiencia_anios', '')::smallint, nullif(p_persona ->> 'formacion', ''),
    nullif(btrim(p_persona ->> 'tarjeta_profesional'), ''), nullif(p_persona ->> 'tipo_contador', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_persona -> 'especialidades', '[]'::jsonb))), '{}'::text[]),
    nullif(btrim(p_persona ->> 'acreditaciones'), ''),
    nullif(p_persona ->> 'turno_ordeno', ''), nullif(p_persona ->> 'tipo_ordeno', ''), nullif(p_persona ->> 'curso_manipulacion', '')::boolean,
    nullif(p_persona ->> 'curso_manipulacion_vence', '')::date, nullif(p_persona ->> 'labor_principal', '')
  ) returning id into v_persona;
  if v_correo is not null then
    insert into public.invitaciones (finca_id, email, rol) values (p_finca, v_correo, p_rol::public.rol_finca) returning token into v_token;
  end if;
  return jsonb_build_object('persona_id', v_persona, 'token', v_token);
end;
$$;
revoke execute on function public.registrar_persona(uuid, jsonb, text, text) from public, anon;
grant execute on function public.registrar_persona(uuid, jsonb, text, text) to authenticated;
