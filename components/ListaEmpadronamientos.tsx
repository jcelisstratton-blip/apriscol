import Link from "next/link";
import { CalendarRange, ChevronRight, Plus } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { crearClienteServidor } from "@/lib/supabase/server";
import { avanceEmp } from "@/lib/empadronamiento";
import { formatoFecha, hoyBogota } from "@/lib/fechas";

/** Las temporadas de monta de la finca (las abiertas primero), con cuántas hembras y sementales tiene cada una. */
export async function ListaEmpadronamientos({
  fincaId,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const { data } = await supabase.from("v_empadronamientos").select("*").eq("finca_id", fincaId).order("fecha_inicio", { ascending: false }).limit(200);
  const lotes = [...(data ?? [])].sort((a, b) => Number(Boolean(a.cerrado_en)) - Number(Boolean(b.cerrado_en)));
  const nuevo = puedeEditar ? (
    <Link href="/reproduccion/empadronamiento/nuevo" className={clasesBoton("primario")}>
      <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Nuevo empadronamiento
    </Link>
  ) : null;

  if (lotes.length === 0) {
    return (
      <EstadoVacio
        icono={<CalendarRange strokeWidth={1.5} />}
        titulo="Todavía no hay temporadas de monta"
        descripcion="El empadronamiento agrupa a los sementales con las hembras por un tiempo definido, para que los partos caigan juntos. Antes de confirmar cada pareja se revisa la endogamia."
      >
        {nuevo}
      </EstadoVacio>
    );
  }

  return (
    <div className="space-y-3">
      {nuevo}
      <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {lotes.map((l) => {
          const a = avanceEmp(l, hoy);
          return (
            <li key={l.id} className="min-w-0">
              <Link href={`/reproduccion/empadronamiento/${l.id}`} className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena transition active:scale-[0.99]">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{l.nombre}</span>
                  <span className="block text-sm text-humo">
                    {l.especie === "caprino" ? "Cabras" : "Ovejas"} · {formatoFecha(l.fecha_inicio, { day: "numeric", month: "short" })} al {formatoFecha(l.cerrado_en ?? l.fecha_fin_prevista, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {l.cerrado_en ? <Insignia>Cerrada</Insignia> : a.atrasado ? <Insignia tono="aviso">Pasó la fecha de cierre</Insignia> : <Insignia tono="musgo">Abierta · {a.faltan === 0 ? "cierra hoy" : `faltan ${a.faltan} días`}</Insignia>}
                    <span className="text-xs text-humo">
                      {l.machos} {l.machos === 1 ? "semental" : "sementales"} · {l.hembras} {l.hembras === 1 ? "hembra" : "hembras"}
                    </span>
                    {l.excepciones > 0 ? <Insignia tono="alerta">{l.excepciones} {l.excepciones === 1 ? "excepción" : "excepciones"}</Insignia> : null}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
