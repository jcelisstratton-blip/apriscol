import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, PencilLine, Upload } from "lucide-react";
import { PantallaAuth } from "@/components/PantallaAuth";
import { RecuadroTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { obtenerContexto } from "@/lib/contexto";
import { escena } from "@/lib/escenas";
import { puedeGestionar } from "@/lib/permisos";

export const metadata: Metadata = { title: "¿Cómo quieres empezar?" };

/**
 * Paso tras crear la finca: ¿traer lo que ya llevas en Excel («Migrar mi finca») o empezar de cero? Las dos salidas son tarjetas; la de migrar va resaltada.
 * «De cero» sigue al paso de traer los animales del registro genealógico si todavía no se resolvió, y si no, a Hoy. Una finca que espera su pago no ofrece nada
 * de esto (la app la manda a su pantalla de activación).
 */
export default async function PaginaEmpezar() {
  const { finca, rol, perfil, vigencia } = await obtenerContexto();
  if (!puedeGestionar(rol) || vigencia === "pendiente" || vigencia === "bloqueada") redirect("/");
  const siguiente = perfil?.libro_resuelto_en ? "/" : "/onboarding/animales";

  return (
    <PantallaAuth titulo="¿Cómo quieres empezar?" subtitulo={`Tu finca «${finca.nombre}» ya está creada. Elige cómo llenarla: puedes cambiar de idea cuando quieras desde Hato → Migrar mi finca.`}>
      <RecuadroTarjetas compacto>
        <div className="grid grid-cols-1 gap-2.5">
          <TarjetaOpcion
            tamano="normal"
            destacada
            escena={escena(FileSpreadsheet, "musgo", Upload)}
            titulo="Migrar mi finca desde Excel"
            detalle="Corrales, animales con su genealogía, pesos, ordeños, sanidad e inventario. Con una plantilla para cada tabla y paso a paso."
            href="/hato/migrar"
          />
          <TarjetaOpcion
            tamano="normal"
            escena={escena(PencilLine, "ocre")}
            titulo="Empezar desde cero"
            detalle="Registra tus animales y tu día a día a mano. Si después quieres traer tus datos, siempre puedes hacerlo."
            href={siguiente}
          />
        </div>
      </RecuadroTarjetas>
      <Link href="/" className="text-center text-[0.9375rem] font-semibold text-musgo">
        Decidirlo después
      </Link>
    </PantallaAuth>
  );
}
