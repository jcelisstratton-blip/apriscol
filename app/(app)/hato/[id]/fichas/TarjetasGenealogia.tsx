import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { RutasEndogamia } from "@/components/RutasEndogamia";
import { describirParentesco, nivelEndogamia, pedigriTexto, porcentaje, primeraMayuscula, type AncestroEndogamia } from "@/lib/endogamia";
import type { CtxFicha } from "./contexto";
import { Dato } from "./Dato";

/** Genealogía de los padres, endogamia y la explicación de sus rutas. */
export async function TarjetasGenealogia({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase } = c;
  const verGenealogia = puedeVer(rol, "genealogia", finca.plan) || puedeVer(rol, "hato", finca.plan);
  const puedeCalcular = Boolean((animal.padre_id && animal.madre_id) || animal.libro_id);
  const idsPadres = [animal.padre_id, animal.madre_id].filter((x): x is string => !!x);
  const [padres, endo, completitud] = await Promise.all([
    idsPadres.length ? supabase.from("animales").select("id, numero_arete, nombre").in("id", idsPadres) : Promise.resolve({ data: [] }),
    puedeCalcular && verGenealogia ? supabase.rpc("coef_endogamia", { p_animal: id }) : Promise.resolve({ data: null as number | null }),
    verGenealogia ? supabase.rpc("completitud_pedigri", { p_animal: id }) : Promise.resolve({ data: null as number | null }),
  ]);
  const padre = padres.data?.find((p) => p.id === animal.padre_id);
  const madre = padres.data?.find((p) => p.id === animal.madre_id);
  const pedigri = typeof completitud.data === "number" ? completitud.data : 0;
  // Con un pedigrí vacío el 0 % no significa «sin endogamia», significa «sin datos»: no se muestra como medida.
  const f = pedigri > 0 && typeof endo.data === "number" ? endo.data : null;
  const nivel = f === null ? null : nivelEndogamia(f, finca.umbral_endogamia);
  const alertaEndogamia = nivel === "alto" || nivel === "muy_alto";
  // Por qué hay endogamia: ancestros repetidos y parentesco entre el padre y la madre.
  const origen: AncestroEndogamia[] = f !== null && f > 0 ? ((await supabase.rpc("explicar_endogamia", { p_animal: id })).data ?? []) : [];
  const parentescoPadres = describirParentesco(origen);
  if (!(verGenealogia)) return null;

  return (
    <>
      <Tarjeta titulo="Genealogía">
        <dl className="divide-y divide-arena">
          <Dato etiqueta="Padre">
            {padre ? (
              <Link href={`/hato/${padre.id}`} className="text-musgo underline-offset-4 hover:underline">
                {padre.nombre ? `${padre.nombre} · ${padre.numero_arete}` : padre.numero_arete}
              </Link>
            ) : (
              (animal.padre_externo ?? "Sin registrar")
            )}
          </Dato>
          <Dato etiqueta="Madre">
            {madre ? (
              <Link href={`/hato/${madre.id}`} className="text-musgo underline-offset-4 hover:underline">
                {madre.nombre ? `${madre.nombre} · ${madre.numero_arete}` : madre.numero_arete}
              </Link>
            ) : (
              (animal.madre_externa ?? "Sin registrar")
            )}
          </Dato>
          {parentescoPadres ? <Dato etiqueta="Parentesco de sus padres">{primeraMayuscula(parentescoPadres.relacion)}</Dato> : null}
          {f !== null ? (
            <Dato etiqueta="Endogamia (F)">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums">{porcentaje(f)}</span>
                <NivelEndogamia f={f} umbral={finca.umbral_endogamia} />
              </span>
            </Dato>
          ) : null}
          <Dato etiqueta="Pedigrí conocido">
            {pedigriTexto(pedigri)} · {Math.round(pedigri * 100)} %
          </Dato>
        </dl>
        {alertaEndogamia ? (
          <Aviso tipo="atencion" className="mt-3">
            La endogamia supera el umbral de tu finca ({porcentaje(finca.umbral_endogamia)}). Conviene evitar repetir esta cruza.
          </Aviso>
        ) : null}
        {pedigri < 0.5 ? (
          <Aviso tipo="info" className="mt-3">
            {pedigri === 0
              ? "Todavía no hay padres registrados, por eso no se puede medir la endogamia."
              : "Con pocos ancestros registrados el cálculo puede quedarse corto. Completa el pedigrí para que sea más confiable."}
          </Aviso>
        ) : null}
        {animal.estado === "activo" ? (
          <Link
            href={animal.sexo === "macho" ? `/hato/cruza?macho=${id}` : `/hato/cruza?hembra=${id}`}
            className={`${clasesBoton("secundario")} mt-3`}
          >
            Simular una cruza
          </Link>
        ) : null}
      </Tarjeta>

      {f !== null && f > 0 ? (
      <Tarjeta titulo="¿Por qué hay endogamia?">
        <p className="mb-3 text-[0.9375rem] text-humo">
          {animal.nombre ?? animal.numero_arete} tiene ancestros repetidos: animales que aparecen tanto por el lado del padre como por el de la madre.
          Esta es la ruta desde cada uno de ellos hasta el ancestro.
        </p>
        <RutasEndogamia filas={origen} />
      </Tarjeta>
      ) : null}
    </>
  );
}
