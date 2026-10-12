"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SeleccionHembrasEmp, type FuenteHembras, type MachoSeleccion } from "@/components/SeleccionHembrasEmp";
import { useToast } from "@/components/Toast";
import { asignarHembras } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Agregar hembras a un semental de una temporada que ya existe. La lista, los filtros y el control de endogamia son los de
 * `SeleccionHembrasEmp`; aquí se guardan en la temporada con `asignarHembras`.
 */
export function AsignarHembrasEmp({ loteId, machos, umbral }: { loteId: string; machos: MachoSeleccion[]; umbral: number }) {
  const router = useRouter();
  const toast = useToast();
  const fuente = useMemo<FuenteHembras>(
    () => ({
      candidatas: () => crearClienteNavegador().rpc("empadronamiento_candidatas", { p_lote: loteId }),
      endogamia: (machoId, ids) => crearClienteNavegador().rpc("empadronamiento_endogamia", { p_lote: loteId, p_macho: machoId, p_hembras: ids }),
    }),
    [loteId],
  );

  return (
    <SeleccionHembrasEmp
      machos={machos}
      umbral={umbral}
      fuente={fuente}
      titulo="Agregar hembras a la temporada"
      boton={{
        texto: (
          <>
            <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Agregar hembras
          </>
        ),
      }}
      textoConfirmar={(n) => `Asignar ${n} ${n === 1 ? "hembra" : "hembras"}`}
      onConfirmar={async (sel) => {
        const r = await asignarHembras({ loteId, machoId: sel.machoId, hembraIds: sel.hembraIds, excepcionIds: sel.excepcionIds });
        if (!r.ok) return r.error;
        const nombre = machos.find((m) => m.id === sel.machoId)?.etiqueta ?? "el semental";
        toast.exito(`${r.agregadas} ${r.agregadas === 1 ? "hembra asignada" : "hembras asignadas"} a ${nombre}`);
        router.refresh();
        return null;
      }}
    />
  );
}
