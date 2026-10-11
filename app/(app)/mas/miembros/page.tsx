import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormInvitar, RevocarInvitacion } from "@/components/FormInvitar";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ROL, puedeGestionar } from "@/lib/permisos";
import { formatoFecha } from "@/lib/fechas";

export const metadata: Metadata = { title: "Equipo" };

export default async function PaginaMiembros() {
  const { finca, rol, user } = await obtenerContexto();
  if (!puedeGestionar(rol)) redirect("/mas");
  const supabase = await crearClienteServidor();

  const [{ data: miembros }, { data: pendientes }] = await Promise.all([
    supabase.from("finca_miembros").select("user_id, rol, created_at").eq("finca_id", finca.id).order("created_at"),
    supabase.from("invitaciones").select("id, email, rol, expira_en").eq("finca_id", finca.id).is("aceptada_en", null).gt("expira_en", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const ids = (miembros ?? []).map((m) => m.user_id);
  const { data: perfiles } = ids.length ? await supabase.from("perfiles").select("id, nombre").in("id", ids) : { data: [] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre ?? "Sin nombre"]));

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Equipo" subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-2xl">
        <Tarjeta titulo="Personas con acceso">
          <ul className="divide-y divide-arena">
            {(miembros ?? []).map((m) => (
              <li key={m.user_id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="min-w-0 font-semibold">
                  {nombres.get(m.user_id)}
                  {m.user_id === user.id ? <span className="font-normal text-humo"> (tú)</span> : null}
                </span>
                <Insignia tono={m.rol === "propietario" ? "musgo" : "neutro"}>{ETIQUETA_ROL[m.rol]}</Insignia>
              </li>
            ))}
          </ul>
        </Tarjeta>

        {(pendientes ?? []).length > 0 ? (
          <Tarjeta titulo="Invitaciones pendientes">
            <ul className="divide-y divide-arena">
              {(pendientes ?? []).map((i) => (
                <li key={i.id} className="flex min-h-14 items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block font-semibold [overflow-wrap:anywhere]">{i.email}</span>
                    <span className="block text-sm text-humo">
                      {ETIQUETA_ROL[i.rol]} · vence el {formatoFecha(i.expira_en.slice(0, 10), { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <RevocarInvitacion id={i.id} />
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}

        <Tarjeta titulo="Invitar a alguien">
          <FormInvitar />
        </Tarjeta>
      </div>
    </>
  );
}
