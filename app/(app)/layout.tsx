import { redirect } from "next/navigation";
import { AvisoVigencia } from "@/components/AvisoVigencia";
import { BottomNav } from "@/components/BottomNav";
import { NavLateral } from "@/components/NavLateral";
import { esAdminPlataforma, obtenerContexto } from "@/lib/contexto";
import { puedeGestionar, puedeVer } from "@/lib/permisos";

/**
 * Celular: una columna con la barra inferior. Computador (desde `lg`): menú lateral fijo y contenido más ancho.
 * Cada pantalla decide cómo aprovechar el ancho (columnas, rejillas); si no hace nada, se ve como en el celular.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { user, perfil, finca, fincas, rol, vigencia: estado } = await obtenerContexto();
  // Plan vencido hace más de la semana de gracia: no se usa la app, solo se descargan los datos y se pide la renovación (/plan-vencido).
  if (estado === "bloqueada") redirect("/plan-vencido");
  const esSuperadmin = await esAdminPlataforma();

  return (
    <>
      <NavLateral
        nombre={perfil?.nombre || user.email || "Mi cuenta"}
        correo={user.email ?? ""}
        fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol }))}
        fincaActiva={finca.id}
        rol={rol}
        plan={finca.plan}
        verLeche={puedeVer(rol, "leche", finca.plan)}
        verPremios={puedeVer(rol, "ferias", finca.plan)}
        verSanidad={puedeVer(rol, "sanidad", finca.plan)}
        verCorrales={puedeVer(rol, "corrales", finca.plan)}
        verCostos={puedeVer(rol, "contabilidad", finca.plan)}
        verCarne={puedeVer(rol, "carne", finca.plan)}
        verRepro={puedeVer(rol, "reproduccion", finca.plan)}
        verEquipo={puedeGestionar(rol) || puedeVer(rol, "contabilidad", finca.plan)}
        verPlan={rol === "propietario"}
        planMejorable={finca.plan !== "hacienda"}
        esSuperadmin={esSuperadmin}
      />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-md px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] lg:max-w-5xl lg:px-10 lg:pb-12 lg:pt-4 2xl:max-w-6xl">
          <AvisoVigencia estado={estado} venceEn={finca.plan_vence_en} />
          {children}
        </main>
      </div>
      <BottomNav rol={rol} plan={finca.plan} />
    </>
  );
}
