import Link from "next/link";
import { AyudaModulo } from "@/components/AyudaModulo";
import type { Especie } from "@/lib/tipos";
import { AYUDA_EMPADRONAMIENTO } from "@/lib/ayuda";
import { CalendarRange, Plus } from "lucide-react";
import { AsignarHembrasEmp } from "@/components/AsignarHembrasEmp";
import { clasesBoton } from "@/components/Boton";
import { CerrarEmpadronamiento } from "@/components/CerrarEmpadronamiento";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { etiquetaExterno } from "@/lib/semental-externo";
import { avanceEmp, capacidadSemental, ETIQUETA_CAPACIDAD, mesesDesde } from "@/lib/empadronamiento";
import { formatoFecha, hoyBogota } from "@/lib/fechas";

/**
 * Hato → Empadronamiento: las temporadas de monta abiertas, donde se arman y se cierran: crear una, agregar hembras a sus sementales
 * y cerrarla para pasarlas a gestación. El resumen de todas (y con qué hembras se hizo cada una) está en Reproducción → Empadronamiento.
 */
export async function Monta({
  fincaId,
  umbral,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  umbral: number;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const [lotesDB, paramDB] = await Promise.all([
    supabase.from("v_empadronamientos").select("*").eq("finca_id", fincaId).is("cerrado_en", null).order("fecha_inicio", { ascending: false }).limit(50),
    supabase.from("finca_ajustes_especie").select("especie, gestacion_dias").eq("finca_id", fincaId),
  ]);
  const lotes = lotesDB.data ?? [];
  const gestacion = new Map((paramDB.data ?? []).map((p) => [p.especie, p.gestacion_dias]));
  // La gestación de la finca (ajuste del propietario); cada finca tiene siempre su fila.
  const gestacionDe = (especie: Especie) => {
    const dias = gestacion.get(especie);
    if (dias == null) throw new Error("No se pudieron leer los ajustes de la finca.");
    return dias;
  };
  const ids = lotes.map((l) => l.id);

  const [machosDB, hembrasDB] = ids.length
    ? await Promise.all([
        supabase.from("empadronamiento_machos").select("empadronamiento_id, macho_id, num_hembras, externo").in("empadronamiento_id", ids).eq("finca_id", fincaId).limit(1000),
        supabase.from("empadronamiento_hembras").select("empadronamiento_id, macho_id").in("empadronamiento_id", ids).eq("finca_id", fincaId).limit(5000),
      ])
    : [{ data: [] }, { data: [] }];
  const machos = machosDB.data ?? [];
  const externoIds = [...new Set(machos.filter((m) => m.externo).map((m) => m.macho_id))];
  const machoIds = [...new Set(machos.filter((m) => !m.externo).map((m) => m.macho_id))];
  const [nombresLista, edadesDB, externosDB] = await Promise.all([
    animalesPorIds(supabase, fincaId, machoIds),
    machoIds.length ? supabase.from("animales").select("id, fecha_nacimiento").in("id", machoIds).eq("finca_id", fincaId) : Promise.resolve({ data: [] as { id: string; fecha_nacimiento: string | null }[] }),
    externoIds.length ? supabase.from("sementales_externos").select("id, nombre, chip, fecha_nacimiento").in("id", externoIds).eq("finca_id", fincaId) : Promise.resolve({ data: [] as { id: string; nombre: string; chip: string; fecha_nacimiento: string | null }[] }),
  ]);
  const nombres = new Map(nombresLista.map((a) => [a.id, etiquetaAnimal(a)]));
  const edades = new Map((edadesDB.data ?? []).map((e) => [e.id, e.fecha_nacimiento]));
  // Un semental de otro hato (prestado) se nombra con su nombre y chip, y su edad sale de su propia ficha de préstamo.
  for (const e of externosDB.data ?? []) {
    nombres.set(e.id, etiquetaExterno(e));
    edades.set(e.id, e.fecha_nacimiento);
  }
  const cuenta = new Map<string, number>();
  for (const h of hembrasDB.data ?? []) cuenta.set(`${h.empadronamiento_id}|${h.macho_id}`, (cuenta.get(`${h.empadronamiento_id}|${h.macho_id}`) ?? 0) + 1);

  const nuevo = puedeEditar ? (
    <Link href="/reproduccion/empadronamiento/nuevo" className={clasesBoton("primario")}>
      <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Nuevo empadronamiento
    </Link>
  ) : null;

  return (
    <div className="space-y-4">
      <AyudaModulo ayuda={AYUDA_EMPADRONAMIENTO} />

      {lotes.length === 0 ? (
        <EstadoVacio
          icono={<CalendarRange strokeWidth={1.5} />}
          titulo="No hay ninguna temporada abierta"
          descripcion="Crea un empadronamiento para agrupar a los sementales con las hembras por un tiempo definido y que los partos caigan juntos."
        >
          {nuevo}
        </EstadoVacio>
      ) : (
        <>
          {nuevo}
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {lotes.map((l) => {
              const a = avanceEmp(l, hoy);
              const susMachos = machos.filter((m) => m.empadronamiento_id === l.id).map((m) => {
                const cap = capacidadSemental(l.especie, mesesDesde(edades.get(m.macho_id) ?? null, hoy), m.num_hembras);
                return { id: m.macho_id, etiqueta: nombres.get(m.macho_id) ?? "Semental", asignadas: cuenta.get(`${l.id}|${m.macho_id}`) ?? 0, capacidad: cap.max, origen: cap.origen, limite: m.num_hembras, externo: m.externo };
              });
              return (
                <li key={l.id} className="min-w-0 space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                  <Link href={`/reproduccion/empadronamiento/${l.id}`} className="block">
                    <span className="block font-bold [overflow-wrap:anywhere]">{l.nombre}</span>
                    <span className="block text-sm text-humo">
                      {l.especie === "caprino" ? "Cabras" : "Ovejas"} · {formatoFecha(l.fecha_inicio, { day: "numeric", month: "short" })} al {formatoFecha(l.fecha_fin_prevista, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {a.atrasado ? <Insignia tono="aviso">Pasó la fecha de cierre</Insignia> : <Insignia tono="musgo">{a.faltan === 0 ? "Cierra hoy" : `Faltan ${a.faltan} días`}</Insignia>}
                      <span className="text-xs text-humo">{l.hembras} {l.hembras === 1 ? "hembra" : "hembras"}</span>
                      {l.excepciones > 0 ? <Insignia tono="alerta">{l.excepciones} {l.excepciones === 1 ? "excepción" : "excepciones"}</Insignia> : null}
                    </span>
                  </Link>
                  {susMachos.length > 0 ? (
                    <ul className="divide-y divide-arena rounded-xl bg-lana px-3">
                      {susMachos.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-[0.9375rem]">
                          <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{m.etiqueta}</span>
                          <span className="shrink-0 text-right text-sm text-humo">
                            {m.asignadas} de {m.capacidad}
                            <span className="block text-xs">{m.limite != null ? (m.asignadas < m.limite ? `faltan ${m.limite - m.asignadas}` : "completo") : ETIQUETA_CAPACIDAD[m.origen]}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {puedeEditar ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <AsignarHembrasEmp loteId={l.id} machos={susMachos} umbral={umbral} />
                      <CerrarEmpadronamiento loteId={l.id} inicio={l.fecha_inicio} hoy={hoy} hembras={l.hembras} gestacionDias={gestacionDe(l.especie)} especie={l.especie} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
