import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import sim, hato, bajas
from emitir_hato import FINCA, DUENO, SALIDA, jd, filas_json, trozos, escribir

def main():
    for v in SALIDA.glob("04*.sql"): v.unlink()
    r = sim.simular(hato.SEED)
    f = bajas.construir(r)
    sql = f"""-- PILOTO · 04 · Bajas de los últimos 12 meses ({len(f)}): ventas de crías y descartes, sacrificios y muertes. Cada baja cambia sola el estado del animal.
do $b$
declare fn constant uuid := '{FINCA}'; u constant uuid := '{DUENO}'; r jsonb;
begin
  for r in select value from jsonb_array_elements($j$
{filas_json(f)}
$j$::jsonb) loop
    insert into public.bajas (finca_id, animal_id, tipo, fecha, motivo, destino_consumo, peso_kg, valor, comprador, destino, guia_movilizacion, detalle, tercero_id, cobrado_en, cobro_vence, created_by, created_at)
    select fn, a.id, r->>1, (r->>2)::date, nullif(r->>3,''), (r->>4)::boolean, nullif(r->>5,'')::numeric, nullif(r->>6,'')::numeric, nullif(r->>7,''), nullif(r->>8,''), nullif(r->>9,''), nullif(r->>10,''),
           (select t.id from public.finca_terceros t where t.finca_id = fn and t.nombre = r->>7), nullif(r->>11,'')::date, nullif(r->>12,'')::date, u, (r->>2)::timestamptz
    from public.animales a where a.finca_id = fn and a.numero_arete = r->>0 and not exists (select 1 from public.bajas x where x.animal_id = a.id);
  end loop;
end
$b$;
"""
    escribir("04_bajas_del_ano.sql", sql)
    print(len(f))

if __name__ == "__main__":
    main()
