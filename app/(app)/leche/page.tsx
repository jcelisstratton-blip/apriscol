import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Droplets } from "lucide-react";
import { AgregarAlOrdeno } from "@/components/AgregarAlOrdeno";
import { CapturaLeche } from "@/components/CapturaLeche";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { EnlaceBoton } from "@/components/Boton";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Leche" };

export default async function PaginaLeche({ searchParams }: { searchParams: Promise<{ agregar?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "leche")) redirect("/");
  const { agregar } = await searchParams;
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
  const puedeEditar = puedeEscribir(rol, "leche");
  const hoy = hoyBogota();
  const inicial = agregar && /^[0-9a-f-]{36}$/i.test(agregar) ? agregar : undefined;
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
          {puedeEditar ? (
            <div className="space-y-2">
              <AgregarAlOrdeno fincaId={finca.id} hoy={hoy} enLeche={ids} inicial={inicial} />
              <EnlaceBoton href="/hato/nuevo" variante="fantasma">Registrar una hembra nueva</EnlaceBoton>
            </div>
          ) : null}
        </EstadoVacio>
      ) : (
        <div className="space-y-4">
          <CapturaLeche fincaId={finca.id} hoy={hoy} animales={lista} retiros={retiros} jornadaInicial={jornadaInicial} puedeEditar={puedeEditar} />
          {puedeEditar ? <AgregarAlOrdeno fincaId={finca.id} hoy={hoy} enLeche={ids} inicial={inicial} /> : null}
        </div>
      )}
    </>
  );
}
