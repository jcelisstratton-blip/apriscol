import { redirect } from "next/navigation";
import { AvisoVigencia } from "@/components/AvisoVigencia";
import { BottomNav } from "@/components/BottomNav";
import { NavLateral } from "@/components/NavLateral";
import { esAdminPlataforma, obtenerContexto } from "@/lib/contexto";
import { visibilidadMenu } from "@/lib/menu";

/**
 * Celular: una columna con la barra inferior. Computador (desde `lg`): menú lateral fijo y contenido más ancho.
 * Cada pantalla decide cómo aprovechar el ancho (columnas, rejillas); si no hace nada, se ve como en el celular.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  // La pregunta «¿es superadmin?» solo necesita al usuario: se hace a la vez que el contexto de la finca, no después.
  const [{ user, perfil, finca, fincas, rol, vigencia: estado }, esSuperadmin] = await Promise.all([obtenerContexto(), esAdminPlataforma()]);
  // Plan vencido hace más de la semana de gracia: no se usa la app, solo se descargan los datos y se pide la renovación (/plan-vencido).
  if (estado === "bloqueada") redirect("/plan-vencido");
  // Finca adicional que aún espera la confirmación de su pago: solo se ve cuánto cuesta y cómo pagar (/activar-finca).
  if (estado === "pendiente") redirect("/activar-finca");

  return (
    <>
      <NavLateral
        nombre={perfil?.nombre || user.email || "Mi cuenta"}
        correo={user.email ?? ""}
        fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, logo_path: f.logo_path }))}
        fincaActiva={finca.id}
        rol={rol}
        plan={finca.plan}
        visibilidad={visibilidadMenu(rol, finca.plan)}
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
