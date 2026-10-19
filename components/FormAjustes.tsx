"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { useToast } from "@/components/Toast";
import { guardarAjustes, restablecerAjustes } from "@/app/(app)/mas/ajustes/actions";
import { NOMBRE_MES, textoNumero, type AjustesCompletos, type CampoAjuste, type GrupoDefinicion, type RangoGestacion } from "@/lib/ajustes";
import type { Especie } from "@/lib/tipos";

const NOMBRE_ESPECIE: Record<Especie, string> = { caprino: "Cabras", ovino: "Ovejas" };

const etiquetaConUnidad = (c: CampoAjuste<string>) => (c.unidad ? `${c.etiqueta} (${c.unidad})` : c.etiqueta);

/** Un grupo de ajustes de la finca. Con `puedeEditar` en falso (cualquier rol que no sea el propietario) solo se leen. */
export function FormAjustes({
  grupo,
  ajustes,
  especies,
  rangos,
  puedeEditar,
}: {
  grupo: GrupoDefinicion;
  ajustes: AjustesCompletos;
  especies: Especie[];
  rangos: Record<Especie, RangoGestacion>;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const valorGeneral = (clave: string) => (ajustes.general as unknown as Record<string, number | null>)[clave];
  const valorEspecie = (clave: string, especie: Especie) => (ajustes.especie[especie] as unknown as Record<string, number | null>)[clave];
  const campoEspecie = (c: CampoAjuste<string>, especie: Especie) =>
    c.clave === "gestacion_dias" ? { ...c, min: rangos[especie].min, max: rangos[especie].max } : c;

  const guardar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(async () => {
      setError(null);
      const r = await guardarAjustes(undefined, datos);
      if (r?.error) return setError(r.error);
      toast.exito(`Ajustes de ${grupo.titulo.toLowerCase()} guardados`);
      router.refresh();
    });
  };

  const restablecer = () =>
    iniciar(async () => {
      setError(null);
      const r = await restablecerAjustes(grupo.id);
      if (!r.ok) return setError(r.error);
      setConfirmando(false);
      toast.exito(`Volvieron los valores sugeridos de ${grupo.titulo.toLowerCase()}`);
      router.refresh();
    });

  const mesesLluvia = ajustes.general.meses_lluvia;

  if (!puedeEditar) {
    const filas: [string, string][] = [];
    for (const c of grupo.general) {
      const v = valorGeneral(c.clave);
      filas.push([c.etiqueta, v == null ? "Sin aviso" : `${textoNumero(v, c.decimales)}${c.unidad ? ` ${c.unidad}` : ""}`]);
    }
    if (grupo.id === "sanidad") filas.push(["Meses de lluvia", mesesLluvia.length ? mesesLluvia.map((m) => NOMBRE_MES[m - 1]).join(", ") : "Ninguno"]);
    for (const especie of especies) {
      for (const c of grupo.especie) {
        const v = valorEspecie(c.clave, especie);
        filas.push([`${c.etiqueta} · ${NOMBRE_ESPECIE[especie].toLowerCase()}`, v == null ? "Sin definir" : `${textoNumero(v, c.decimales)}${c.unidad ? ` ${c.unidad}` : ""}`]);
      }
    }
    return (
      <dl className="divide-y divide-arena">
        {filas.map(([e, v]) => (
          <div key={e} className="flex items-start justify-between gap-4 py-2.5">
            <dt className="min-w-0 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">{e}</dt>
            <dd className="min-w-0 text-right text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <input type="hidden" name="grupo" value={grupo.id} />

      {grupo.general.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          {grupo.general.map((c) => (
            <Campo key={c.clave} etiqueta={etiquetaConUnidad(c)} ayuda={c.ayuda}>
              {(id) => (
                <input id={id} name={c.clave} type="text" inputMode="decimal" autoComplete="off" defaultValue={textoNumero(valorGeneral(c.clave), c.decimales)} placeholder={c.opcional ? "Sin aviso" : undefined} className={CLASE_INPUT} />
              )}
            </Campo>
          ))}
        </div>
      ) : null}

      {grupo.id === "sanidad" ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">Meses de lluvia</legend>
          <p className="text-[0.8125rem] text-humo">En estos meses el baño de patas se repite con el intervalo corto.</p>
          <div className="flex flex-wrap gap-2">
            {NOMBRE_MES.map((mes, i) => (
              <label key={mes} className="relative">
                <input type="checkbox" name="meses_lluvia" value={i + 1} defaultChecked={mesesLluvia.includes(i + 1)} className="peer sr-only" aria-label={mes} />
                <span className="grid min-h-11 min-w-14 cursor-pointer place-items-center rounded-full border border-arena bg-papel px-3 text-sm font-semibold capitalize transition peer-checked:border-musgo peer-checked:bg-musgo peer-checked:text-sobre-musgo peer-focus-visible:ring-2 peer-focus-visible:ring-musgo/40">
                  {mes.slice(0, 3)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {grupo.especie.length > 0
        ? especies.map((especie) => (
            <fieldset key={especie} className="space-y-3">
              <legend className="mb-1 text-[0.9375rem] font-bold">{NOMBRE_ESPECIE[especie]}</legend>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                {grupo.especie.map((c0) => {
                  const c = campoEspecie(c0, especie);
                  const ayuda = c.clave === "gestacion_dias" ? `Entre ${textoNumero(c.min, 0)} y ${textoNumero(c.max, 0)} días. Lo habitual: ${textoNumero(rangos[especie].defecto, 0)}.` : c.ayuda;
                  return (
                    <Campo key={c.clave} etiqueta={etiquetaConUnidad(c)} ayuda={ayuda}>
                      {(id) => (
                        <input id={id} name={`${c.clave}__${especie}`} type="text" inputMode="decimal" autoComplete="off" defaultValue={textoNumero(valorEspecie(c.clave, especie), c.decimales)} placeholder={c.opcional ? "Sin definir" : undefined} className={CLASE_INPUT} />
                      )}
                    </Campo>
                  );
                })}
              </div>
            </fieldset>
          ))
        : null}

      {grupo.nota ? <Aviso tipo="info">{grupo.nota}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente && !confirmando} cargando="Guardando…">
        Guardar {grupo.titulo.toLowerCase()}
      </Boton>

      {confirmando ? (
        <div className="space-y-3 rounded-2xl bg-lana p-3.5">
          <p className="text-[0.9375rem]">Se pierden tus cambios y vuelven los valores sugeridos de {grupo.titulo.toLowerCase()}.</p>
          <div className="grid grid-cols-2 gap-2">
            <Boton type="button" variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton type="button" onClick={restablecer} pendiente={pendiente} cargando="Restableciendo…">
              Sí, volver
            </Boton>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
          Volver a los valores sugeridos
        </button>
      )}
    </form>
  );
}
