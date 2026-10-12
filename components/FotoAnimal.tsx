"use client";

import { SubirFoto } from "@/components/SubirFoto";
import { prepararSubidaFotoAnimal } from "@/app/(app)/hato/actions";

/** Foto de un animal. */
export function FotoAnimal(props: { nombre: string; onEstado?: (subiendo: boolean) => void; inicial?: { path: string; url: string } | null }) {
  return <SubirFoto {...props} bucket="fotos-animales" preparar={prepararSubidaFotoAnimal} etiqueta="Foto del animal" textoAgregar="Agregar la foto del animal" />;
}
