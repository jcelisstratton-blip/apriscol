import { SenalesDeArea } from "@/components/SenalesDeArea";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { areasSemaforo, type AreaSemaforo } from "@/lib/semaforos";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * «Qué atender hoy» de un área: carga las señales de Semáforos y las muestra con `SenalesDeArea`, para que la pantalla de trabajo diga lo mismo que el aviso de
 * Telegram. Solo si la persona ve esa área; si algo falla, la pantalla sigue sin la tarjeta.
 */
export async function QueAtender({ area }: { area: AreaSemaforo }) {
  const { finca, rol } = await obtenerContexto();
  if (!areasSemaforo(rol, finca.plan).includes(area)) return null;
  const senales = await cargarSemaforos({ supabase: await crearClienteServidor(), fincaId: finca.id, rol, plan: finca.plan, hoy: hoyBogota(), ajustes: await obtenerAjustes() }).catch(() => null);
  if (!senales) return null;
  return (
    <div className="mb-3">
      <SenalesDeArea area={area} senales={senales} />
    </div>
  );
}
