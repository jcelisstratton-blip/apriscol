import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { Tarjeta } from "@/components/Tarjeta";
import { ayudaEsquilaOveja } from "@/lib/ayuda";
import { coberturaEfectiva, ETIQUETA_COBERTURA, kilosVellon, plazoEsquila, seEsquila, textoPlazo } from "@/lib/esquila";
import { formatoFecha } from "@/lib/fechas";
import { puedeEscribir } from "@/lib/permisos";
import type { CoberturaRaza } from "@/lib/tipos";
import { Dato } from "./Dato";
import type { CtxFicha } from "./contexto";

/** Esquila de una oveja: si es de lana o de pelo, cuándo fue la última y cuándo le toca. Las cabras no la llevan. */
export async function TarjetaEsquila({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase, hoy } = c;
  if (animal.especie !== "ovino") return null;

  const [raza, filas] = await Promise.all([
    animal.raza_id ? supabase.from("razas").select("nombre, cobertura").eq("id", animal.raza_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("esquila_animales").select("esquila_id, peso_vellon_kg").eq("animal_id", id).limit(60),
  ]);
  const idsEsquilas = (filas.data ?? []).map((f) => f.esquila_id);
  const { data: esquilas } = idsEsquilas.length
    ? await supabase.from("esquilas").select("id, fecha, esquilador").in("id", idsEsquilas).is("anulada_en", null).order("fecha", { ascending: false })
    : { data: [] };
  const kilosDe = new Map((filas.data ?? []).map((f) => [f.esquila_id, f.peso_vellon_kg]));
  const historial = (esquilas ?? []).map((e) => ({ ...e, kg: kilosDe.get(e.id) ?? null }));

  const cobertura = coberturaEfectiva("ovino", animal.cobertura, (raza.data?.cobertura ?? null) as CoberturaRaza | null);
  const puedeEditar = puedeEscribir(rol, "hato", finca.plan) && animal.estado === "activo";
  // Una oveja dada de baja solo muestra su historial, si lo tiene.
  if (animal.estado !== "activo" && historial.length === 0) return null;

  const origen = animal.cobertura ? "la definiste en su ficha" : raza.data?.nombre ? `por su raza (${raza.data.nombre})` : "sin raza elegida";
  const plazo = cobertura === "lana" ? plazoEsquila(historial[0]?.fecha ?? null, hoy, c.ajustes.general.esquila_cada_meses, c.ajustes.general.esquila_aviso_dias) : null;
  const total = historial.reduce((s, h) => s + (h.kg ?? 0), 0);

  return (
    <Tarjeta titulo="Esquila" id="esquila">
      <AyudaModulo ayuda={ayudaEsquilaOveja(c.ajustes.general)} />
      <dl className="divide-y divide-arena">
        <Dato etiqueta="Cobertura">
          {ETIQUETA_COBERTURA[cobertura ?? "por_definir"]}
          <span className="block text-sm font-normal text-humo">{origen}</span>
        </Dato>
        {plazo ? (
          <>
            <Dato etiqueta="Última esquila">{historial[0] ? formatoFecha(historial[0].fecha) : "Ninguna registrada"}</Dato>
            <Dato etiqueta="Próxima">
              {plazo.proxima ? formatoFecha(plazo.proxima) : "—"}
              <span className="block text-sm font-normal text-humo">{textoPlazo(plazo)}</span>
            </Dato>
            {total > 0 ? <Dato etiqueta="Vellón en total">{kilosVellon(total)}</Dato> : null}
          </>
        ) : null}
      </dl>

      {cobertura === "pelo" ? <p className="mt-2 text-[0.9375rem] text-humo">Es una oveja de pelo: no se esquila.</p> : null}
      {cobertura === "por_definir" ? (
        <div className="mt-3">
          <Aviso tipo="atencion">
            No sabemos si es de lana o de pelo. Dilo en su ficha y Apriscol sabrá si hay que esquilarla.
          </Aviso>
        </div>
      ) : null}

      {historial.length > 0 ? (
        <ul className="mt-3 divide-y divide-arena rounded-2xl ring-1 ring-arena">
          {historial.slice(0, 5).map((h) => (
            <li key={h.id} className="flex min-w-0 items-baseline justify-between gap-3 px-3.5 py-2.5 text-[0.9375rem]">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {formatoFecha(h.fecha)}
                {h.esquilador ? <span className="text-humo"> · {h.esquilador}</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{kilosVellon(h.kg)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {puedeEditar ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {seEsquila(cobertura) ? (
            <Link href={`/esquila/nueva?animal=${id}`} className={clasesBoton("secundario")}>
              Registrar esquila
            </Link>
          ) : null}
          <Link href={`/hato/${id}/editar#cobertura`} className={clasesBoton("secundario")}>
            {cobertura === "por_definir" ? "Definir si es de lana o de pelo" : "Cambiar lana o pelo"}
          </Link>
        </div>
      ) : null}
    </Tarjeta>
  );
}
