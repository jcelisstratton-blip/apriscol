import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { HistorialImportaciones, type CargueVista } from "@/components/HistorialImportaciones";
import { PasoMigrar } from "@/components/PasoMigrar";
import { clasesBoton } from "@/components/Boton";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { avanceMigracion, pasosMigracion, type ConteosMigracion } from "@/lib/migracion";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Migrar mi finca" };

const CARGUES_RECIENTES = 50;

export default async function PaginaMigrar() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect("/hato");
  const supabase = await crearClienteServidor();

  const contar = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;
  const f = finca.id;
  const head = { count: "exact", head: true } as const;
  const permisos = {
    hato: true,
    corrales: puedeEscribir(rol, "corrales", finca.plan),
    reproduccion: puedeEscribir(rol, "reproduccion", finca.plan),
    carne: puedeEscribir(rol, "carne", finca.plan),
    leche: puedeEscribir(rol, "leche", finca.plan),
    sanidad: puedeEscribir(rol, "sanidad", finca.plan),
    inventario: puedeEscribir(rol, "inventario", finca.plan),
  };
  const activos = () => supabase.from("animales").select("id", head).eq("finca_id", f).eq("estado", "activo").is("deleted_at", null);
  const [ubicaciones, animales, desdeExcel, conPadres, servicios, lactancias, pesajes, ordenos, eventosSanitarios, aperturas, cargues] = await Promise.all([
    contar(supabase.from("v_ubicaciones").select("id", head).eq("finca_id", f).eq("activa", true)),
    contar(activos()),
    contar(activos().not("importacion_id", "is", null)),
    contar(activos().or("padre_id.not.is.null,madre_id.not.is.null,padre_externo.not.is.null,madre_externa.not.is.null")),
    contar(supabase.from("servicios").select("id", head).eq("finca_id", f)),
    contar(supabase.from("lactancias").select("id", head).eq("finca_id", f)),
    contar(supabase.from("pesajes").select("id", head).eq("finca_id", f)),
    contar(supabase.from("ordenos").select("id", head).eq("finca_id", f)),
    contar(supabase.from("eventos_sanitarios").select("id", head).eq("finca_id", f)),
    contar(supabase.from("inventario_movimientos").select("id", head).eq("finca_id", f).eq("tipo", "apertura")),
    supabase.from("importaciones").select("id, tipo, archivo, modo, creados, actualizados, estado, created_at, grupo").eq("finca_id", f).order("created_at", { ascending: false }).limit(CARGUES_RECIENTES),
  ]);
  const conteos: ConteosMigracion = { ubicaciones, animales, desdeExcel, conPadres, servicios, lactancias, pesajes, ordenos, eventosSanitarios, aperturas };
  const pasos = pasosMigracion(conteos, permisos);
  const { hechos, total } = avanceMigracion(pasos);
  const historial = (cargues.data ?? []) as CargueVista[];

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Migrar mi finca" subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-3xl">
        <Tarjeta>
          <div className="space-y-2.5">
            <p className="text-[0.9375rem] text-humo">
              Trae tu finca a Apriscol paso a paso, con los Excel que ya tienes. Cada cargue se revisa antes de guardarse y, si algo no queda bien, se puede deshacer.
            </p>
            <div>
              <p className="mb-1 text-sm font-semibold">
                {hechos} de {total} pasos hechos
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos} aria-label="Avance de la migración">
                <div className="h-full rounded-full bg-musgo transition-all" style={{ width: `${total > 0 ? Math.round((hechos / total) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </Tarjeta>
        <ol className="grid grid-cols-1 gap-2.5">
          {pasos.map((p, i) => (
            <PasoMigrar key={p.id} p={p} numero={i + 1} />
          ))}
        </ol>
        <Tarjeta titulo="¿Prefieres que lo cargue otra persona?">
          <div className="space-y-2.5">
            <p className="text-[0.9375rem] text-humo">
              Puedes invitar a alguien de confianza (tu asesor o nuestro equipo) como <span className="font-semibold text-tinta">administrador</span> y él hace estos mismos pasos con tus archivos. Todo queda en «Cargues anteriores» y se puede deshacer. Cuando termine, quítale el acceso desde Equipo.
            </p>
            {puedeGestionar(rol) ? (
              <Link href="/mas/miembros" className={`${clasesBoton("secundario", false)}`}>
                Invitar a alguien al equipo <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </Tarjeta>
        {historial.length > 0 ? (
          <Tarjeta titulo="Cargues anteriores">
            <HistorialImportaciones cargues={historial} puedeDeshacer={puedeGestionar(rol)} />
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
