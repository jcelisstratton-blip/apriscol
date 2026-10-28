import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { AccesoPersona, type InvitacionPersona } from "@/components/AccesoPersona";
import { FormPersona } from "@/components/FormPersona";
import { obtenerContexto } from "@/lib/contexto";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { estadoAcceso } from "@/lib/invitacion";
import { urlDelSitio } from "@/lib/sitio";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { eliminarPersona } from "@/app/(app)/personal/actions";

export const metadata: Metadata = { title: "Editar persona" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaPersonaEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: persona } = await supabase.from("personal").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!persona) notFound();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) redirect("/mas/miembros");
  // Acceso a la app: la última invitación al correo de la persona (solo quien gestiona puede leer las invitaciones).
  const { data: inv } = puedeGestionar(rol) && persona.correo
    ? await supabase.from("invitaciones").select("id, email, rol, token, expira_en, aceptada_en").eq("finca_id", finca.id).eq("email", persona.correo).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const acceso = estadoAcceso(inv);
  const invitacion: InvitacionPersona | null = inv
    ? { id: inv.id, email: inv.email, rol: inv.rol, enlace: `${await urlDelSitio()}/invitacion/${inv.token}`, vence: formatoFecha(inv.expira_en.slice(0, 10), { day: "numeric", month: "long" }) }
    : null;
  const { count } = await supabase.from("pagos_personal").select("id", { count: "exact", head: true }).eq("personal_id", id).eq("finca_id", finca.id);

  return (
    <>
      <Link href="/mas/miembros" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Equipo
      </Link>
      <Encabezado titulo="Editar persona" subtitulo={finca.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormPersona hoy={hoyBogota()} persona={persona} tienePagos={(count ?? 0) > 0} />
        {puedeGestionar(rol) ? <AccesoPersona personaId={persona.id} correo={persona.correo} rolActual={persona.rol} esVeterinario={persona.es_veterinario} acceso={acceso} invitacion={invitacion} /> : null}
        {puedeGestionar(rol) && (count ?? 0) === 0 ? (
          <EliminarRegistro etiqueta="Eliminar a esta persona" resumen={persona.nombre} accion={eliminarPersona.bind(null, id)} destino="/mas/miembros" mensaje="Persona eliminada" />
        ) : null}
      </div>
    </>
  );
}
