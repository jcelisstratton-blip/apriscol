"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import { LogoFinca } from "@/components/LogoFinca";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { cambiarFinca } from "@/app/onboarding/actions";
import { ETIQUETA_ROL } from "@/lib/permisos";
import type { RolFinca } from "@/lib/tipos";

type Item = { id: string; nombre: string; rol: RolFinca; logo_path?: string | null };

/** Chip con la finca activa; abre una hoja para cambiar entre fincas. */
export function FincaSelector({ fincas, activa }: { fincas: Item[]; activa: string }) {
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const actual = fincas.find((f) => f.id === activa);

  const elegir = (id: string) => {
    if (id === activa) return setAbierta(false);
    iniciar(async () => {
      const r = await cambiarFinca(id);
      if (r.error) return toast.error(r.error);
      setAbierta(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full bg-papel px-3.5 text-sm font-semibold ring-1 ring-arena"
      >
        {actual ? <LogoFinca finca={actual} className="-ml-2 size-7 text-sm" /> : null}
        <span className="min-w-0 truncate">{actual?.nombre ?? "Finca"}</span>
        <ChevronDown className="size-4 shrink-0 text-humo" strokeWidth={2} />
      </button>
      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Tus fincas">
        <ul className="-mx-2 space-y-0.5">
          {fincas.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => elegir(f.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-arena/60 disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <LogoFinca finca={f} className="size-10" />
                  <span className="min-w-0">
                    <span className="block font-semibold [overflow-wrap:anywhere]">{f.nombre}</span>
                    <span className="block text-sm text-humo">{ETIQUETA_ROL[f.rol]}</span>
                  </span>
                </span>
                {f.id === activa ? <Check className="size-5 shrink-0 text-musgo" strokeWidth={2} /> : null}
              </button>
            </li>
          ))}
        </ul>
        <Link
          href="/onboarding"
          onClick={() => setAbierta(false)}
          className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-arena font-semibold text-musgo-osc"
        >
          <Plus className="size-5" strokeWidth={2} /> Agregar otra finca
        </Link>
      </Sheet>
    </>
  );
}
