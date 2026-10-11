import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormTraerAnimales } from "@/components/FormTraerAnimales";
import { PantallaAuth } from "@/components/PantallaAuth";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { finalizarTraerAnimales } from "@/app/(app)/libro/actions";

export const metadata: Metadata = { title: "Tus animales" };

/** Paso único tras crear la cuenta: traer los animales que ya estén en el registro genealógico. */
export default async function PaginaTraerAnimales() {
  const { perfil, rol } = await obtenerContexto();
  if (perfil?.libro_resuelto_en || !puedeGestionar(rol)) redirect("/");

  return (
    <PantallaAuth
      titulo="¿Ya tienes animales registrados?"
      subtitulo="Si están en el registro genealógico, los traemos a tu finca una sola vez, con su pedigrí y sus padres."
    >
      <FormTraerAnimales alFinalizar={finalizarTraerAnimales} />
    </PantallaAuth>
  );
}
