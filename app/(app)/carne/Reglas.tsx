import { Aviso } from "@/components/Aviso";
import { FormReglasCeba } from "@/components/FormReglasCeba";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Especie } from "@/lib/tipos";

const NOMBRE: Record<Especie, string> = { caprino: "cabras", ovino: "ovejas" };

/** Las reglas con las que se decide cuándo un animal pasa a ceba. Cada finca las ajusta; sin tocarlas se usan valores sugeridos. */
export async function Reglas({
  fincaId,
  especies,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  especies: Especie[];
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const { data } = await supabase.rpc("reglas_ceba_efectivas", { p_finca: fincaId });
  const reglas = (data ?? []).filter((r) => especies.length === 0 || especies.includes(r.especie));

  return (
    <div className="space-y-4">
      <Aviso tipo="info">
        Son criterios orientativos, no una norma: dependen de la raza, de cómo se maneja el aprisco y de la producción de cada animal. Ajústalos a tu caso y se usan en la pestaña Candidatos.
      </Aviso>
      {reglas.map((r) => (
        <Tarjeta key={`${r.especie}-${JSON.stringify(r)}`} titulo={`Reglas de ${NOMBRE[r.especie]}`}>
          <FormReglasCeba regla={r} nombreEspecie={NOMBRE[r.especie]} puedeEditar={puedeEditar} />
        </Tarjeta>
      ))}
      <Aviso tipo="info">
        Una hembra gestante y joven no aparece como candidata: se espera a que para y destete. Si ya pasó la edad límite aparece con una advertencia, y lo mismo una hembra en lactancia o un animal en retiro de carne.
      </Aviso>
    </div>
  );
}
