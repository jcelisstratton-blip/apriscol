"""Emite el SQL del hato del piloto en bloques pequeños (datos ficticios): carga/02a_animales_NN.sql, 02b_bajas_previas.sql y 02c_movimientos_NN.sql."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import sim, hato
from sim import HOY, T0

FINCA = "5e1f0a11-0000-4000-8000-000000000001"
DUENO = "1d7d56da-3ffb-47e5-baec-390752e23794"
SALIDA = pathlib.Path(__file__).parent.parent / "carga"


def jd(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def filas_json(filas):
    """Una fila por línea (se pueden leer por páginas)."""
    return "[\n" + ",\n".join(jd(f) for f in filas) + "\n]"


def trozos(lista, n):
    return [lista[i:i + n] for i in range(0, len(lista), n)]


def escribir(nombre, texto):
    SALIDA.mkdir(exist_ok=True)
    (SALIDA / nombre).write_text(texto, encoding="utf-8")


def main():
    for viejo in SALIDA.glob("*.sql") if SALIDA.exists() else []:
        if viejo.name[:2] == "02": viejo.unlink()
    r = sim.simular(hato.SEED)
    em = r["emitir"]
    filas = []
    for a in em:
        lacta_hoy = any(l["secado"] is None for l in hato.lactancias(a))
        filas.append([
            a.clave, a.nombre, a.sexo, a.especie, a.raza, a.nac.isoformat(), a.nac_aprox,
            a.padre.clave if a.padre else None, a.madre.clave if a.madre else None, a.padre_ext, a.madre_ext, a.origen,
            a.peso_nacer, hato.vocacion(a), hato.chip(a), a.color, hato.marca(a), hato.rasgo(a),
            a.uso_macho if (not a.es_h and (a.uso_macho or a.edad_dias(HOY) > 100)) else None,
            "{manana,tarde}" if lacta_hoy and a.baja is None else None,
            hato.partos_previos(a), a.valor_compra, a.compra.isoformat() if a.compra else None, hato.creado(a),
        ])
    oc = hato.ocupacion_hoy(em)
    cap = {"ALTA": oc.get("ALTA", 0), "SEMEN": max(8, oc.get("SEMEN", 0)), "POT_O1": max(45, oc.get("POT_O1", 0)), "CRIAS": max(20, oc.get("CRIAS", 0) + 1)}
    caps_sql = "\n".join(f"  update public.ubicaciones set capacidad = {v} where finca_id = f and nombre = '{hato.NOMBRE_UBIC[k]}';" for k, v in cap.items())

    grupos = trozos(filas, 70)
    for i, g in enumerate(grupos, 1):
        pre = caps_sql + "\n" if i == 1 else ""
        sql = f"""-- PILOTO · 02a · Animales {i}/{len(grupos)} (en orden de nacimiento: el padre y la madre siempre antes que la cría). Generado por generador/emitir_hato.py, semilla {hato.SEED}.
do $h$
declare
  f constant uuid := '{FINCA}';
  u constant uuid := '{DUENO}';
  r jsonb;
begin
  if not exists (select 1 from public.fincas where id = f) then raise exception 'Falta correr 01_esqueleto.sql'; end if;
{pre}  for r in select value from jsonb_array_elements($j$
{filas_json(g)}
$j$::jsonb) loop
    if exists (select 1 from public.animales where finca_id = f and numero_arete = r->>0) then continue; end if;
    insert into public.animales (finca_id, numero_arete, nombre, sexo, especie, raza_id, fecha_nacimiento, fecha_nacimiento_aprox, padre_id, madre_id,
        padre_externo, madre_externa, origen, peso_nacer_kg, vocacion, chip, color, marcas, rasgos, uso_macho, turnos_ordeno, partos_previos,
        valor_compra, fecha_compra, created_at, created_by)
    values (f, r->>0, r->>1, (r->>2)::public.sexo_animal, (r->>3)::public.especie, (r->>4)::smallint, (r->>5)::date, (r->>6)::boolean,
        (select p.id from public.animales p where p.finca_id = f and p.numero_arete = r->>7),
        (select p.id from public.animales p where p.finca_id = f and p.numero_arete = r->>8),
        nullif(r->>9,''), nullif(r->>10,''), r->>11, nullif(r->>12,'')::numeric,
        (r->>13)::public.vocacion_animal, nullif(r->>14,''), nullif(r->>15,''), nullif(r->>16,''), nullif(r->>17,''), nullif(r->>18,''),
        nullif(r->>19,'')::text[], nullif(r->>20,'')::smallint, nullif(r->>21,'')::numeric, nullif(r->>22,'')::date, (r->>23)::timestamptz, u);
  end loop;
end
$h$;
"""
        escribir(f"02a_animales_{i:02d}.sql", sql)

    bajas_pre = []
    for a in em:
        if a.baja and a.baja["fecha"] < T0:
            b = a.baja
            bajas_pre.append([a.clave, b["tipo"], b["fecha"].isoformat(), b.get("motivo"), b.get("destino_consumo"), b.get("peso_kg"), b.get("valor"), b.get("comprador"), b.get("destino")])
    sql = f"""-- PILOTO · 02b · Bajas anteriores a la adopción ({len(bajas_pre)}): antepasados que salieron del hato antes de usar Apriscol.
do $b$
declare
  f constant uuid := '{FINCA}';
  u constant uuid := '{DUENO}';
  r jsonb;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(bajas_pre)}
$j$::jsonb) loop
    insert into public.bajas (finca_id, animal_id, tipo, fecha, motivo, destino_consumo, peso_kg, valor, comprador, destino, tercero_id, cobrado_en, created_by)
    select f, a.id, r->>1, (r->>2)::date, nullif(r->>3,''), coalesce((r->>4)::boolean, false), nullif(r->>5,'')::numeric, nullif(r->>6,'')::numeric, nullif(r->>7,''), nullif(r->>8,''),
           (select t.id from public.finca_terceros t where t.finca_id = f and t.nombre = r->>7),
           case when r->>1 = 'venta' then (r->>2)::date + 7 end, u
    from public.animales a
    where a.finca_id = f and a.numero_arete = r->>0
      and not exists (select 1 from public.bajas x where x.animal_id = a.id);
  end loop;
end
$b$;
"""
    escribir("02b_bajas_previas.sql", sql)

    movs = []
    for a in em:
        if a.baja and a.baja["fecha"] < T0: continue
        for u, desde, hasta, motivo in hato.segmentos(a):
            movs.append([a.clave, u, desde.isoformat(), hasta.isoformat() if hasta else None, motivo])
    # los cerrados primero y los abiertos al final (así el cupo se valida con todo el historial ya cargado)
    movs.sort(key=lambda m: (m[3] is None, m[2]))
    grupos = trozos(movs, 230)
    for i, g in enumerate(grupos, 1):
        sql = f"""-- PILOTO · 02c · Movimientos entre corrales y potreros {i}/{len(grupos)} ({len(movs)} en total, historial desde la adopción). Los abiertos (hasta = null) respetan el cupo.
do $m$
declare
  f constant uuid := '{FINCA}';
  u constant uuid := '{DUENO}';
  nombres constant jsonb := '{jd(hato.NOMBRE_UBIC)}'::jsonb;
  r jsonb;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(g)}
$j$::jsonb) loop
    insert into public.movimientos_animales (finca_id, animal_id, ubicacion_id, desde, hasta, motivo, created_by)
    select f, a.id, x.id, (r->>2)::date, nullif(r->>3,'')::date, r->>4, u
    from public.animales a join public.ubicaciones x on x.finca_id = f and x.nombre = nombres ->> (r->>1)
    where a.finca_id = f and a.numero_arete = r->>0
      and not exists (select 1 from public.movimientos_animales m where m.animal_id = a.id and m.ubicacion_id = x.id and m.desde = (r->>2)::date);
    if not found and not exists (select 1 from public.animales a where a.finca_id = f and a.numero_arete = r->>0) then raise exception 'Animal inexistente: %', r; end if;
  end loop;
end
$m$;
"""
        escribir(f"02c_movimientos_{i:02d}.sql", sql)
    print("animales", len(filas), "bajas_pre", len(bajas_pre), "movs", len(movs), "caps", cap)


if __name__ == "__main__":
    main()
