import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { EnlaceBoton } from "@/components/Boton";
import { AvisoCandidatosCeba } from "@/components/AvisoCandidatosCeba";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { diasHasta, formatoFecha, hoyBogota } from "@/lib/fechas";
import { gdp, kg } from "@/lib/carne";

const DIAS_SIN_PESAR = 30;

/** Lo más importante de la ceba de toda la finca: cuántos animales hay, cuánto pesan, cuánto ganan y cuáles ya están listos para beneficio. */
export async function Resumen({
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
  const [lotesDB, animalesDB, retirosDB, candidatosDB] = await Promise.all([
    supabase.from("lotes_ceba").select("*").eq("finca_id", fincaId).is("cerrado_en", null).limit(500),
    supabase.rpc("ceba_animales", { p_finca: fincaId }),
    supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
    supabase.rpc("candidatos_ceba", { p_finca: fincaId }),
  ]);
  const candidatos = candidatosDB.data ?? [];
  const aviso = <AvisoCandidatosCeba tocan={candidatos.filter((c) => c.nivel === "toca").length} proximos={candidatos.filter((c) => c.nivel === "proxima").length} />;
  const lotes = new Map((lotesDB.data ?? []).map((l) => [l.id, l]));
  // «En ceba» = los animales que están en un lote abierto.
  const enCeba = (animalesDB.data ?? []).filter((a) => a.lote_id && lotes.has(a.lote_id));
  const pesados = enCeba.filter((a) => a.peso_ultimo != null);
  const conGdp = enCeba.filter((a) => a.gdp_total_g != null);
  const promedio = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const pesoPromedio = promedio(pesados.map((a) => Number(a.peso_ultimo)));
  const gdpPromedio = promedio(conGdp.map((a) => Number(a.gdp_total_g)));

  const listos = pesados
    .filter((a) => {
      const meta = lotes.get(a.lote_id!)?.peso_meta_kg;
      return meta != null && Number(a.peso_ultimo) >= Number(meta);
    })
    .sort((a, b) => Number(b.peso_ultimo) - Number(a.peso_ultimo));
  const retiro = new Map((retirosDB.data ?? []).map((r) => [r.animal_id, r.retiro_carne_hasta]));
  const sinPesar = enCeba.filter((a) => !a.fecha_ultimo || diasHasta(hoy, a.fecha_ultimo) > DIAS_SIN_PESAR).length;
  const nombres = new Map((await animalesPorIds(supabase, fincaId, listos.slice(0, 10).map((a) => a.animal_id))).map((a) => [a.id, etiquetaAnimal(a)]));

  if (lotes.size === 0) {
    return (
      <div className="space-y-4">
        {aviso}
        <EstadoVacio icono={<Scale strokeWidth={1.5} />} titulo="Aún no hay animales en ceba" descripcion="Crea un lote de ceba, ponle animales y pésalos: aquí verás cuánto ganan por día, cuánto alimento gastan y cuáles ya están listos para beneficio.">
          {puedeEditar ? <EnlaceBoton href="/carne/lotes/nuevo">Crear un lote</EnlaceBoton> : null}
        </EstadoVacio>
      </div>
    );
  }

  const cifras: [string, string][] = [
    ["Animales en ceba", String(enCeba.length)],
    ["Peso promedio", kg(pesoPromedio)],
    ["Ganancia por día", gdp(gdpPromedio)],
    ["Listos para beneficio", String(listos.length)],
  ];

  return (
    <div className="space-y-4">
      {aviso}
      <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-4">
        {cifras.map(([e, v]) => (
          <div key={e} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
            <dd className="font-display text-xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">{v}</dd>
            <dt className="mt-0.5 text-xs font-medium text-humo">{e}</dt>
          </div>
        ))}
      </dl>

      {puedeEditar ? (
        <EnlaceBoton href="/hato?vista=ceba" variante="secundario">
          Pesar animales
        </EnlaceBoton>
      ) : null}

      {sinPesar > 0 ? (
        <Aviso tipo="atencion">
          {sinPesar === 1 ? "1 animal lleva" : `${sinPesar} animales llevan`} más de {DIAS_SIN_PESAR} días sin pesarse (o no tienen ningún peso). Sin pesos al día no se puede saber cuánto están ganando.
        </Aviso>
      ) : null}

      <Tarjeta titulo="Listos para beneficio">
        {listos.length === 0 ? (
          <p className="text-[0.9375rem] text-humo">Ningún animal ha llegado todavía al peso meta de su lote. Cuando llegue, aparece aquí.</p>
        ) : (
          <ul className="divide-y divide-arena">
            {listos.slice(0, 10).map((a) => {
              const hasta = retiro.get(a.animal_id);
              const enRetiro = hasta && hasta >= hoy;
              return (
                <li key={a.animal_id}>
                  <Link href={`/hato/${a.animal_id}#crecimiento`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-semibold">{nombres.get(a.animal_id) ?? "Animal"}</span>
                      <span className="block text-sm text-humo">
                        {lotes.get(a.lote_id!)?.nombre} · meta {kg(lotes.get(a.lote_id!)?.peso_meta_kg)}
                      </span>
                      {enRetiro ? (
                        <span className="mt-1 block">
                          <Insignia tono="alerta">{`En retiro de carne hasta el ${formatoFecha(hasta, { day: "numeric", month: "short" })}`}</Insignia>
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums">
                      {kg(a.peso_ultimo)} <ChevronRight className="size-4 text-humo" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {listos.length > 10 ? <p className="mt-2 text-sm text-humo">Y {listos.length - 10} más. Míralos en cada lote.</p> : null}
        {listos.some((a) => (retiro.get(a.animal_id) ?? "") >= hoy) ? (
          <p className="mt-2 text-sm text-humo">Un animal en retiro de carne no se puede sacrificar ni vender para consumo hasta que termine el retiro.</p>
        ) : null}
      </Tarjeta>
    </div>
  );
}
