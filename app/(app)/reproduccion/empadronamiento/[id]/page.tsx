import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { obtenerContexto } from "@/lib/contexto";
import { puedeVer } from "@/lib/permisos";
import { Detalle } from "../Detalle";

export const metadata: Metadata = { title: "Empadronamiento" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEmpadronamiento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "reproduccion", finca.plan)) redirect("/");
  const sp = await searchParams;
  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Detalle id={id} finca={finca} rol={rol} />
    </>
  );
}
