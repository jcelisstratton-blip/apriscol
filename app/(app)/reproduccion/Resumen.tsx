import Link from "next/link";
import { Baby, ChevronRight } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { diasHasta, formatoFecha, hoyBogota } from "@/lib/fechas";
import { DIAS_PARA_DIAGNOSTICO, DIAS_PARTO_ATRASADO, plazoParto } from "@/lib/reproduccion";
import type { ReproHembra } from "@/lib/tipos";

/** Cuántos días hacia adelante cuenta como «parto próximo». */
const DIAS_PROXIMOS = 45;

/** Lo que más importa de la reproducción de toda la finca: quiénes están gestantes y cuándo paren, y qué servicios hay que confirmar. */
export async function Resumen({
  fincaId,
  cliente,
}: {
  fincaId: string;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const { data } = await supabase.from("v_repro_hembras").select("*").eq("finca_id", fincaId).limit(2000);
  const filas = (data ?? []) as ReproHembra[];

  const enGestacion = filas.filter((f) => f.estado === "gestante" || f.estado === "servida");
  const proximos = enGestacion
    .filter((f) => f.fecha_prevista_parto && diasHasta(f.fecha_prevista_parto, hoy) >= -DIAS_PARTO_ATRASADO && diasHasta(f.fecha_prevista_parto, hoy) <= DIAS_PROXIMOS)
    .sort((a, b) => a.fecha_prevista_parto!.localeCompare(b.fecha_prevista_parto!));
  const atrasados = enGestacion.filter((f) => f.fecha_prevista_parto && diasHasta(f.fecha_prevista_parto, hoy) < -DIAS_PARTO_ATRASADO);
  const porConfirmar = filas
    .filter((f) => f.estado === "servida" && f.ultimo_servicio && diasHasta(hoy, f.ultimo_servicio) >= DIAS_PARA_DIAGNOSTICO)
    .sort((a, b) => a.ultimo_servicio!.localeCompare(b.ultimo_servicio!));
  const gestantes = filas.filter((f) => f.estado === "gestante").length;
  const sinDatos = filas.filter((f) => f.estado === "sin_datos").length;
  const enMonta = filas.filter((f) => f.empadronamiento_id).length;

  const ids = [...proximos.slice(0, 10), ...atrasados.slice(0, 10), ...porConfirmar.slice(0, 10)].map((f) => f.animal_id);
  const nombres = new Map((await animalesPorIds(supabase, fincaId, ids)).map((a) => [a.id, etiquetaAnimal(a)]));
  const etiqueta = (id: string) => nombres.get(id) ?? "Hembra";

  if (filas.length === 0) {
    return <EstadoVacio icono={<Baby strokeWidth={1.5} />} titulo="Aún no hay hembras" descripcion="Cuando registres hembras, aquí verás cuáles están gestantes, cuándo paren y qué servicios hay que confirmar." />;
  }

  const cifras: [string, string][] = [
    ["Gestantes", String(gestantes)],
    ["Servidas por confirmar", String(filas.filter((f) => f.estado === "servida").length)],
    [`Partos en ${DIAS_PROXIMOS} días`, String(proximos.length)],
    ["Partos atrasados", String(atrasados.length)],
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

      {enMonta > 0 ? (
        <Aviso tipo="info">
          {enMonta === 1 ? "1 hembra está" : `${enMonta} hembras están`} en una temporada de monta abierta.{" "}
          <Link href="/reproduccion?vista=empadronamiento" className="font-semibold text-musgo underline underline-offset-2">Ver empadronamientos</Link>
        </Aviso>
      ) : null}

      {atrasados.length > 0 ? (
        <Aviso tipo="atencion">
          {atrasados.length === 1 ? "1 hembra pasó" : `${atrasados.length} hembras pasaron`} más de {DIAS_PARTO_ATRASADO} días de su fecha prevista sin parir: {atrasados.slice(0, 5).map((f) => etiqueta(f.animal_id)).join(", ")}
          {atrasados.length > 5 ? "…" : ""}. Revisa si ya parió (y registra el parto) o si no quedó gestante.
        </Aviso>
      ) : null}

      <Tarjeta titulo="Próximos partos">
        {proximos.length === 0 ? (
          <p className="text-[0.9375rem] text-humo">No hay partos previstos en los próximos {DIAS_PROXIMOS} días. La fecha sale del servicio (hoy: {formatoFecha(hoy)}).</p>
        ) : (
          <ul className="divide-y divide-arena">
            {proximos.slice(0, 15).map((f) => {
              const p = plazoParto(f.fecha_prevista_parto!, hoy);
              return (
                <li key={f.animal_id}>
                  <Link href={`/hato/${f.animal_id}#reproduccion`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-semibold">{etiqueta(f.animal_id)}</span>
                      <span className="block text-sm text-humo">
                        {formatoFecha(f.fecha_prevista_parto, { day: "numeric", month: "short" })} · {f.estado === "gestante" ? "gestante" : "servida (sin confirmar)"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Insignia tono={p.tono}>{p.texto}</Insignia> <ChevronRight className="size-4 text-humo" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      {porConfirmar.length > 0 ? (
        <Tarjeta titulo="Servicios por confirmar">
          <p className="mb-2 text-sm text-humo">Pasaron {DIAS_PARA_DIAGNOSTICO} días o más del servicio y no hay diagnóstico: conviene confirmar si quedaron gestantes.</p>
          <ul className="divide-y divide-arena">
            {porConfirmar.slice(0, 15).map((f) => (
              <li key={f.animal_id}>
                <Link href={`/hato/${f.animal_id}/reproduccion/diagnostico/nuevo`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block font-semibold">{etiqueta(f.animal_id)}</span>
                    <span className="block text-sm text-humo">Servicio del {formatoFecha(f.ultimo_servicio, { day: "numeric", month: "short" })}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-musgo">
                    Registrar diagnóstico <ChevronRight className="size-4 text-humo" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {sinDatos > 0 ? (
        <Aviso tipo="info">
          {sinDatos === 1 ? "1 hembra no tiene" : `${sinDatos} hembras no tienen`} ningún dato reproductivo (ni servicios ni partos). A medida que los registres desde su ficha, el sistema sabe cuáles están gestantes y cuántos partos llevan.
        </Aviso>
      ) : null}
    </div>
  );
}
