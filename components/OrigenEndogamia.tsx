"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { RutasEndogamia } from "@/components/RutasEndogamia";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { AncestroEndogamia } from "@/lib/endogamia";

/** Carga y muestra las rutas que explican la endogamia de un animal (se monta solo cuando alguien quiere verlas). */
export function OrigenEndogamia({ animalId }: { animalId: string }) {
  const [filas, setFilas] = useState<AncestroEndogamia[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const { data, error: e } = await crearClienteNavegador().rpc("explicar_endogamia", { p_animal: animalId });
      if (!vigente) return;
      if (e) setError(e.message);
      else setFilas(data ?? []);
    })();
    return () => {
      vigente = false;
    };
  }, [animalId]);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (filas === null) return <Cargando texto="Buscando el origen…" />;
  return <RutasEndogamia filas={filas} />;
}
