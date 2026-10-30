import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ConectarTelegram } from "@/components/ConectarTelegram";
import { Encabezado } from "@/components/Encabezado";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { TELEGRAM_BOT } from "@/lib/env";
import { describirAvisos, type EstadoVinculo } from "@/lib/notificaciones/enlace";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Telegram" };

/** Avisos por Telegram de la persona: conectar su Telegram, ver cómo está y desconectarlo. Los horarios y el nivel los fija el equipo de Apriscol. */
export default async function PaginaTelegram() {
  const { finca, user } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const [{ data: vinculo }, { data: pref }] = await Promise.all([
    // Las columnas del código y del chat nunca se leen desde la app: solo el estado.
    supabase.from("telegram_vinculos").select("estado").eq("finca_id", finca.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("notificacion_preferencias").select("*").eq("finca_id", finca.id).eq("user_id", user.id).maybeSingle(),
  ]);
  const estado = (vinculo?.estado ?? "pendiente") as EstadoVinculo;

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Telegram" subtitulo="Lo que hay que hacer hoy, en tu celular" />
      <div className="lg:max-w-xl">
        <Tarjeta>
          <ConectarTelegram finca={finca.nombre} estado={estado} bot={TELEGRAM_BOT} avisos={describirAvisos(pref)} />
        </Tarjeta>
      </div>
    </>
  );
}
