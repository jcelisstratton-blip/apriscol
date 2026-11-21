"use client";

import { useEffect, useState } from "react";
import { ChevronRight, WifiOff } from "lucide-react";
import { RUTA_CAMPO, type ReferenciaCampo } from "@/lib/campo";
import { leerReferencia, listarRegistros } from "@/lib/offline/campo-db";

type Estado = { ref: ReferenciaCampo | null; pendientes: number };

/**
 * Debajo del formulario de entrada: qué hacer cuando no hay señal. Si este celular ya quedó listo (tiene la copia de la finca, porque se entró con señal
 * y la sesión no se cerró), ofrece «Registrar sin señal» con el nombre de la finca; si no, dice en una línea cómo dejarlo listo y lleva a la sección
 * «Sin señal». Sin conexión y con el celular listo, lo dice antes del botón (el aviso de que no se puede entrar lo da el formulario al tocar «Entrar»).
 * Si hay registros guardados sin enviar, avisa que se envían solos al entrar. Enlace común (no `Link`): sin señal la navegación de la app
 * no funciona y la del navegador la atiende el service worker.
 */
export function SinSenalAcceso() {
  const [estado, setEstado] = useState<Estado | undefined>(undefined);
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    let vigente = true;
    Promise.all([leerReferencia(), listarRegistros()])
      .then(([ref, registros]) => vigente && setEstado({ ref, pendientes: registros.filter((r) => r.estado === "pendiente" || r.estado === "enviando").length }))
      .catch(() => vigente && setEstado({ ref: null, pendientes: 0 }));
    const leer = () => setEnLinea(navigator.onLine);
    leer();
    window.addEventListener("online", leer);
    window.addEventListener("offline", leer);
    return () => {
      vigente = false;
      window.removeEventListener("online", leer);
      window.removeEventListener("offline", leer);
    };
  }, []);

  if (!estado) return null;
  const { ref, pendientes } = estado;

  return (
    <div className="mt-5 space-y-3 border-t border-arena pt-4">
      {!enLinea && ref ? <p className="text-sm font-semibold">Sin señal no se puede entrar, pero sí anotar:</p> : null}
      {ref ? (
        <a href={RUTA_CAMPO} className="flex min-h-14 items-center gap-3 rounded-2xl bg-lana px-4 py-3 ring-1 ring-arena transition hover:ring-musgo/40">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-papel text-musgo ring-1 ring-arena">
            <WifiOff className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Registrar sin señal</span>
            <span className="block text-sm text-humo [overflow-wrap:anywhere]">{ref.finca.nombre} · anota ahora, se envía al volver la señal</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
        </a>
      ) : (
        <p className="flex items-start gap-2 text-sm text-humo">
          <WifiOff className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            ¿Sin señal en la finca? Entra una vez con señal en este celular y luego anota sin señal.{" "}
            <a href="#sin-senal" className="font-semibold text-musgo underline underline-offset-4">Qué se puede hacer</a>
          </span>
        </p>
      )}
      {pendientes > 0 ? (
        <p className="text-sm text-humo">
          Tienes {pendientes === 1 ? "1 registro guardado" : `${pendientes} registros guardados`} en este celular: se envían solos cuando entres con tu cuenta.
        </p>
      ) : null}
    </div>
  );
}
