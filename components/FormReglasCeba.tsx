"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { useToast } from "@/components/Toast";
import { guardarReglasCeba, restablecerReglasCeba } from "@/app/(app)/carne/ceba-actions";
import { añosDeMeses } from "@/lib/ceba-candidatos";
import type { ReglaCeba } from "@/lib/tipos";

const campoNumero = (id: string, nombre: string, valor: string | number) => (
  <input id={id} name={nombre} type="text" inputMode="decimal" defaultValue={valor} autoComplete="off" className={CLASE_INPUT} />
);

/**
 * Las reglas de ceba de una especie. Los valores de partida son criterios orientativos; la persona los ajusta a su raza y a su sistema.
 * Con `puedeEditar` en falso solo se leen.
 */
export function FormReglasCeba({ regla, nombreEspecie, puedeEditar }: { regla: ReglaCeba; nombreEspecie: string; puedeEditar: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const guardar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(async () => {
      setError(null);
      const r = await guardarReglasCeba(undefined, datos);
      if (r?.error) return setError(r.error);
      toast.exito(`Reglas de ${nombreEspecie} guardadas`);
      router.refresh();
    });
  };

  const restablecer = () =>
    iniciar(async () => {
      setError(null);
      const r = await restablecerReglasCeba(regla.especie);
      if (!r.ok) return setError(r.error);
      setConfirmando(false);
      toast.exito(`Volvieron los valores sugeridos de ${nombreEspecie}`);
      router.refresh();
    });

  if (!puedeEditar) {
    const filas: [string, string][] = [
      ["Hembras: avisar a los", `${regla.hembra_partos_proxima} partos o ${añosDeMeses(regla.hembra_meses_proxima)} años`],
      ["Hembras: ya les toca a los", `${regla.hembra_partos_toca} partos o ${añosDeMeses(regla.hembra_meses_toca)} años`],
      ["Machos: avisar a los", `${regla.macho_meses_proxima} meses`],
      ["Machos: toca decidir a los", `${regla.macho_meses_toca} meses`],
      ["Reproductor: pensar en el reemplazo a los", `${añosDeMeses(regla.reproductor_meses_viejo)} años`],
      ["Pesar machos y animales en ceba cada", `${regla.dias_entre_pesajes} días`],
      ["Pesar hembras cada", `${regla.hembra_dias_entre_pesajes} días`],
    ];
    return (
      <dl className="divide-y divide-arena">
        {filas.map(([e, v]) => (
          <div key={e} className="flex items-start justify-between gap-4 py-2.5">
            <dt className="min-w-0 text-[0.9375rem] text-humo">{e}</dt>
            <dd className="min-w-0 text-right text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <input type="hidden" name="especie" value={regla.especie} />

      <fieldset className="space-y-3">
        <legend className="mb-1 text-[0.9375rem] font-bold">Hembras</legend>
        <p className="text-sm text-humo">Se avisa por lo que llegue primero: los partos o la edad.</p>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Campo etiqueta="Avisar a los (partos)">{(id) => campoNumero(id, "hembra_partos_proxima", regla.hembra_partos_proxima)}</Campo>
          <Campo etiqueta="Ya le toca a los (partos)">{(id) => campoNumero(id, "hembra_partos_toca", regla.hembra_partos_toca)}</Campo>
          <Campo etiqueta="Avisar a los (años)">{(id) => campoNumero(id, "hembra_anios_proxima", añosDeMeses(regla.hembra_meses_proxima))}</Campo>
          <Campo etiqueta="Ya le toca a los (años)">{(id) => campoNumero(id, "hembra_anios_toca", añosDeMeses(regla.hembra_meses_toca))}</Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-[0.9375rem] font-bold">Machos</legend>
        <p className="text-sm text-humo">Un macho sin uso definido llega a una edad en que conviene decidir si será reproductor o de carne.</p>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Campo etiqueta="Avisar a los (meses)">{(id) => campoNumero(id, "macho_meses_proxima", regla.macho_meses_proxima)}</Campo>
          <Campo etiqueta="Toca decidir a los (meses)">{(id) => campoNumero(id, "macho_meses_toca", regla.macho_meses_toca)}</Campo>
          <Campo etiqueta="Reproductor: pensar en su reemplazo a los (años)">{(id) => campoNumero(id, "reproductor_anios_viejo", añosDeMeses(regla.reproductor_meses_viejo))}</Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-[0.9375rem] font-bold">Pesos</legend>
        <p className="text-sm text-humo">El peso al día es lo que dice cuándo un animal está listo; se avisa si pasa este tiempo sin pesarlo.</p>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Campo etiqueta="Machos y animales en ceba: cada (días)">{(id) => campoNumero(id, "dias_entre_pesajes", regla.dias_entre_pesajes)}</Campo>
          <Campo etiqueta="Hembras: cada (días)">{(id) => campoNumero(id, "hembra_dias_entre_pesajes", regla.hembra_dias_entre_pesajes)}</Campo>
        </div>
      </fieldset>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente && !confirmando} cargando="Guardando…">
        Guardar reglas de {nombreEspecie}
      </Boton>

      {regla.personalizada ? (
        confirmando ? (
          <div className="space-y-3 rounded-2xl bg-lana p-3.5">
            <p className="text-[0.9375rem]">Se pierden tus cambios y vuelven los valores sugeridos de {nombreEspecie}.</p>
            <div className="grid grid-cols-2 gap-2">
              <Boton type="button" variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>Cancelar</Boton>
              <Boton type="button" onClick={restablecer} pendiente={pendiente} cargando="Restableciendo…">Sí, volver</Boton>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
            Volver a los valores sugeridos
          </button>
        )
      ) : (
        <p className="text-sm text-humo">Ahora usas los valores sugeridos.</p>
      )}
    </form>
  );
}
