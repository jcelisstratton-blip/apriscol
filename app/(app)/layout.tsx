import { BottomNav } from "@/components/BottomNav";
import { NavLateral } from "@/components/NavLateral";
import { esAdminPlataforma, obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";

/**
 * Celular: una columna con la barra inferior. Computador (desde `lg`): menú lateral fijo y contenido más ancho.
 * Cada pantalla decide cómo aprovechar el ancho (columnas, rejillas); si no hace nada, se ve como en el celular.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { user, perfil, finca, fincas, rol } = await obtenerContexto();
  const permisos = { puedeOrdenar: puedeEscribir(rol, "leche"), puedeCrearAnimal: puedeEscribir(rol, "hato"), puedeSanidad: puedeEscribir(rol, "sanidad"), puedeCarne: puedeEscribir(rol, "carne") };
  const esSuperadmin = await esAdminPlataforma();

  return (
    <>
      <NavLateral
        nombre={perfil?.nombre || user.email || "Mi cuenta"}
        correo={user.email ?? ""}
        fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol }))}
        fincaActiva={finca.id}
        permisos={permisos}
        verLeche={puedeVer(rol, "leche")}
        verPremios={puedeVer(rol, "ferias")}
        verSanidad={puedeVer(rol, "sanidad")}
        verCorrales={puedeVer(rol, "corrales")}
        verCostos={puedeVer(rol, "contabilidad")}
        verCarne={puedeVer(rol, "carne")}
        verRepro={puedeVer(rol, "reproduccion")}
        verEquipo={puedeGestionar(rol)}
        esSuperadmin={esSuperadmin}
      />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-md px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] lg:max-w-5xl lg:px-10 lg:pb-12 lg:pt-4 2xl:max-w-6xl">
          {children}
        </main>
      </div>
      <BottomNav {...permisos} />
    </>
  );
}
