"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useToast } from "@/components/Toast";
import { secarVarias } from "@/app/(app)/leche/actions";

export type HembraPorSecar = { id: string; etiqueta: string; detalle: string; nivel: "rojo" | "ambar" };

/** Elige a qué hembras secar y las seca todas juntas (con confirmación). Vienen marcadas las que la señal «Secado» dice que ya toca secar. */
export function FormSecarVarias({ hembras }: { hembras: HembraPorSecar[] }) {
  const router = useRouter();
  const toast = useToast();
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(hembras.map((h) => h.id)));
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const alternar = (id: string) =>
    setElegidas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.add(id);
      return nuevas;
    });

  const secar = () =>
    iniciar(async () => {
      setError(null);
      const r = await secarVarias([...elegidas]);
      if (!r.ok) return setError(r.error);
      toast.exito(r.secadas === 1 ? "1 hembra quedó seca" : `${r.secadas} hembras quedaron secas`);
      router.push("/reproduccion");
      router.refresh();
    });

  const n = elegidas.size;
  return (
    <div className="space-y-4">
      <p className="text-[0.9375rem] text-humo">
        Estas hembras ya deben secarse (dejar de ordeñarlas antes del parto). Quita la marca a las que quieras seguir ordeñando.
      </p>
      <ListaPorTramos
        items={hembras}
        clave={(h) => h.id}
        fila={(h) => (
          <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-arena py-2">
            <input type="checkbox" checked={elegidas.has(h.id)} onChange={() => alternar(h.id)} className="size-5 shrink-0 accent-musgo" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <span className="block font-semibold">{h.etiqueta}</span>
              <span className="block text-sm text-humo">{h.detalle}</span>
            </span>
            <Insignia tono={h.nivel === "rojo" ? "alerta" : "aviso"}>{h.nivel === "rojo" ? "Rojo" : "Ámbar"}</Insignia>
          </label>
        )}
      />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!confirmando ? (
        <div className="space-y-2">
          <Boton onClick={() => setConfirmando(true)} disabled={n === 0}>
            {n === 0 ? "Elige al menos una hembra" : n === 1 ? "Secar 1 hembra" : `Secar ${n} hembras`}
          </Boton>
          <Link href="/reproduccion" className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-lana p-3.5">
          <p className="text-[0.9375rem]">
            ¿Secar {n === 1 ? "1 hembra" : `${n} hembras`}? Dejan de ordeñarse y su lactancia queda cerrada hoy. Se pueden volver a poner en el ordeño después.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton onClick={secar} pendiente={pendiente} cargando="Guardando…">
              Sí, secar
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
