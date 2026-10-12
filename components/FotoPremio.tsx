"use client";

import { SubirFoto } from "@/components/SubirFoto";
import { prepararSubidaFoto } from "@/app/(app)/ferias/actions";

/** Foto del premio de una feria. */
export function FotoPremio(props: { nombre: string; onEstado?: (subiendo: boolean) => void; inicial?: { path: string; url: string } | null }) {
  return <SubirFoto {...props} bucket="premios" preparar={prepararSubidaFoto} etiqueta="Foto del premio" textoAgregar="Agregar la foto del premio" />;
}
