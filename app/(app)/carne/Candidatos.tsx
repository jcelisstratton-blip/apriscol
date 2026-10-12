import Link from "next/link";
import { Scale } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaCandidatos, type FilaCandidato } from "@/components/ListaCandidatos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import { textoEdad, textoPartos, textosAdvertencias, textosMotivos, textoUltimoPeso } from "@/lib/ceba-candidatos";

/**
 * Animales que conviene pasar a ceba o que están por llegar a ese punto, según las reglas de la finca (partos, edad, peso). Decidir sobre
 * uno se hace en su ficha: ahí se elige el lote, se define el uso de un macho o se aplaza el aviso.
 */
export async function Candidatos({
  fincaId,
  cliente,
}: {
  fincaId: string;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const [candidatosDB, reglasDB] = await Promise.all([
    supabase.rpc("candidatos_ceba", { p_finca: fincaId }),
    supabase.rpc("reglas_ceba_efectivas", { p_finca: fincaId }),
  ]);
  const candidatos = candidatosDB.data ?? [];
  const reglas = new Map((reglasDB.data ?? []).map((r) => [r.especie, r]));
  const nombres = new Map((await animalesPorIds(supabase, fincaId, candidatos.map((c) => c.animal_id))).map((a) => [a.id, etiquetaAnimal(a)]));

  if (candidatos.length === 0) {
    return (
      <EstadoVacio
        icono={<Scale strokeWidth={1.5} />}
        titulo="Ningún animal está por pasar a ceba"
        descripcion="Cuando una hembra llegue a los partos o a la edad que fijaste, o un macho llegue a la edad de decidir su uso, aparecerá aquí con el motivo."
      >
        <Link href="/carne?vista=reglas" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
          Ver las reglas
        </Link>
      </EstadoVacio>
    );
  }

  const tocan = candidatos.filter((c) => c.nivel === "toca").length;
  const proximos = candidatos.length - tocan;
  const sinDefinir = candidatos.filter((c) => c.motivos.includes("definir_uso")).length;
  const conAdvertencia = candidatos.filter((c) => c.advertencias.some((a) => a !== "sin_pesar")).length;

  const filas: FilaCandidato[] = candidatos.flatMap((c) => {
    const regla = reglas.get(c.especie);
    if (!regla) return [];
    return [
      {
        id: c.animal_id,
        etiqueta: nombres.get(c.animal_id) ?? "Animal",
        sexo: c.sexo,
        nivel: c.nivel,
        detalle: [textoEdad(c.edad_meses), c.sexo === "hembra" && c.partos_totales != null ? textoPartos(c.partos_totales) : null].filter(Boolean).join(" · "),
        motivos: textosMotivos(c, regla),
        advertencias: textosAdvertencias(c, regla, hoy),
        peso: textoUltimoPeso(c, hoy),
      },
    ];
  });

  const cifras: [string, string][] = [
    ["Ya les toca", String(tocan)],
    ["Próximos", String(proximos)],
    ["Machos por definir", String(sinDefinir)],
    ["Con advertencia", String(conAdvertencia)],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-4">
        {cifras.map(([e, v]) => (
          <div key={e} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
            <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{v}</dd>
            <dt className="mt-0.5 text-xs font-medium text-humo">{e}</dt>
          </div>
        ))}
      </dl>
      <Aviso tipo="info">
        Según las reglas de tu finca. Abre cada animal para ponerlo en un lote, decidir el uso de un macho o aplazar el aviso. Puedes{" "}
        <Link href="/carne?vista=reglas" className="font-semibold text-musgo underline-offset-4 hover:underline">
          ajustar las reglas
        </Link>
        .
      </Aviso>
      <ListaCandidatos filas={filas} />
    </div>
  );
}
