import { Droplets } from "lucide-react";
import { AgregarAlOrdeno } from "@/components/AgregarAlOrdeno";
import { AlertasProduccion } from "@/components/AlertasProduccion";
import { CapturaLeche } from "@/components/CapturaLeche";
import { EstadoVacio } from "@/components/EstadoVacio";
import { EnlaceBoton } from "@/components/Boton";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyBogota } from "@/lib/fechas";
import { etiquetaAnimal } from "@/lib/animal";
import { esBaja } from "@/lib/produccion";

/** Registrar el ordeño de una jornada: los litros de cada hembra en leche. */
export async function Registrar({
  fincaId,
  puedeEditar,
  agregar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  agregar?: string;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const { data: lactancias } = await supabase.from("lactancias").select("animal_id").eq("finca_id", fincaId).is("fecha_secado", null);
  const ids = (lactancias ?? []).map((l) => l.animal_id);
  const [animales, retiro, tendencia, habitualFilas] = await Promise.all([
    ids.length
      ? supabase.from("animales").select("id, numero_arete, nombre, turnos_ordeno").in("id", ids).eq("estado", "activo").is("deleted_at", null).order("numero_arete")
      : Promise.resolve({ data: [] as { id: string; numero_arete: string; nombre: string | null; turnos_ordeno: string[] | null }[] }),
    supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
    supabase.rpc("produccion_tendencia", { p_finca: fincaId }),
    supabase.rpc("produccion_habitual", { p_finca: fincaId }),
  ]);

  const lista = animales.data ?? [];
  const hoy = hoyBogota();
  const inicial = agregar && /^[0-9a-f-]{36}$/i.test(agregar) ? agregar : undefined;
  const retiros = Object.fromEntries((retiro.data ?? []).filter((r) => r.retiro_leche_hasta).map((r) => [r.animal_id, r.retiro_leche_hasta!]));
  // Hembras cuya producción viene bajando, y lo que cada una da habitualmente por jornada (para avisar al registrar).
  const tendenciasBaja = (tendencia.data ?? []).filter(esBaja);
  const etiquetas = new Map(lista.map((a) => [a.id, etiquetaAnimal(a)]));
  const alertas = tendenciasBaja.map((t) => ({ ...t, etiqueta: etiquetas.get(t.animal_id) ?? "Animal" }));
  const tendencias = Object.fromEntries(tendenciasBaja.map((t) => [t.animal_id, { nivel: t.nivel, variacion: t.variacion, base: t.litros_base ?? 0, recientes: t.litros_recientes ?? 0 }]));
  const habitual: Record<string, Record<string, number>> = {};
  for (const h of habitualFilas.data ?? []) (habitual[h.animal_id] ??= {})[h.jornada] = Number(h.litros_habitual);
  const hora = Number(new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(new Date()));
  const jornadaInicial = hora < 12 ? "manana" : hora < 19 ? "tarde" : "noche";

  if (lista.length === 0) {
    return (
      <EstadoVacio
        icono={<Droplets strokeWidth={1.5} />}
        titulo="Aún no hay hembras en leche"
        descripcion="Aquí aparecen las hembras con lactancia abierta. Se abre al registrar un parto, o al crear la hembra con la fecha de su último parto."
      >
        {puedeEditar ? (
          <div className="space-y-2">
            <AgregarAlOrdeno fincaId={fincaId} hoy={hoy} enLeche={ids} inicial={inicial} />
            <EnlaceBoton href="/hato/nuevo" variante="fantasma">Registrar una hembra nueva</EnlaceBoton>
          </div>
        ) : null}
      </EstadoVacio>
    );
  }
  return (
    <>
      {alertas.length > 0 ? (
        <div className="mb-4">
          <AlertasProduccion alertas={alertas} />
        </div>
      ) : null}
      <CapturaLeche
        fincaId={fincaId}
        hoy={hoy}
        animales={lista.map(({ turnos_ordeno, ...a }) => ({ ...a, turnos: turnos_ordeno }))}
        retiros={retiros}
        jornadaInicial={jornadaInicial}
        tendencias={tendencias}
        habitual={habitual}
        puedeEditar={puedeEditar}
        pie={puedeEditar ? <AgregarAlOrdeno fincaId={fincaId} hoy={hoy} enLeche={ids} inicial={inicial} /> : null}
      />
    </>
  );
}
