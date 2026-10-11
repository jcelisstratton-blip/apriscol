import { BottomNav } from "@/components/BottomNav";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { rol } = await obtenerContexto();
  return (
    <>
      <main className="mx-auto w-full max-w-md px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        {children}
      </main>
      <BottomNav puedeOrdenar={puedeEscribir(rol, "leche")} puedeCrearAnimal={puedeEscribir(rol, "hato")} puedeFerias={puedeEscribir(rol, "ferias")} />
    </>
  );
}
