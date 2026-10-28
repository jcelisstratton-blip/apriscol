"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw, Share2 } from "lucide-react";
import { RevocarInvitacion } from "@/components/FormInvitar";
import { useCompartirEnlace } from "@/components/EnlaceInvitacion";
import { useToast } from "@/components/Toast";
import { renovarInvitacion } from "@/app/(app)/mas/miembros/actions";

const BOTON = "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-musgo hover:bg-arena disabled:opacity-50";

/** Una invitación de la lista de Equipo: copiar o reenviar su enlace (o renovarla si venció) y cancelarla. */
export function FilaInvitacion({ id, email, detalle, vencida, enlace }: { id: string; email: string; detalle: string; vencida: boolean; enlace: string }) {
  const router = useRouter();
  const toast = useToast();
  const { copiar, compartir } = useCompartirEnlace();
  const [ocupado, iniciar] = useTransition();

  const renovar = () =>
    iniciar(async () => {
      const r = await renovarInvitacion(id);
      if (r.error || !r.enlace) return toast.error(r.error ?? "No se pudo renovar la invitación.");
      await copiar(r.enlace);
      toast.exito("Invitación renovada por 7 días");
      router.refresh();
    });

  return (
    <li className="py-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-semibold [overflow-wrap:anywhere]">{email}</span>
          <span className={`block text-sm ${vencida ? "text-rojo" : "text-humo"}`}>{detalle}</span>
        </span>
        <RevocarInvitacion id={id} />
      </div>
      <div className="-ml-3 flex flex-wrap items-center gap-x-1">
        {vencida ? (
          <button type="button" onClick={renovar} disabled={ocupado} className={BOTON}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" /> Renovar y copiar enlace
          </button>
        ) : (
          <>
            <button type="button" onClick={() => copiar(enlace)} className={BOTON}>
              <Copy className="size-4" strokeWidth={2} aria-hidden="true" /> Copiar enlace
            </button>
            <button type="button" onClick={() => compartir(enlace)} className={BOTON}>
              <Share2 className="size-4" strokeWidth={2} aria-hidden="true" /> Enviar
            </button>
          </>
        )}
      </div>
    </li>
  );
}
