import Link from "next/link";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_RESULTADO_PRUEBA } from "@/lib/sanidad";
import { estadoRcs, formatoMiles } from "@/lib/leche-calidad";
import { direccionSoporte } from "@/lib/soportes";
import type { LactanciaResumen } from "@/lib/tipos";
import type { CtxFicha } from "./contexto";

/** Análisis de leche de la hembra (grasa, proteína, células) y su último CMT. */
export async function TarjetaCalidadLeche({ c, lac }: { c: CtxFicha; lac: LactanciaResumen | null }) {
  const { id, animal, finca, rol, ajustes, supabase } = c;
  const verLeche = puedeVer(rol, "leche", finca.plan) && animal.sexo === "hembra";
  const verSanidad = puedeVer(rol, "sanidad", finca.plan);
  const analisisLeche = verLeche
    ? ((await supabase.from("analisis_leche").select("*").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(20)).data ?? [])
    : [];
  const ultimoCmt = verSanidad
    ? (await supabase.from("pruebas_sanitarias").select("fecha, resultado").eq("animal_id", id).eq("finca_id", finca.id).eq("prueba", "cmt").order("fecha", { ascending: false }).limit(1).maybeSingle()).data
    : null;
  if (!(verLeche && (lac || analisisLeche.length > 0))) return null;

  return (
    <Tarjeta titulo="Calidad de la leche" id="calidad">
      {analisisLeche.length === 0 ? (
        <p className="text-[0.9375rem] text-humo">Todavía no tiene análisis de grasa, proteína ni células somáticas.</p>
      ) : (
        <ul className="divide-y divide-arena">
          {analisisLeche.map((a) => {
            const rcs = a.rcs_miles_ml != null ? estadoRcs(a.rcs_miles_ml, ajustes.general.ccs_limite_miles_ml) : null;
            return (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="block font-semibold">{formatoFecha(a.fecha)}{a.laboratorio ? ` · ${a.laboratorio}` : ""}</span>
                  <span className="block text-sm text-humo">
                    {[
                      a.grasa_pct != null ? `Grasa ${a.grasa_pct.toLocaleString("es-CO")} %` : null,
                      a.proteina_pct != null ? `Proteína ${a.proteina_pct.toLocaleString("es-CO")} %` : null,
                      a.rcs_miles_ml != null ? `Células ${formatoMiles(a.rcs_miles_ml)}` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                  {rcs ? <span className="mt-1 block"><Insignia tono={rcs.tono}>{`Células somáticas: ${rcs.texto.toLowerCase()}`}</Insignia></span> : null}
                  {a.soporte_path ? (
                    <a href={direccionSoporte(a.soporte_path)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-8 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                      Ver documento
                    </a>
                  ) : (
                    <span className="mt-1 block"><Insignia tono="aviso">Sin documento</Insignia></span>
                  )}
                </span>
                {puedeEscribir(rol, "leche", finca.plan) ? (
                  <Link href={`/leche/calidad/${a.id}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Editar
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {verSanidad ? (
        <p className="mt-2 text-sm text-humo">
          {ultimoCmt ? (
            <>Último CMT: <strong>{ETIQUETA_RESULTADO_PRUEBA[ultimoCmt.resultado]}</strong> el {formatoFecha(ultimoCmt.fecha)}.</>
          ) : (
            "Todavía no tiene CMT registrado (se anota en Prueba diagnóstica)."
          )}
        </p>
      ) : null}
      {puedeEscribir(rol, "leche", finca.plan) && animal.estado === "activo" ? (
        <Link href={`/hato/${id}/calidad/nuevo`} className={`${clasesBoton("secundario")} mt-3`}>
          Registrar análisis
        </Link>
      ) : null}
    </Tarjeta>
  );
}
