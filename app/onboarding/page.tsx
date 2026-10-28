import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { FormFinca } from "@/components/FormFinca";
import { PantallaAuth } from "@/components/PantallaAuth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuario } from "@/lib/contexto";
import { redirect } from "next/navigation";
import { puedeAgregarFinca } from "@/lib/permisos";
import type { RolFinca } from "@/lib/tipos";
import { planPorId, precioMes, usd } from "@/lib/planes";

export const metadata: Metadata = { title: "Nueva finca" };

export default async function PaginaOnboarding() {
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { data: propias } = await supabase.from("finca_miembros").select("finca_id").eq("user_id", user.id).eq("rol", "propietario");
  const { count } = await supabase.from("finca_miembros").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const tieneFincas = (count ?? 0) > 0;
  const { data: roles } = await supabase.from("finca_miembros").select("rol").eq("user_id", user.id);
  if (!puedeAgregarFinca((roles ?? []).map((m) => m.rol as RolFinca))) redirect("/mas");
  // Desde la segunda finca propia hay costo y la finca se activa al confirmar el pago (las cuentas de pruebas no pagan).
  const { data: perfil } = await supabase.from("perfiles").select("exenta_vigencia").eq("id", user.id).maybeSingle();
  const cobra = (propias ?? []).length > 0 && !perfil?.exenta_vigencia;
  const numero = (propias ?? []).length + 1;
  const { count: porActivar } = cobra
    ? await supabase.from("fincas").select("*", { count: "exact", head: true }).in("id", (propias ?? []).map((m) => m.finca_id)).is("activada_en", null)
    : { count: 0 };
  const plan = planPorId("cria");

  return (
    <PantallaAuth
      titulo={tieneFincas ? "Agregar otra finca" : "Cuéntanos de tu finca"}
      subtitulo={tieneFincas ? "Cada finca tiene su propio plan: la nueva empieza en Cría y desde la segunda tienes 10 % menos. Podrás cambiar entre tus fincas cuando quieras." : "Con esto armamos tu panel. Lo puedes cambiar después."}
    >
      {cobra && (porActivar ?? 0) > 0 ? (
        <Aviso tipo="atencion">Ya tienes una finca esperando la confirmación de su pago. Cuando se active, podrás crear otra.</Aviso>
      ) : (
        <>
          {cobra ? (
            <Aviso tipo="info">
              Esta será tu finca n.º {numero}: {usd(precioMes(plan, false, numero))} al mes, o {usd(precioMes(plan, true, numero) * 12)} al año (10 % menos que la primera). Se activa cuando confirmemos tu pago por Nequi.
            </Aviso>
          ) : null}
          <FormFinca />
        </>
      )}
      {tieneFincas ? (
        <Link href="/mas" className="text-center text-[0.9375rem] font-semibold text-musgo">
          Volver
        </Link>
      ) : null}
    </PantallaAuth>
  );
}
