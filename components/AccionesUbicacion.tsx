"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { useToast } from "@/components/Toast";
import { cambiarActivaUbicacion, eliminarUbicacion } from "@/app/(app)/hato/corrales/actions";

/** Archivar o reactivar una instalación y, si nunca tuvo animales, eliminarla. El historial de animales no se pierde al archivar. */
export function AccionesUbicacion({ id, nombre, activa, puedeEliminar }: { id: string; nombre: string; activa: boolean; puedeEliminar: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiar = () =>
    iniciar(async () => {
      setError(null);
      const r = await cambiarActivaUbicacion(id, !activa);
      if (!r.ok) return setError(r.error);
      toast.exito(activa ? `${nombre} archivada` : `${nombre} activa de nuevo`);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <Boton variante="secundario" onClick={cambiar} pendiente={pendiente} cargando="Guardando…">
        {activa ? <Archive className="size-5" strokeWidth={1.9} aria-hidden="true" /> : <ArchiveRestore className="size-5" strokeWidth={1.9} aria-hidden="true" />}
        {activa ? "Archivar" : "Volver a activar"}
      </Boton>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {puedeEliminar ? (
        <EliminarRegistro
          etiqueta="Eliminar esta instalación"
          resumen={nombre}
          consecuencia="Solo se puede eliminar si nunca tuvo animales."
          accion={() => eliminarUbicacion(id)}
          destino="/hato?vista=corrales"
          mensaje="Instalación eliminada"
        />
      ) : null}
    </div>
  );
}
