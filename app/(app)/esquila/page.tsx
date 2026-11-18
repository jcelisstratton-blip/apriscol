import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEsquilas, type EsquilaDeLista } from "@/components/ListaEsquilas";
import { ListaOvejasEsquila } from "@/components/ListaOvejasEsquila";
import { obtenerContexto } from "@/lib/contexto";
import { leerTodo } from "@/lib/consultas";
import { AYUDA_ESQUILA } from "@/lib/ayuda";
import { resumirEsquila } from "@/lib/esquila";
import { cargarOvejasEsquila } from "@/lib/esquila-servidor";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Esquila" };

/** Esquila de las ovejas: cuáles toca esquilar, cuáles son de pelo (no se esquilan) y las esquilas ya hechas. Solo fincas con ovejas. */
export default async function PaginaEsquila({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "hato", finca.plan) || !finca.especies.includes("ovino")) redirect("/");
  const { guardado } = await searchParams;

  const supabase = await crearClienteServidor();
  const [ovejas, esquilas, filas] = await Promise.all([
    cargarOvejasEsquila(supabase, finca.id, hoyBogota()),
    leerTodo((d, h) => supabase.from("esquilas").select("id, fecha, esquilador").eq("finca_id", finca.id).is("anulada_en", null).order("fecha", { ascending: false }).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("esquila_animales").select("id, esquila_id, peso_vellon_kg").eq("finca_id", finca.id).order("id").range(d, h)),
  ]);

  const resumen = resumirEsquila(ovejas);
  const porEsquila = new Map<string, { ovejas: number; kg: number }>();
  for (const f of filas.data) {
    const t = porEsquila.get(f.esquila_id) ?? { ovejas: 0, kg: 0 };
    t.ovejas += 1;
    t.kg += f.peso_vellon_kg ?? 0;
    porEsquila.set(f.esquila_id, t);
  }
  const hechas: EsquilaDeLista[] = esquilas.data.map((e) => ({ id: e.id, fecha: e.fecha, esquilador: e.esquilador, ovejas: porEsquila.get(e.id)?.ovejas ?? 0, kg: porEsquila.get(e.id)?.kg || null }));
  const cifras: [string, number][] = [
    ["De lana", resumen.lana],
    ["Por esquilar", resumen.atrasadas + resumen.tocan + resumen.sinEsquila],
    ["De pelo", resumen.pelo],
    ["Por definir", resumen.porDefinir],
  ];
  const puedeRegistrar = puedeEscribir(rol, "hato", finca.plan) && resumen.lana > 0;

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Encabezado
        titulo="Esquila"
        subtitulo={finca.nombre}
        acciones={puedeRegistrar ? <Link href="/esquila/nueva" className={clasesBoton("primario", false)}>Registrar esquila</Link> : undefined}
      />
      <AyudaModulo ayuda={AYUDA_ESQUILA} />

      {ovejas.length === 0 ? (
        <EstadoVacio icono={<Scissors strokeWidth={1.5} />} titulo="Todavía no tienes ovejas" descripcion="Cuando registres tus ovejas, aquí verás cuáles son de lana y cuándo toca esquilarlas." />
      ) : (
        <div className="space-y-5">
          <section aria-label="Resumen" className="rounded-3xl bg-papel p-4 ring-1 ring-arena">
            <dl className="grid grid-cols-2 gap-y-3 sm:grid-cols-4 sm:divide-x sm:divide-arena">
              {cifras.map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-0 px-2 text-center">
                  <dd className="font-display text-2xl font-semibold tabular-nums">{valor}</dd>
                  <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="Ovejas" className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Ovejas</h2>
            <ListaOvejasEsquila ovejas={ovejas} />
          </section>

          <section aria-label="Esquilas hechas" className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Esquilas hechas</h2>
            <ListaEsquilas esquilas={hechas} />
          </section>
        </div>
      )}
    </>
  );
}
