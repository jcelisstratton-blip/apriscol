import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Droplets } from "lucide-react";
import { CapturaLeche } from "@/components/CapturaLeche";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { EnlaceBoton } from "@/components/Boton";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Leche" };

export default async function PaginaLeche() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "leche")) redirect("/");
  const supabase = await crearClienteServidor();

  const { data: lactancias } = await supabase.from("lactancias").select("animal_id").eq("finca_id", finca.id).is("fecha_secado", null);
  const ids = (lactancias ?? []).map((l) => l.animal_id);
  const [animales, retiro] = await Promise.all([
    ids.length
      ? supabase.from("animales").select("id, numero_arete, nombre").in("id", ids).eq("estado", "activo").is("deleted_at", null).order("numero_arete")
      : Promise.resolve({ data: [] as { id: string; numero_arete: string; nombre: string | null }[] }),
    supabase.rpc("animales_en_retiro", { p_finca: finca.id }),
  ]);

  const lista = animales.data ?? [];
  const retiros = Object.fromEntries((retiro.data ?? []).filter((r) => r.retiro_leche_hasta).map((r) => [r.animal_id, r.retiro_leche_hasta!]));
  const hora = Number(new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(new Date()));
  const jornadaInicial = hora < 12 ? "manana" : hora < 19 ? "tarde" : "noche";

  return (
    <>
      <Encabezado titulo="Leche" subtitulo={finca.nombre} />
      {lista.length === 0 ? (
        <EstadoVacio
          icono={<Droplets strokeWidth={1.5} />}
          titulo="Aún no hay hembras en leche"
          descripcion="Aquí aparecen las hembras con lactancia abierta. Se abre al registrar un parto, o al crear la hembra con la fecha de su último parto."
        >
          {puedeEscribir(rol, "hato") ? <EnlaceBoton href="/hato/nuevo">Registrar una hembra</EnlaceBoton> : null}
        </EstadoVacio>
      ) : (
        <CapturaLeche fincaId={finca.id} hoy={hoyBogota()} animales={lista} retiros={retiros} jornadaInicial={jornadaInicial} />
      )}
    </>
  );
}
