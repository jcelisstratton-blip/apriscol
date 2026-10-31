import Link from "next/link";
import { CheckCircle2, ChevronRight, Siren, TriangleAlert } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { ETIQUETA_AREA, type AreaSemaforo, type Senal } from "@/lib/semaforos";

/**
 * «Qué atender hoy» de un área (Sanidad, Reproducción…): las mismas señales y los mismos números que el aviso de Telegram y la pantalla Semáforos,
 * con su «qué hacer» y los primeros casos. Cada una abre su detalle en Semáforos. Sirve para que la pantalla de trabajo y el celular cuenten lo mismo.
 */
export function SenalesDeArea({ area, senales, maxCasos = 3 }: { area: AreaSemaforo; senales: Senal[]; maxCasos?: number }) {
  const delArea = senales.filter((s) => s.area === area);
  const conAviso = delArea.filter((s) => s.nivel !== "verde").sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "rojo" ? -1 : 1));
  const rojos = conAviso.reduce((n, s) => n + s.items.filter((i) => i.nivel === "rojo").length, 0);
  const ambar = conAviso.reduce((n, s) => n + s.items.filter((i) => i.nivel === "ambar").length, 0);
  const rutaArea = `/semaforos?area=${area}`;

  return (
    <Tarjeta titulo={`Qué atender hoy · ${ETIQUETA_AREA[area]}`} acciones={<Link href={rutaArea} className="text-sm font-semibold text-musgo">Ver en Semáforos</Link>}>
      {conAviso.length === 0 ? (
        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ok">
          <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden="true" /> Todo en orden por ahora.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <Insignia tono="alerta">{rojos} en rojo</Insignia>
            <Insignia tono="aviso">{ambar} en ámbar</Insignia>
          </div>
          <ul className="divide-y divide-arena">
            {conAviso.map((s) => (
              <li key={s.id}>
                <Link href={`${rutaArea}&s=${s.id}`} className="flex items-start justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-start gap-2.5">
                    {s.nivel === "rojo" ? <Siren className="mt-0.5 size-5 shrink-0 text-rojo" strokeWidth={2} aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-5 shrink-0 text-ambar" strokeWidth={2} aria-hidden="true" />}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-semibold">{s.titulo}</span>
                      <span className="block text-sm text-humo">
                        {s.resumen}
                        {s.items.length > 0 ? ` · ${s.items.slice(0, maxCasos).map((i) => i.etiqueta).join(", ")}${s.items.length > maxCasos ? ` y ${s.items.length - maxCasos} más` : ""}` : ""}
                      </span>
                      <span className="mt-0.5 block text-sm">
                        <span className="font-medium">Qué hacer:</span> {s.queHacer}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-humo" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}
