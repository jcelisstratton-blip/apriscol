"use client";

import { useState, useTransition } from "react";
import { ListChecks, Siren } from "lucide-react";
import { guardarAvisos } from "@/app/(admin)/admin/fincas/[id]/avisos/actions";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Insignia } from "@/components/Insignia";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { escena } from "@/lib/escenas";
import { ETIQUETA_VINCULO, type EstadoVinculo } from "@/lib/notificaciones/enlace";
import { DIAS_SEMANA, MAX_DIARIOS, type ParametrosAvisos } from "@/lib/notificaciones/parametros";

const TONO: Record<EstadoVinculo, "neutro" | "ok" | "aviso" | "alerta"> = { pendiente: "neutro", activo: "ok", pausado: "aviso", bloqueado: "alerta" };
const NIVELES = [
  { valor: "ambar" as const, etiqueta: "Urgente y pendiente", detalle: "Rojos y naranjas", escena: escena(ListChecks, "ambar") },
  { valor: "rojo" as const, etiqueta: "Solo urgente", detalle: "Solo lo vencido", escena: escena(Siren, "arcilla") },
];

/** Superadmin: los parámetros de aviso de una persona de la finca (hora, días, nivel). Se guarda con un botón; lo que ya estaba no se pierde si falla. */
export function AvisosPersonaAdmin({
  fincaId,
  userId,
  nombre,
  correo,
  rol,
  vinculo,
  inicial,
}: {
  fincaId: string;
  userId: string;
  nombre: string;
  correo: string;
  rol: string;
  vinculo: EstadoVinculo;
  inicial: ParametrosAvisos;
}) {
  const toast = useToast();
  const [p, setP] = useState<ParametrosAvisos>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiar = <K extends keyof ParametrosAvisos>(k: K, v: ParametrosAvisos[K]) => setP((a) => ({ ...a, [k]: v }));
  const alternarDia = (d: number) => cambiar("dias", p.dias.includes(d) ? p.dias.filter((x) => x !== d) : [...p.dias, d]);

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await guardarAvisos(fincaId, userId, p);
      if (r.ok) toast.exito("Avisos guardados");
      else setError(r.error);
    });

  return (
    <section className="min-w-0 space-y-4 rounded-3xl bg-papel p-4 ring-1 ring-arena" aria-label={`Avisos de ${nombre}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold [overflow-wrap:anywhere]">{nombre}</p>
          <p className="text-sm text-humo [overflow-wrap:anywhere]">
            {rol} · {correo}
          </p>
        </div>
        <Insignia tono={TONO[vinculo]}>{ETIQUETA_VINCULO[vinculo]}</Insignia>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-[0.9375rem] font-semibold">
        <input type="checkbox" className="size-5 accent-musgo" checked={p.activo} onChange={(e) => cambiar("activo", e.target.checked)} />
        Enviarle el resumen por Telegram
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Hora del resumen" ayuda="Hora de Colombia.">
          {(id) => <input id={id} type="time" className={CLASE_INPUT} value={p.resumen_hora} onChange={(e) => cambiar("resumen_hora", e.target.value)} />}
        </Campo>
        <Campo etiqueta="Máximo de mensajes al día" ayuda={`De 1 a ${MAX_DIARIOS}.`}>
          {(id) => (
            <input id={id} type="number" inputMode="numeric" min={1} max={MAX_DIARIOS} className={CLASE_INPUT} value={p.max_diarios} onChange={(e) => cambiar("max_diarios", Number(e.target.value))} />
          )}
        </Campo>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Días</p>
        <div role="group" aria-label="Días de envío" className="grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((nombreDia, i) => {
            const activo = p.dias.includes(i + 1);
            return (
              <button
                key={nombreDia}
                type="button"
                aria-pressed={activo}
                onClick={() => alternarDia(i + 1)}
                className={`min-h-11 min-w-0 rounded-xl text-[0.8125rem] font-semibold transition ${activo ? "bg-musgo text-sobre-musgo" : "bg-arena text-humo"}`}
              >
                {nombreDia}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Qué incluye</p>
        <SelectorTarjetas titulo="Nivel mínimo del resumen" valor={p.nivel_minimo} opciones={NIVELES} onCambio={(v) => v && cambiar("nivel_minimo", v)} />
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton pendiente={pendiente} cargando="Guardando…" onClick={guardar}>
        Guardar avisos
      </Boton>
    </section>
  );
}
