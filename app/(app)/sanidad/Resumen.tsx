import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { EnlaceBoton } from "@/components/Boton";
import { IconoEvento } from "@/components/IconoEvento";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_EVENTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, TONO_RESULTADO_PRUEBA, estadoDosis, nombreEvento } from "@/lib/sanidad";
import type { SanidadPendiente, TipoEvento } from "@/lib/tipos";

type Grupo = { evento_id: string; tipo: TipoEvento | null; producto_nombre: string | null; proxima_fecha: string; animales: string[] };

export async function Resumen({
  fincaId,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const [retiro, pendientes, pruebas] = await Promise.all([
    supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
    supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", fincaId).order("proxima_fecha").limit(1000),
    supabase.from("pruebas_sanitarias").select("id, animal_id, prueba, fecha, resultado").eq("finca_id", fincaId).in("resultado", ["positivo", "sospechoso"]).order("fecha", { ascending: false }).limit(8),
  ]);

  // Las dosis por aplicar se agrupan por el evento que las programó: «Clostridial · 30 animales · vence el 20 de oct».
  const grupos = new Map<string, Grupo>();
  for (const p of (pendientes.data ?? []) as SanidadPendiente[]) {
    if (!p.evento_id || !p.animal_id || !p.proxima_fecha) continue;
    const g = grupos.get(p.evento_id) ?? { evento_id: p.evento_id, tipo: p.tipo, producto_nombre: p.producto_nombre, proxima_fecha: p.proxima_fecha, animales: [] };
    g.animales.push(p.animal_id);
    grupos.set(p.evento_id, g);
  }
  const listaGrupos = [...grupos.values()].sort((a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha));
  const cercanos = listaGrupos.filter((g) => estadoDosis(g.proxima_fecha, hoy).dias <= 30);
  const lejanos = listaGrupos.length - cercanos.length;
  const vencidos = listaGrupos.filter((g) => estadoDosis(g.proxima_fecha, hoy).dias < 0).length;

  const enRetiro = (retiro.data ?? []).slice().sort((a, b) => (a.retiro_carne_hasta ?? a.retiro_leche_hasta ?? "").localeCompare(b.retiro_carne_hasta ?? b.retiro_leche_hasta ?? ""));
  const idsNecesarios = [
    ...enRetiro.map((r) => r.animal_id),
    ...cercanos.filter((g) => g.animales.length === 1).map((g) => g.animales[0]),
    ...(pruebas.data ?? []).map((p) => p.animal_id),
  ];
  const animales = await animalesPorIds(supabase, fincaId, idsNecesarios);
  const nombres = new Map(animales.map((a) => [a.id, etiquetaAnimal(a)]));
  const pruebasAtencion = pruebas.data ?? [];

  if (enRetiro.length === 0 && cercanos.length === 0 && lejanos === 0 && pruebasAtencion.length === 0) {
    return (
      <Tarjeta className="lg:max-w-xl">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">Todo al día</p>
            <p className="mt-1 text-[0.9375rem] text-humo">Ningún animal está en retiro y no hay dosis por aplicar ni pruebas por revisar. Cuando registres una vacuna o un tratamiento, aquí verás sus retiros y próximas dosis.</p>
            {puedeEditar ? (
              <div className="mt-3">
                <EnlaceBoton href="/sanidad/nuevo" ancho={false}>Registrar vacuna o tratamiento</EnlaceBoton>
              </div>
            ) : null}
          </div>
        </div>
      </Tarjeta>
    );
  }

  const cifras: [string, number, boolean][] = [
    ["En retiro", enRetiro.length, false],
    ["Dosis por aplicar", listaGrupos.length, vencidos > 0],
    ["Pruebas por revisar", pruebasAtencion.length, false],
  ];

  return (
    <div className="space-y-3.5">
      <Tarjeta>
        <dl className="grid grid-cols-3 divide-x divide-arena text-center">
          {cifras.map(([etiqueta, valor, alerta]) => (
            <div key={etiqueta} className="min-w-0 px-1">
              <dd className={`font-display text-2xl font-semibold tabular-nums ${alerta ? "text-rojo" : ""}`}>{valor}</dd>
              <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <div className="space-y-3.5 lg:columns-2 lg:gap-x-4 lg:space-y-0 lg:[&>*]:mb-3.5 lg:[&>*]:break-inside-avoid">
        {listaGrupos.length > 0 ? (
          <Tarjeta titulo="Dosis por aplicar">
            <ul className="divide-y divide-arena">
              {cercanos.map((g) => {
                const e = estadoDosis(g.proxima_fecha, hoy);
                const cuantos = g.animales.length === 1 ? (nombres.get(g.animales[0]) ?? "1 animal") : `${g.animales.length} animales`;
                return (
                  <li key={g.evento_id} className="flex items-center gap-3 py-2.5">
                    <IconoEvento tipo={g.tipo} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold [overflow-wrap:anywhere]">{nombreEvento(g)}</span>
                      <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                        {g.tipo ? ETIQUETA_EVENTO[g.tipo] : ""} · {cuantos}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Insignia tono={e.tono}>{e.texto}</Insignia>
                        <Insignia>{formatoFecha(g.proxima_fecha, { day: "numeric", month: "short" })}</Insignia>
                      </span>
                    </span>
                    {puedeEditar ? (
                      <Link href={`/sanidad/nuevo?refuerzo=${g.evento_id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                        Aplicar
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {lejanos > 0 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">{lejanos} {lejanos === 1 ? "programada" : "programadas"} para más adelante.</p> : null}
          </Tarjeta>
        ) : null}

        {enRetiro.length > 0 ? (
          <Tarjeta titulo="En periodo de retiro">
            <ul className="divide-y divide-arena">
              {enRetiro.map((r) => (
                <li key={r.animal_id}>
                  <Link href={`/hato/${r.animal_id}#sanidad`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{nombres.get(r.animal_id) ?? "Animal"}</span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {r.retiro_leche_hasta ? <Insignia tono="aviso">Leche hasta {formatoFecha(r.retiro_leche_hasta, { day: "numeric", month: "short" })}</Insignia> : null}
                      {r.retiro_carne_hasta ? <Insignia tono="alerta">Carne hasta {formatoFecha(r.retiro_carne_hasta, { day: "numeric", month: "short" })}</Insignia> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}

        {pruebasAtencion.length > 0 ? (
          <Tarjeta titulo="Pruebas por revisar">
            <ul className="divide-y divide-arena">
              {pruebasAtencion.map((p) => (
                <li key={p.id}>
                  <Link href={`/hato/${p.animal_id}#sanidad`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-semibold [overflow-wrap:anywhere]">{nombres.get(p.animal_id) ?? "Animal"}</span>
                      <span className="block text-sm text-humo">
                        {ETIQUETA_PRUEBA_CORTA[p.prueba]} · {formatoFecha(p.fecha, { day: "numeric", month: "short" })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Insignia tono={TONO_RESULTADO_PRUEBA[p.resultado]}>{ETIQUETA_RESULTADO_PRUEBA[p.resultado]}</Insignia>
                      <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}
      </div>
    </div>
  );
}
