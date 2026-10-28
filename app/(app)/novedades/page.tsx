import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { ListaNovedades } from "@/components/ListaNovedades";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer, revisaNovedades } from "@/lib/permisos";
import { ESTADOS_NOVEDAD, type EstadoNovedad } from "@/lib/novedades";

export const metadata: Metadata = { title: "Novedades" };

/**
 * Novedades: avisos informativos del equipo sobre los animales (una aplicación, una prueba, un coprológico, un FAMACHA), siempre con el nombre de quien los envió.
 * El propietario, el administrador y el veterinario ven todas y las marcan; el ordeñador ve las suyas. Es lo primero del menú para quien las revisa.
 */
export default async function PaginaNovedades({ searchParams }: { searchParams: Promise<{ estado?: string; enviada?: string }> }) {
  const { finca, rol, user } = await obtenerContexto();
  if (!puedeVer(rol, "novedades", finca.plan)) redirect("/");
  const sp = await searchParams;
  const reviso = revisaNovedades(rol);
  const inicial: EstadoNovedad | "todas" = (ESTADOS_NOVEDAD as string[]).includes(sp.estado ?? "") ? (sp.estado as EstadoNovedad) : reviso ? "nueva" : "todas";

  return (
    <>
      <AvisoGuardado activo={sp.enviada === "1"} texto="Novedad enviada" />
      <Encabezado titulo={reviso ? "Novedades" : "Mis novedades"} subtitulo={finca.nombre} acciones={puedeEscribir(rol, "novedades", finca.plan) ? <EnlaceBoton href="/novedades/nueva" ancho={false}>Crear una novedad</EnlaceBoton> : null} />
      <ListaNovedades fincaId={finca.id} reviso={reviso} estadoInicial={inicial} usuarioId={user.id} />
    </>
  );
}
