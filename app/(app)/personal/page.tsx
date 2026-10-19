import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Plus, Users } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { ListaPagosPersonal } from "@/components/ListaPagosPersonal";
import { ListaPersonal } from "@/components/ListaPersonal";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { obtenerContexto } from "@/lib/contexto";
import { AYUDA_PERSONAL } from "@/lib/ayuda";
import { escena } from "@/lib/escenas";
import { hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Persona } from "@/lib/tipos";

export const metadata: Metadata = { title: "Personal" };

const VISTAS = ["pagos", "personas"] as const;
type Vista = (typeof VISTAS)[number];

/**
 * Personal (menú de la finca): los pagos a quienes trabajan en ella y la lista de personas con su contrato. El costo de cada pago —con el factor
 * prestacional si tiene contrato de trabajo— se suma en Costos como «Mano de obra», aparte de las compras.
 */
export default async function PaginaPersonal({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "contabilidad", finca.plan)) redirect("/");
  const sp = await searchParams;
  const vista: Vista = VISTAS.includes(sp.vista as Vista) ? (sp.vista as Vista) : "pagos";
  const puedeEditar = puedeEscribir(rol, "contabilidad", finca.plan);
  const supabase = await crearClienteServidor();

  const [{ data: personal }, { data: abiertos }, { data: delMes }] = await Promise.all([
    supabase.from("personal").select("*").eq("finca_id", finca.id).order("activo", { ascending: false }).order("nombre"),
    supabase.from("pagos_personal").select("costo_total").eq("finca_id", finca.id).is("pagado_en", null).limit(5000),
    supabase.from("pagos_personal").select("costo_total").eq("finca_id", finca.id).gte("fecha", `${hoyBogota().slice(0, 7)}-01`).limit(5000),
  ]);
  const lista = (personal ?? []) as Persona[];
  const activas = lista.filter((p) => p.activo);
  const porPagar = (abiertos ?? []).reduce((s, p) => s + Number(p.costo_total), 0);
  const costoMes = (delMes ?? []).reduce((s, p) => s + Number(p.costo_total), 0);

  return (
    <>
      <Encabezado titulo="Personal" subtitulo={finca.nombre} />
      <PestanasTarjetas
        pestanas={[
          { valor: "pagos", etiqueta: "Pagos", detalle: porPagar > 0 ? `${pesos(porPagar)} por pagar` : "Lo que pagas al personal", href: "/personal", escena: escena(Banknote, "oliva") },
          { valor: "personas", etiqueta: "Personas", detalle: `${activas.length} ${activas.length === 1 ? "activa" : "activas"}`, href: "/personal?vista=personas", escena: escena(Users, "ocre") },
        ]}
        actual={vista}
      />
      <div className="space-y-4">
        <AvisoGuardado activo={sp.guardado === "1"} />
        <AyudaModulo ayuda={AYUDA_PERSONAL} />
        {vista === "pagos" ? (
          <>
            {puedeEditar ? (
              activas.length > 0 ? (
                <Link href="/personal/pagos/nuevo" className={clasesBoton("primario")}>
                  <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Registrar un pago
                </Link>
              ) : (
                <Link href="/personal/nueva" className={clasesBoton("primario")}>
                  <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Agregar a la primera persona
                </Link>
              )
            ) : null}
            {costoMes > 0 ? (
              <p className="rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
                Mano de obra de este mes: <span className="font-display text-lg font-semibold tabular-nums">{pesos(costoMes)}</span>
              </p>
            ) : null}
            <ListaPagosPersonal fincaId={finca.id} personal={lista} puedeEditar={puedeEditar} />
          </>
        ) : (
          <>
            {puedeEditar ? (
              <Link href="/personal/nueva" className={clasesBoton("primario")}>
                <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Agregar a una persona
              </Link>
            ) : null}
            <ListaPersonal personal={lista} puedeEditar={puedeEditar} />
          </>
        )}
      </div>
    </>
  );
}
